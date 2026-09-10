import type { DatabaseSync } from 'node:sqlite'
import type { UIMessage } from 'ai'
import type { BaseChatModel } from '@langchain/core/language_models/chat_models'
import { HumanMessage } from '@langchain/core/messages'
import { getDb } from '@/lib/db'

export interface Chat {
  id: string
  title: string
}

export interface ChatWithMessages extends Chat {
  messages: UIMessage[]
}

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
 * pattern in lib/rag/retrieval.ts.
 */
const TITLE_INSTRUCTION = 'Summarize the visitor\'s message above as a short title for a chat list, at most a few '
  + 'words, no punctuation at the end, no quotes. Respond with only the title.'

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


function insertMessages(db: DatabaseSync, chatId: string, messages: UIMessage[]): void {
  const insert = db.prepare('INSERT INTO messages (id, chat_id, position, role, parts) VALUES (?, ?, ?, ?, ?)')
  messages.forEach((message, position) => {
    insert.run(message.id, chatId, position, message.role, JSON.stringify(message.parts))
  })
}

/**
 * Creates a new Chat and persists its opening visitor Message immediately,
 * so app/[id]/page.tsx has something to render as soon as it navigates
 * there — see CONTEXT.md's Chat/Message terms.
 */
export function createChat(firstMessageText: string, db: DatabaseSync = getDb()): Chat {
  const id = crypto.randomUUID()
  const title = deriveTitle(firstMessageText)

  db.prepare('INSERT INTO chats (id, title, created_at) VALUES (?, ?, ?)').run(id, title, Date.now())

  const message: UIMessage = {
    id: crypto.randomUUID(),
    role: 'user',
    parts: [{ type: 'text', text: firstMessageText }]
  }
  insertMessages(db, id, [message])

  return { id, title }
}

/** Every persisted Chat, most recently created first. Ties (same millisecond) break by insertion order. */
export function getChats(db: DatabaseSync = getDb()): Chat[] {
  return db.prepare('SELECT id, title FROM chats ORDER BY created_at DESC, rowid DESC').all() as unknown as Chat[]
}

interface MessageRow {
  id: string
  role: UIMessage['role']
  parts: string
}

/** The Chat with `id` and its full transcript, in order — or undefined if no such Chat exists. */
export function getChat(id: string, db: DatabaseSync = getDb()): ChatWithMessages | undefined {
  const chat = db.prepare('SELECT id, title FROM chats WHERE id = ?').get(id) as Chat | undefined
  if (!chat) {
    return undefined
  }

  const rows = db.prepare('SELECT id, role, parts FROM messages WHERE chat_id = ? ORDER BY position ASC').all(id) as unknown as MessageRow[]
  const messages = rows.map(row => ({ id: row.id, role: row.role, parts: JSON.parse(row.parts) }) as UIMessage)

  return { ...chat, messages }
}

/** Replaces a Chat's entire persisted transcript with `messages`, in order. */
export function saveMessages(chatId: string, messages: UIMessage[], db: DatabaseSync = getDb()): void {
  db.prepare('DELETE FROM messages WHERE chat_id = ?').run(chatId)
  insertMessages(db, chatId, messages)
}

/**
 * Replaces a Chat's persisted title, e.g. once generateTitle's LLM summary
 * is ready — see docs/adr/0008-stream-chat-titles-from-the-client.md. A no-op if
 * `chatId` doesn't exist (e.g. the Chat was deleted before generation
 * finished).
 */
export function updateTitle(chatId: string, title: string, db: DatabaseSync = getDb()): void {
  db.prepare('UPDATE chats SET title = ? WHERE id = ?').run(title, chatId)
}

export function deleteChat(id: string) {
  const db = getDb()
  db.prepare('DELETE FROM messages WHERE chat_id = ?').run(id)
  db.prepare('DELETE FROM chats WHERE id = ?').run(id)
  return true
}
