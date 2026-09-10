import type { BaseChatModel } from '@langchain/core/language_models/chat_models'
import { HumanMessage } from '@langchain/core/messages'

/**
 * Chat title helpers, kept in their own module — deliberately with no
 * import of lib/db (and so no `node:sqlite`) — so a Client Component (see
 * components/chat.tsx) can import deriveTitle without pulling Node's
 * sqlite binding into the browser bundle, which the bundler can't resolve
 * there. lib/chat/chats.ts re-exports these for server-side callers.
 */

/** Sidebar titles are truncated to this length, matching a single line of text. */
const TITLE_MAX_LENGTH = 60

/** Collapses whitespace and hard-caps `text` at TITLE_MAX_LENGTH, appending an ellipsis when truncated. */
export function capTitleLength(text: string): string {
  const collapsed = text.trim().replace(/\s+/g, ' ')
  return collapsed.length > TITLE_MAX_LENGTH ? `${collapsed.slice(0, TITLE_MAX_LENGTH)}…` : collapsed
}

/** Whether `text` has no visible content once whitespace is collapsed — see deriveTitle/generateTitle. */
export function isBlankMessage(text: string): boolean {
  return text.trim() === ''
}

/**
 * Derives a Chat's initial sidebar title synchronously from its opening
 * Message: the message text, truncated. Used as the title until (and
 * unless) generateTitle's LLM summary replaces it — see docs/adr/0008
 * -stream-chat-titles-from-the-client.md. Exported so callers (see
 * components/chat.tsx) can tell whether a Chat's persisted title is still
 * this fallback (and so still needs generating) by recomputing it from the
 * opening message and comparing.
 */
export function deriveTitle(text: string): string {
  return isBlankMessage(text) ? 'New Chat' : capTitleLength(text)
}

/**
 * Appended to a Chat's opening message to have the Model summarize it into
 * a short sidebar title — mirrors buildRetrievalQuery's instruction-message
 * pattern in lib/rag/retrieval.ts. Spells out a strict word count and gives
 * an example, since a vaguer ask ("a short title", "at most a few words")
 * left models producing full sentences that then just got hard-truncated
 * by capTitleLength — not what a sidebar title should look like. The
 * Model's numPredict cap (see app/api/chats/[id]/title/route.ts) is the
 * backstop for when it ignores this anyway.
 */
const TITLE_INSTRUCTION = 'Summarize the visitor\'s message above as a title for a chat list: 3 to 6 words, '
  + 'title case, no punctuation, no quotes, no explanations. Respond with only the title itself and nothing '
  + 'else — for example: Owner\'s Favorite Hobby'

/**
 * Streams the Model's summary of `text` (a Chat's opening message) as raw
 * text chunks, so a caller can forward them to a client as they arrive —
 * see app/api/chats/[id]/title/route.ts and docs/adr/0008-stream-chat
 * -titles-from-the-client.md. Neither truncation (TITLE_MAX_LENGTH) nor the
 * blank-reply guard happen here: they need the *full* assembled text, which
 * only the caller has once the stream drains, so callers apply
 * capTitleLength/isBlankMessage themselves before persisting.
 */
export function generateTitle(text: string, model: BaseChatModel): ReadableStream<Uint8Array<ArrayBuffer>> {
  const stream = model.streamEvents([new HumanMessage(text), new HumanMessage(TITLE_INSTRUCTION)])
  const encoder = new TextEncoder();

  const readable = new ReadableStream<Uint8Array<ArrayBuffer>>({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          if (chunk.event === 'content-block-delta' && chunk.delta.type === 'text-delta') {
            controller.enqueue(encoder.encode(chunk.delta.text));
          }
        }

        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });
  return readable;
}
