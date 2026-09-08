import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Embeddings } from '@langchain/core/embeddings'
import { OllamaEmbeddings } from '@langchain/ollama'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { startFakeOllama } from '../../helpers/fake-ollama'
import { buildRagStore } from '@/lib/rag/index'

describe('buildRagStore', () => {
  let dir: string | undefined

  afterEach(async () => {
    if (dir) {
      await rm(dir, { recursive: true, force: true })
      dir = undefined
    }
  })

  it('returns an empty store and warns when no documents are found', async () => {
    dir = await mkdtemp(join(tmpdir(), 'ragdrien-rag-'))
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const store = await buildRagStore({ documentsDir: dir })

    expect(store.size).toBe(0)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('No documents found'))

    warn.mockRestore()
  })

  it('parses, chunks and embeds every document into the store', async () => {
    dir = await mkdtemp(join(tmpdir(), 'ragdrien-rag-'))
    await writeFile(join(dir, 'about.md'), '# About\n\nA short paragraph about the owner.')

    const ollama = await startFakeOllama(body => ({
      json: { embeddings: (body.input as string[]).map(() => [1, 0, 0]) }
    }))

    try {
      const embeddings = new OllamaEmbeddings({ baseUrl: ollama.url, model: 'test-embed' })
      const store = await buildRagStore({ documentsDir: dir, embeddings })

      expect(store.size).toBe(1)
      expect(store.similaritySearch([1, 0, 0], 1)).toEqual([
        { chunk: { documentId: 'about.md', index: 0, content: '# About\n\nA short paragraph about the owner.' }, score: 1 }
      ])
    } finally {
      await ollama.close()
    }
  })
  it('throws when the embeddings client returns a different number of vectors than chunks', async () => {
    dir = await mkdtemp(join(tmpdir(), 'ragdrien-rag-'))
    await writeFile(join(dir, 'about.md'), '# About\n\nA short paragraph about the owner.')

    const embeddings = {
      embedDocuments: async () => [[1, 0, 0], [0, 1, 0]] // 2 vectors for 1 chunk
    } as unknown as Embeddings

    await expect(buildRagStore({ documentsDir: dir, embeddings })).rejects.toThrow(/returned 2 vectors for 1 chunks/)
  })
})

describe('getRagStore', () => {
  beforeEach(() => {
    // Each test needs a fresh module-level cache (getRagStore's singleton),
    // so re-import the module after resetting vitest's module registry.
    vi.resetModules()
  })

  it('loads whatever is persisted in the database', async () => {
    const { createDb } = await import('@/lib/db')
    const { saveChunks, getRagStore } = await import('@/lib/rag/index')
    const { RagStore } = await import('@/lib/rag/store')

    const db = createDb(':memory:')
    const store = new RagStore()
    store.add([{ chunk: { documentId: 'about.md', index: 0, content: 'hello' }, embedding: [1, 0, 0] }])
    saveChunks(store, db)

    const loaded = await getRagStore(db)

    expect(loaded.size).toBe(1)
    expect(loaded.similaritySearch([1, 0, 0], 1)).toEqual([
      { chunk: { documentId: 'about.md', index: 0, content: 'hello' }, score: 1 }
    ])
  })

  it('warns and returns an empty store when nothing has been ingested yet', async () => {
    const { createDb } = await import('@/lib/db')
    const { getRagStore } = await import('@/lib/rag/index')

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const db = createDb(':memory:')

    const store = await getRagStore(db)

    expect(store.size).toBe(0)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('ingest-documents'))

    warn.mockRestore()
  })

  it('caches the loaded store across calls', async () => {
    const { createDb } = await import('@/lib/db')
    const { getRagStore } = await import('@/lib/rag/index')

    const db = createDb(':memory:')

    const first = await getRagStore(db)
    const second = await getRagStore(db)

    expect(second).toBe(first)
  })
})

describe('saveChunks', () => {
  it('replaces the persisted chunks with the store\'s current contents', async () => {
    const { createDb } = await import('@/lib/db')
    const { saveChunks, loadRagStore } = await import('@/lib/rag/index')
    const { RagStore } = await import('@/lib/rag/store')

    const db = createDb(':memory:')

    const first = new RagStore()
    first.add([{ chunk: { documentId: 'about.md', index: 0, content: 'old' }, embedding: [1, 0] }])
    saveChunks(first, db)

    const second = new RagStore()
    second.add([{ chunk: { documentId: 'profile.md', index: 0, content: 'new', sourceUrl: 'https://example.com' }, embedding: [0, 1] }])
    saveChunks(second, db)

    const loaded = loadRagStore(db)
    expect(loaded.size).toBe(1)
    expect(loaded.similaritySearch([0, 1], 1)).toEqual([
      { chunk: { documentId: 'profile.md', index: 0, content: 'new', sourceUrl: 'https://example.com' }, score: 1 }
    ])
  })
})
