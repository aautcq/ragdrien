import type { Embeddings } from '@langchain/core/embeddings'
import type { BaseChatModel } from '@langchain/core/language_models/chat_models'
import { HumanMessage } from '@langchain/core/messages'
import type { BaseMessage } from '@langchain/core/messages'
import type { RagChunk } from './chunker'
import type { RagStore } from './store'

/** Default number of candidate chunks pulled from the store before filtering by relevance. */
const DEFAULT_K = 4

/** Minimum cosine similarity a chunk must reach to be considered relevant enough to inject. */
export const RELEVANCE_THRESHOLD = 0.5

/**
 * Appended to the conversation to have the Model rewrite the visitor's
 * latest message as a standalone, English question: standalone so
 * references to earlier turns (e.g. "and the second one?") resolve before
 * the message is embedded, and English because Documents are always
 * English while a visitor may write in any language — embedding a
 * non-English query against English Chunks would otherwise score poorly
 * against the Relevance threshold regardless of topical relevance.
 */
const REWRITE_INSTRUCTION = 'Rewrite the visitor\'s most recent message above as a single, standalone question '
  + 'in English that captures its full meaning without depending on the earlier turns (resolve any pronouns or '
  + 'references such as "it" or "the second one", and translate it to English if it isn\'t already). Respond with '
  + 'only the rewritten question, nothing else.'

/**
 * Derives the Retrieval query by asking the Model to condense the whole
 * conversation into a standalone English question. Callers are expected to
 * skip this (using the latest message as-is) when the store is empty,
 * since there's nothing to search — see app/api/chat/route.ts. Unlike that
 * skip, this always runs otherwise, even on the first turn, since a
 * non-English first message still needs translating before embedding.
 */
export async function buildRetrievalQuery(conversation: BaseMessage[], model: BaseChatModel): Promise<string> {
  const response = await model.invoke([...conversation, new HumanMessage(REWRITE_INSTRUCTION)])
  return typeof response.content === 'string' ? response.content.trim() : ''
}

export interface RetrieveRelevantChunksOptions {
  store: RagStore
  embeddings: Embeddings
  k?: number
  threshold?: number
}

/**
 * Embeds the visitor's query and returns the store's matching chunks that
 * clear the relevance threshold, most similar first. Returns an empty array
 * without embedding anything when the store has no entries yet (nothing to
 * search), so callers can skip retrieval entirely for an empty store.
 */
export async function retrieveRelevantChunks(
  query: string,
  { store, embeddings, k = DEFAULT_K, threshold = RELEVANCE_THRESHOLD }: RetrieveRelevantChunksOptions
): Promise<RagChunk[]> {
  if (store.size === 0) {
    return []
  }

  const queryEmbedding = await embeddings.embedQuery(query)

  return store.similaritySearch(queryEmbedding, k)
    .filter(match => match.score >= threshold)
    .map(match => match.chunk)
}

export interface SourceDocument {
  sourceId: string
  mediaType: string
  title: string
}

/**
 * Reduces retrieved chunks to their contributing Source Documents.
 */
export function chunksToSources(chunks: RagChunk[]): SourceDocument[] {
  const seenDocumentIds = new Set<string>()
  const sources: SourceDocument[] = []

  for (const chunk of chunks) {
    if (seenDocumentIds.has(chunk.documentId)) {
      continue
    }
    seenDocumentIds.add(chunk.documentId)
    sources.push({
      sourceId: chunk.documentId,
      mediaType: chunk.documentId.endsWith('.pdf') ? 'application/pdf' : 'text/markdown',
      title: chunk.documentId
    })
  }

  return sources
}

/**
 * Builds the grounding context to inject as a system message, or null when
 * there are no chunks to inject (empty store, or nothing cleared the
 * relevance threshold) — signalling callers to fall back to a plain,
 * ungrounded turn instead of sending an empty/pointless system message.
 */
export function buildContextMessage(chunks: RagChunk[]): string | null {
  if (chunks.length === 0) {
    return null
  }

  const context = chunks.map(chunk => chunk.content).join('\n\n')

  return `Use the following context about the site owner to answer the visitor's question. If the context doesn't help, answer from your own knowledge.\n\n${context}`
}
