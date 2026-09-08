import type { Embeddings } from '@langchain/core/embeddings'
import type { DatabaseSync } from 'node:sqlite'
import { getDb } from '@/lib/db'
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
 * Runs the Ingestion pipeline once: parse the markdown documents, chunk
 * them, embed the chunks, and return a populated RagStore. Pure — does not
 * persist or cache its result; see saveChunks() to persist it and
 * getRagStore() for the cached, process-wide store read back from
 * persistence. Called only from scripts/ingest-documents.ts.
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

interface ChunkRow {
  document_id: string
  position: number
  content: string
  source_url: string | null
  embedding: string
}

/**
 * Replaces the persisted Vector store's contents with `store`'s current
 * (chunk, embedding) pairs. Called only from scripts/ingest-documents.ts —
 * see CONTEXT.md's Ingestion term.
 */
export function saveChunks(store: RagStore, db: DatabaseSync = getDb()): void {
  db.exec('DELETE FROM chunks')
  const insert = db.prepare(
    'INSERT INTO chunks (id, document_id, position, content, source_url, embedding) VALUES (?, ?, ?, ?, ?, ?)'
  )
  for (const { chunk, embedding } of store.list()) {
    insert.run(crypto.randomUUID(), chunk.documentId, chunk.index, chunk.content, chunk.sourceUrl ?? null, JSON.stringify(embedding))
  }
}

/**
 * Loads the persisted Vector store into a fresh in-memory RagStore for
 * similarity search. Warns (but doesn't throw) when nothing has been
 * ingested yet, so the server still boots and serves plain, ungrounded
 * replies — see CONTEXT.md's Vector store term.
 */
export function loadRagStore(db: DatabaseSync = getDb()): RagStore {
  const store = new RagStore()
  const rows = db.prepare('SELECT document_id, position, content, source_url, embedding FROM chunks').all() as unknown as ChunkRow[]

  if (rows.length === 0) {
    console.warn('[rag] Vector store is empty — run `npm run ingest-documents` to populate it.')
    return store
  }

  store.add(rows.map(row => ({
    chunk: {
      documentId: row.document_id,
      index: row.position,
      content: row.content,
      ...(row.source_url ? { sourceUrl: row.source_url } : {})
    },
    embedding: JSON.parse(row.embedding) as number[]
  })))

  return store
}

let ragStorePromise: Promise<RagStore> | null = null

/**
 * Loads the Vector store from persistence on first call and caches the
 * result for the server process's lifetime — never rebuilds it; the store
 * only changes via an explicit `npm run ingest-documents` run followed by a
 * server restart. See docs/adr/0006-sqlite-for-chat-and-vector-store-persistence.md.
 */
export function getRagStore(db: DatabaseSync = getDb()): Promise<RagStore> {
  if (!ragStorePromise) {
    ragStorePromise = Promise.resolve().then(() => loadRagStore(db))
  }
  return ragStorePromise
}
