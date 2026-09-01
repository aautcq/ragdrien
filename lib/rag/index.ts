import type { Embeddings } from '@langchain/core/embeddings'
import { chunkDocument } from './chunker'
import { loadDocuments } from './documents'
import { createEmbeddings } from './embeddings'
import { RagStore } from './store'

export interface BuildRagStoreOptions {
  /** Overrides where markdown source files are read from. Defaults to lib/rag/documents/. */
  documentsDir?: string
  /** Overrides the embeddings client. Defaults to the configured OllamaEmbeddings. */
  embeddings?: Embeddings
}

/**
 * Runs the ingestion pipeline once: parse the markdown documents, chunk
 * them, embed the chunks, and return a populated RagStore. Pure — does not
 * cache its result; see getRagStore() for the cached, process-wide store.
 */
export async function buildRagStore(options: BuildRagStoreOptions = {}): Promise<RagStore> {
  const store = new RagStore()
  const documents = await loadDocuments(options.documentsDir)

  if (documents.length === 0) {
    console.warn('[rag] No documents found in lib/rag/documents/ — starting with an empty vector store.')
    return store
  }

  const chunks = (await Promise.all(documents.map(chunkDocument))).flat()
  const embeddings = options.embeddings ?? createEmbeddings()
  const vectors = await embeddings.embedDocuments(chunks.map(chunk => chunk.content))

  if (vectors.length !== chunks.length) {
    throw new Error(`[rag] Embeddings client returned ${vectors.length} vectors for ${chunks.length} chunks`)
  }

  store.add(chunks.map((chunk, i) => ({ chunk, embedding: vectors[i]! })))

  return store
}

let ragStorePromise: Promise<RagStore> | null = null

/**
 * Builds the RAG vector store on first call and caches the result for the
 * server process's lifetime (safe under Next.js's default node runtime: one
 * long-running process, not multiple serverless instances). Concurrent
 * callers before the first build finishes await the same in-flight build. A
 * failed build is not cached — it's retried on the next call, so a
 * transient failure (e.g. Ollama unreachable) doesn't permanently break RAG
 * until a restart.
 */
export function getRagStore(options: BuildRagStoreOptions = {}): Promise<RagStore> {
  if (!ragStorePromise) {
    ragStorePromise = buildRagStore(options).catch((error) => {
      ragStorePromise = null
      throw error
    })
  }
  return ragStorePromise
}
