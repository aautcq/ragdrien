import type { Embeddings } from '@langchain/core/embeddings'
import type { RagChunk } from './chunker'
import type { RagStore } from './store'

/** Default number of candidate chunks pulled from the store before filtering by relevance. */
const DEFAULT_K = 4

/** Minimum cosine similarity a chunk must reach to be considered relevant enough to inject. */
export const RELEVANCE_THRESHOLD = 0.5

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
