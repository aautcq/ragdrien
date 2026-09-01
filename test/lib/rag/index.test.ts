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

  it('builds the store once and caches it across calls', async () => {
    const { getRagStore } = await import('@/lib/rag/index')

    // Use an empty documents dir and no embeddings client: keeps this test
    // hermetic (independent of real Ollama and whatever's really under
    // lib/rag/documents/) since it only cares about the caching behavior.
    const dir = await mkdtemp(join(tmpdir(), 'ragdrien-rag-'))
    try {
      const first = await getRagStore({ documentsDir: dir })
      const second = await getRagStore({ documentsDir: dir })

      expect(second).toBe(first)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })

  it('retries on the next call instead of caching a failed build', async () => {
    const { getRagStore } = await import('@/lib/rag/index')

    const dir = await mkdtemp(join(tmpdir(), 'ragdrien-rag-'))
    try {
      await writeFile(join(dir, 'about.md'), '# About\n\nA short paragraph about the owner.')

      let attempt = 0
      const embeddings = {
        embedDocuments: async (texts: string[]) => {
          attempt++
          if (attempt === 1) {
            throw new Error('transient failure')
          }
          return texts.map(() => [1, 0, 0])
        }
      } as unknown as Embeddings

      await expect(getRagStore({ documentsDir: dir, embeddings })).rejects.toThrow('transient failure')

      const store = await getRagStore({ documentsDir: dir, embeddings })

      expect(store.size).toBe(1)
      expect(attempt).toBe(2)
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
})
