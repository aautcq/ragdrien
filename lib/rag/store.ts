import type { RagChunk } from './chunker'

export interface RagStoreEntry {
  chunk: RagChunk
  embedding: number[]
}

export interface RagStoreMatch {
  chunk: RagChunk
  score: number
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0
  let normA = 0
  let normB = 0

  for (let i = 0; i < a.length; i++) {
    const x = a[i] ?? 0
    const y = b[i] ?? 0
    dot += x * y
    normA += x * x
    normB += y * y
  }

  if (normA === 0 || normB === 0) {
    return 0
  }

  return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

/**
 * A minimal in-memory vector index: holds (chunk, embedding) pairs for the
 * lifetime of the server process and answers similarity queries over them.
 * The source of truth is the SQLite chunks table (see loadRagStore/saveChunks
 * in lib/rag/index.ts) — this class itself holds no persistence logic.
 */
export class RagStore {
  private entries: RagStoreEntry[] = []

  add(entries: RagStoreEntry[]): void {
    this.entries.push(...entries)
  }

  get size(): number {
    return this.entries.length
  }

  /** Returns every (chunk, embedding) pair currently in the store — used to persist it (see Ingestion). */
  list(): RagStoreEntry[] {
    return [...this.entries]
  }

  /** Returns the k entries whose embeddings are most similar to queryEmbedding. */
  similaritySearch(queryEmbedding: number[], k = 4): RagStoreMatch[] {
    return this.entries
      .map(entry => ({ chunk: entry.chunk, score: cosineSimilarity(queryEmbedding, entry.embedding) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, k)
  }
}
