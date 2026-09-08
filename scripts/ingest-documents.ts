import { buildRagStore, saveChunks } from '@/lib/rag/index'

/**
 * Runs Ingestion end-to-end: parses lib/rag/documents/, chunks and embeds
 * them, then replaces the persisted Vector store with the result. Never
 * run automatically by the server — invoke explicitly whenever Documents
 * change, then restart the server to pick up the change. See CONTEXT.md's
 * Ingestion term and docs/adr/0006-sqlite-for-chat-and-vector-store-persistence.md.
 */
async function main() {
  const store = await buildRagStore()
  saveChunks(store)
  console.log(`[ingest-documents] Wrote ${store.size} chunk(s) to the Vector store.`)
}

main().catch((error) => {
  console.error('[ingest-documents] Failed:', error)
  process.exitCode = 1
})
