import { ChatOllama } from "@langchain/ollama";
import { after } from "next/server";
import { getChat, updateTitle, generateTitle, capTitleLength, isBlankMessage } from "@/lib/chat/chats";
import { extractText } from "@/lib/chat/messages";
import { resolveOllamaConfig } from "@/lib/ollama/config";

/**
 * Streams an LLM-generated summary of a Chat's opening Message as its new
 * sidebar title, so a client (see components/chat.tsx) can render it
 * growing token-by-token — see docs/adr/0008-stream-chat-titles-from-the
 * -client.md. The generated text is summarized from the opening Message
 * itself, not the Chat's current (possibly already-truncated) title, so
 * nothing beyond TITLE_MAX_LENGTH is lost to the Model before it even sees it.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const chat = getChat(id);
  if (!chat) {
    return new Response("Chat not found", { status: 404 });
  }

  const openingMessage = chat.messages[0];
  if (!openingMessage) {
    return new Response("Chat has no messages", { status: 400 });
  }

  const { baseUrl, model: modelName } = resolveOllamaConfig();
  // numPredict hard-caps generation at a small token budget — a backstop
  // for when the Model ignores TITLE_INSTRUCTION's word-count ask and
  // starts producing a full sentence instead of a short title (see
  // lib/chat/titles.ts). Specific to this route: the main chat model
  // (app/api/chat/route.ts) has no such cap, since replies there are
  // meant to be long-form.
  const model = new ChatOllama({ baseUrl, model: modelName, numPredict: 20, temperature: 0.2 });
  const stream = generateTitle(extractText(openingMessage), model);

  // The stream is consumed twice — once by the client via the returned
  // Response body, once here to assemble the full text for persistence —
  // so it's teed rather than shared: a ReadableStream can only be read by
  // one consumer at a time.
  const [forClient, forPersistence] = stream.tee();

  after(async () => {
    try {
      const reader = forPersistence.getReader();
      const decoder = new TextDecoder();
      let title = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        title += decoder.decode(value, { stream: true });
      }

      const trimmedTitle = title.trim();
      // A blank/unreachable-model result is treated the same as any other
      // generation failure — see isBlankMessage/deriveTitle and
      // docs/adr/0008-stream-chat-titles-from-the-client.md's "cosmetic,
      // not load-bearing" stance: the existing fallback title stays.
      if (!isBlankMessage(trimmedTitle)) {
        updateTitle(id, capTitleLength(trimmedTitle));
      }
    } catch (error) {
      console.warn(`[chats] Failed to generate a title for chat ${id}:`, error);
    }
  });

  return new Response(forClient, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Transfer-Encoding": "chunked",
    },
  });
}
