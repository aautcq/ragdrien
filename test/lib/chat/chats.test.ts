import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { DatabaseSync } from 'node:sqlite'
import { ChatOllama } from '@langchain/ollama'
import { createDb } from '@/lib/db'
import { createChat, generateTitle, getChat, getChats, saveMessages, updateTitle } from '@/lib/chat/chats'
import { assistantMessage, userMessage } from '../../helpers/ui-messages'
import { startFakeOllama, successChunks, type FakeOllamaServer } from '../../helpers/fake-ollama'

describe('createChat', () => {
  let db: DatabaseSync

  beforeEach(() => {
    db = createDb(':memory:')
  })

  it('persists a new chat with its opening message', () => {
    const chat = createChat('Where does the owner live?', db)

    const stored = getChat(chat.id, db)
    expect(stored?.messages).toEqual([userMessage(stored!.messages[0]!.id, 'Where does the owner live?')])
  })

  it('derives the title from the opening message, truncating long text', () => {
    const chat = createChat('a'.repeat(100), db)

    expect(chat.title).toBe(`${'a'.repeat(60)}…`)
  })

  it('falls back to "New Chat" for a blank opening message', () => {
    const chat = createChat('   ', db)

    expect(chat.title).toBe('New Chat')
  })
})

describe('getChats', () => {
  let db: DatabaseSync

  beforeEach(() => {
    db = createDb(':memory:')
  })

  it('returns every chat, most recently created first', () => {
    const first = createChat('first chat', db)
    const second = createChat('second chat', db)

    expect(getChats(db)).toEqual([
      { id: second.id, title: second.title },
      { id: first.id, title: first.title }
    ])
  })

  it('returns an empty array when no chats exist', () => {
    expect(getChats(db)).toEqual([])
  })
})

describe('getChat', () => {
  let db: DatabaseSync

  beforeEach(() => {
    db = createDb(':memory:')
  })

  it('returns undefined for an unknown id', () => {
    expect(getChat('missing', db)).toBeUndefined()
  })

  it('returns the chat with its messages in order', () => {
    const chat = createChat('hi', db)
    const opening = getChat(chat.id, db)!.messages[0]!
    saveMessages(chat.id, [opening, assistantMessage('a1', 'hello!')], db)

    const stored = getChat(chat.id, db)

    expect(stored?.id).toBe(chat.id)
    expect(stored?.messages).toEqual([opening, assistantMessage('a1', 'hello!')])
  })
})

describe('saveMessages', () => {
  let db: DatabaseSync

  beforeEach(() => {
    db = createDb(':memory:')
  })

  it('replaces the entire persisted transcript', () => {
    const chat = createChat('hi', db)

    saveMessages(chat.id, [userMessage('u1', 'hi'), assistantMessage('a1', 'hello!')], db)
    expect(getChat(chat.id, db)?.messages).toEqual([userMessage('u1', 'hi'), assistantMessage('a1', 'hello!')])

    saveMessages(chat.id, [userMessage('u1', 'hi'), assistantMessage('a1', 'hello!'), userMessage('u2', 'and you?')], db)
    expect(getChat(chat.id, db)?.messages).toEqual([
      userMessage('u1', 'hi'),
      assistantMessage('a1', 'hello!'),
      userMessage('u2', 'and you?')
    ])
  })
})

async function readAll(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader()
  const decoder = new TextDecoder()
  let text = ''
  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    text += decoder.decode(value, { stream: true })
  }
  return text
}

describe('generateTitle', () => {
  const MODEL = 'test-model'
  let ollama: FakeOllamaServer

  beforeEach(async () => {
    ollama = await startFakeOllama(() => ({ chunks: successChunks('Owner\'s hometown', MODEL) }))
  })

  afterEach(async () => {
    await ollama.close()
  })

  it('streams the model\'s summary of the message as text chunks', async () => {
    const model = new ChatOllama({ baseUrl: ollama.url, model: MODEL })

    const title = await readAll(generateTitle('Where does the owner live?', model))

    expect(title).toBe('Owner\'s hometown')
  })

  it('sends the message text plus a summarization instruction to the model', async () => {
    const model = new ChatOllama({ baseUrl: ollama.url, model: MODEL })

    await readAll(generateTitle('Where does the owner live?', model))

    const sent = ollama.requests[0]?.body.messages as { content: string }[]
    expect(sent[0]?.content).toBe('Where does the owner live?')
    expect(sent).toHaveLength(2)
  })
})

describe('updateTitle', () => {
  let db: DatabaseSync

  beforeEach(() => {
    db = createDb(':memory:')
  })

  it('replaces the persisted title for the given chat', () => {
    const chat = createChat('hi', db)

    updateTitle(chat.id, 'A better title', db)

    expect(getChats(db)).toEqual([{ id: chat.id, title: 'A better title' }])
  })
})
