import type { Embeddings } from '@langchain/core/embeddings'
import { describe, expect, it } from 'vitest'
import { RagStore } from '@/lib/rag/store'
import { buildContextMessage, retrieveRelevantChunks } from '@/lib/rag/retrieval'

function chunk(documentId: string, index: number, content = `${documentId}#${index}`) {
  return { documentId, index, content }
}

function fakeEmbeddings(embedQueryResult: number[]): Embeddings {
  return { embedQuery: async () => embedQueryResult } as unknown as Embeddings
}

describe('retrieveRelevantChunks', () => {
  it('returns nothing without embedding the query when the store is empty', async () => {
    const store = new RagStore()
    let embedQueryCalled = false
    const embeddings = { embedQuery: async () => { embedQueryCalled = true; return [1, 0] } } as unknown as Embeddings

    const chunks = await retrieveRelevantChunks('hello', { store, embeddings })

    expect(chunks).toEqual([])
    expect(embedQueryCalled).toBe(false)
  })

  it('returns matches that clear the relevance threshold, most similar first', async () => {
    const store = new RagStore()
    store.add([
      { chunk: chunk('a.md', 0), embedding: [1, 0] },
      { chunk: chunk('a.md', 1), embedding: [0, 1] }
    ])

    const chunks = await retrieveRelevantChunks('hello', { store, embeddings: fakeEmbeddings([1, 0]) })

    expect(chunks).toEqual([chunk('a.md', 0)])
  })

  it('discards matches below the relevance threshold', async () => {
    const store = new RagStore()
    store.add([{ chunk: chunk('a.md', 0), embedding: [0, 1] }]) // orthogonal to the query -> score 0

    const chunks = await retrieveRelevantChunks('hello', { store, embeddings: fakeEmbeddings([1, 0]) })

    expect(chunks).toEqual([])
  })

  it('respects a custom threshold and k', async () => {
    const store = new RagStore()
    store.add([
      { chunk: chunk('a.md', 0), embedding: [1, 0] },
      { chunk: chunk('a.md', 1), embedding: [0.9, 0.1] },
      { chunk: chunk('a.md', 2), embedding: [0.5, 0.5] }
    ])

    const chunks = await retrieveRelevantChunks('hello', {
      store,
      embeddings: fakeEmbeddings([1, 0]),
      k: 1,
      threshold: 0
    })

    expect(chunks).toEqual([chunk('a.md', 0)])
  })
})

describe('buildContextMessage', () => {
  it('returns null for no chunks, so callers can fall back to an ungrounded turn', () => {
    expect(buildContextMessage([])).toBeNull()
  })

  it('joins chunk content into a single grounding system message', () => {
    const message = buildContextMessage([chunk('a.md', 0, 'first'), chunk('a.md', 1, 'second')])

    expect(message).toContain('first')
    expect(message).toContain('second')
    expect(message).toMatch(/first[\s\S]*second/)
  })
})
