import { AIMessage, HumanMessage, SystemMessage } from '@langchain/core/messages'
import { ChatOllama } from '@langchain/ollama'
import { createUIMessageStream, createUIMessageStreamResponse } from 'ai'
import type { BaseMessage } from '@langchain/core/messages'
import type { UIMessage } from 'ai'
import { resolveOllamaConfig } from '@/lib/ollama/config'
import { createEmbeddings } from '@/lib/rag/embeddings'
import { getRagStore } from '@/lib/rag/index'
import { buildContextMessage, buildRetrievalQuery, chunksToSources, retrieveRelevantChunks } from '@/lib/rag/retrieval'

/**
 * Extracts the plain text of a message, ignoring any non-text parts.
 */
function extractText(message: UIMessage): string {
  return message.parts
    .filter(part => part.type === 'text')
    .map(part => part.text)
    .join('')
}

/**
 * Converts the visitor-visible transcript into the langchain messages sent to
 * the model. Any client-supplied 'system' role is dropped: the server is the
 * sole source of system messages (the RAG context below), so a spoofed system
 * turn from the client can't inject instructions.
 */
function toConversation(messages: UIMessage[]): BaseMessage[] {
  return messages
    .filter(message => message.role === 'user' || message.role === 'assistant')
    .map(message => message.role === 'user'
      ? new HumanMessage(extractText(message))
      : new AIMessage(extractText(message)))
}

export async function POST(request: Request) {
  const { messages } = await request.json() as { messages: UIMessage[] }

  // Conversational turn: the full visitor-visible transcript reaches the
  // model, not just the latest message.
  const conversation = toConversation(messages ?? [])
  const latestMessage = messages?.at(-1)
  const text = latestMessage ? extractText(latestMessage) : ''

  if (!text) {
    return new Response('No message provided', { status: 400 })
  }

  const { baseUrl, model: modelName } = resolveOllamaConfig()
  const model = new ChatOllama({ baseUrl, model: modelName })

  const stream = createUIMessageStream({
    execute: async ({ writer }) => {
      // RAG: ground the reply in the owner's documents when retrieval finds
      // anything relevant. A retrieval failure (e.g. embedding model
      // unreachable) is intentionally left to propagate to onError below,
      // rather than silently falling back to an ungrounded reply — see
      // docs/adr/0002-fail-closed-on-retrieval-errors.md.
      const store = await getRagStore()

      // Derive the Retrieval query from the full conversation, translated
      // to English: this resolves referential follow-ups (e.g. "and the
      // second one?") and lets a non-English visitor message still match
      // English Documents. Runs on every turn, including the first, since
      // translation is needed even for a lone non-English message — only
      // skipped when the store is empty (nothing to search) — see
      // docs/adr/0004-rewrite-retrieval-query-from-full-conversation.md.
      const retrievalQuery = store.size > 0
        ? await buildRetrievalQuery(conversation, model)
        : text

      const chunks = await retrieveRelevantChunks(retrievalQuery, { store, embeddings: createEmbeddings() })
      const contextMessage = buildContextMessage(chunks)

      const prompt: BaseMessage[] = contextMessage
        ? [new SystemMessage(contextMessage), ...conversation]
        : conversation

      const id = crypto.randomUUID()

      writer.write({ type: 'text-start', id })

      for await (const chunk of await model.stream(prompt)) {
        const delta = typeof chunk.content === 'string' ? chunk.content : ''
        if (delta) {
          writer.write({ type: 'text-delta', id, delta })
        }
      }

      writer.write({ type: 'text-end', id })

      // Sources: streamed only once the reply has fully finished, and only
      // for grounded turns — see CONTEXT.md's "Source" term.
      for (const source of chunksToSources(chunks)) {
        writer.write({ type: 'source-document', ...source })
      }
    },
    // Surface a clear error to the client (e.g. Ollama unreachable, model not
    // pulled, or a RAG retrieval failure) rather than hanging or failing silently.
    onError: error => error instanceof Error ? error.message : 'Failed to reach the model'
  })

  return createUIMessageStreamResponse({ stream })
}
