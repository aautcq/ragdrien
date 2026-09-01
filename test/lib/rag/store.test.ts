import { describe, expect, it } from 'vitest'
import { RagStore } from '@/lib/rag/store'

function chunk(documentId: string, index: number) {
  return { documentId, index, content: `${documentId}#${index}` }
}

describe('RagStore', () => {
  it('starts empty', () => {
    expect(new RagStore().size).toBe(0)
  })

  it('grows as entries are added', () => {
    const store = new RagStore()
    store.add([{ chunk: chunk('a.md', 0), embedding: [1, 0] }])
    store.add([{ chunk: chunk('a.md', 1), embedding: [0, 1] }])

    expect(store.size).toBe(2)
  })

  it('ranks matches by cosine similarity to the query, most similar first', () => {
    const store = new RagStore()
    store.add([
      { chunk: chunk('a.md', 0), embedding: [1, 0] },
      { chunk: chunk('a.md', 1), embedding: [0, 1] },
      { chunk: chunk('a.md', 2), embedding: [0.9, 0.1] }
    ])

    const matches = store.similaritySearch([1, 0], 2)

    expect(matches.map(match => match.chunk)).toEqual([chunk('a.md', 0), chunk('a.md', 2)])
    expect(matches[0]?.score).toBeGreaterThan(matches[1]?.score ?? Infinity)
  })

  it('treats a zero-magnitude embedding as zero similarity, rather than dividing by zero', () => {
    const store = new RagStore()
    store.add([{ chunk: chunk('a.md', 0), embedding: [0, 0] }])

    expect(store.similaritySearch([1, 0])).toEqual([{ chunk: chunk('a.md', 0), score: 0 }])
  })
})
