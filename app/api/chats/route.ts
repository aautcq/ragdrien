import { ChatOllama } from "@langchain/ollama";
import { after } from "next/server";
import { createChat, generateTitle, getChats, isBlankMessage, updateTitle } from "@/lib/chat/chats";
import { resolveOllamaConfig } from "@/lib/ollama/config";

export async function POST(request: Request) {
  const { text } = await request.json() as { text: string };

  const { id } = createChat(text);

  // Title generation: kept off the critical path (see
  // docs/adr/0007-llm-generated-chat-titles.md) — the sidebar shows the
  // truncated-text title immediately, and this replaces it once the Model
  // responds. A failure here (e.g. Ollama unreachable) is swallowed: the
  // fallback title stays and chat creation must not fail because of it.
  if (!isBlankMessage(text)) {
    after(async () => {
      try {
        const { baseUrl, model: modelName } = resolveOllamaConfig();
        const model = new ChatOllama({ baseUrl, model: modelName });
        const generatedTitle = await generateTitle(text, model);
        updateTitle(id, generatedTitle);
      } catch (error) {
        console.warn(`[chats] Failed to generate a title for chat ${id}:`, error);
      }
    });
  }

  return new Response(JSON.stringify({ id }), { status: 200 });
}

export async function GET() {
  return new Response(JSON.stringify(getChats()), { status: 200 });
}
