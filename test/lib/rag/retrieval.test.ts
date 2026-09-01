import type { Embeddings } from '@langchain/core/embeddings'
import type { BaseChatModel } from '@langchain/core/language_models/chat_models'
import { AIMessage, HumanMessage } from '@langchain/core/messages'
import { describe, expect, it } from 'vitest'
import { RagStore } from '@/lib/rag/store'
import { buildContextMessage, buildRetrievalQuery, chunksToSources, retrieveRelevantChunks } from '@/lib/rag/retrieval'

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

describe('buildRetrievalQuery', () => {
  function fakeModel(reply: string): { model: BaseChatModel, invokedWith: () => unknown[] } {
    let invokedWith: unknown[] = []
    const model = {
      invoke: async (messages: unknown[]) => {
        invokedWith = messages
        return { content: reply }
      }
    } as unknown as BaseChatModel
    return { model, invokedWith: () => invokedWith }
  }

  it('returns the model\'s rewritten, trimmed standalone question', async () => {
    const { model } = fakeModel('  Where does the owner live?  ')

    const query = await buildRetrievalQuery(
      [new HumanMessage('Where does the owner live?'), new AIMessage('Belgium.'), new HumanMessage('and the second one?')],
      model
    )

    expect(query).toBe('Where does the owner live?')
  })

  it('sends the full conversation plus a rewrite instruction to the model', async () => {
    const { model, invokedWith } = fakeModel('rewritten')
    const conversation = [new HumanMessage('first'), new AIMessage('reply'), new HumanMessage('and the second one?')]

    await buildRetrievalQuery(conversation, model)

    const sent = invokedWith()
    expect(sent.slice(0, conversation.length)).toEqual(conversation)
    expect(sent).toHaveLength(conversation.length + 1)
  })
})

describe('chunksToSources', () => {
  it('returns nothing for no chunks', () => {
    expect(chunksToSources([])).toEqual([])
  })

  it('collapses multiple chunks from the same document into a single source', () => {
    const sources = chunksToSources([chunk('a.md', 0), chunk('a.md', 1)])

    expect(sources).toEqual([{ sourceId: 'a.md', mediaType: 'text/markdown', title: 'a.md' }])
  })

  it('keeps one source per distinct document, ordered by first (best-scoring) occurrence', () => {
    const sources = chunksToSources([chunk('b.md', 0), chunk('a.md', 0), chunk('b.md', 1)])

    expect(sources).toEqual([
      { sourceId: 'b.md', mediaType: 'text/markdown', title: 'b.md' },
      { sourceId: 'a.md', mediaType: 'text/markdown', title: 'a.md' }
    ])
  })

  it('labels PDF sources with the application/pdf media type', () => {
    const sources = chunksToSources([chunk('resume.pdf', 0)])

    expect(sources).toEqual([{ sourceId: 'resume.pdf', mediaType: 'application/pdf', title: 'resume.pdf' }])
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
