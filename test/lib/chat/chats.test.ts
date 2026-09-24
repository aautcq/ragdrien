import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import type { DatabaseSync } from 'node:sqlite'
import { ChatOllama } from '@langchain/ollama'
import { createDb } from '@/lib/db'
import { createChat, deleteChat, generateTitle, getChat, getChats, saveMessages, updateTitle } from '@/lib/chat/chats'
import { assistantMessage, userMessage } from '../../helpers/ui-messages'
import { startFakeOllama, successChunks, type FakeOllamaServer } from '../../helpers/fake-ollama'

const VISITOR = 'visitor-1'
const OTHER_VISITOR = 'visitor-2'

describe('createChat', () => {
  let db: DatabaseSync

  beforeEach(() => {
    db = createDb(':memory:')
  })

  it('persists a new chat with its opening message', () => {
    const chat = createChat('Where does the owner live?', VISITOR, db)

    const stored = getChat(chat.id, VISITOR, db)
    expect(stored?.messages).toEqual([userMessage(stored!.messages[0]!.id, 'Where does the owner live?')])
  })

  it('derives the title from the opening message, truncating long text', () => {
    const chat = createChat('a'.repeat(100), VISITOR, db)

    expect(chat.title).toBe(`${'a'.repeat(60)}…`)
  })

  it('falls back to "New Chat" for a blank opening message', () => {
    const chat = createChat('   ', VISITOR, db)

    expect(chat.title).toBe('New Chat')
  })
})

describe('getChats', () => {
  let db: DatabaseSync

  beforeEach(() => {
    db = createDb(':memory:')
  })

  it('returns every chat for the given visitor, most recently created first', () => {
    const first = createChat('first chat', VISITOR, db)
    const second = createChat('second chat', VISITOR, db)

    expect(getChats(VISITOR, db)).toEqual([
      { id: second.id, title: second.title },
      { id: first.id, title: first.title }
    ])
  })

  it('returns an empty array when no chats exist', () => {
    expect(getChats(VISITOR, db)).toEqual([])
  })

  it('never returns another visitor\'s chats', () => {
    createChat('someone else\'s chat', OTHER_VISITOR, db)

    expect(getChats(VISITOR, db)).toEqual([])
  })
})

describe('getChat', () => {
  let db: DatabaseSync

  beforeEach(() => {
    db = createDb(':memory:')
  })

  it('returns undefined for an unknown id', () => {
    expect(getChat('missing', VISITOR, db)).toBeUndefined()
  })

  it('returns the chat with its messages in order', () => {
    const chat = createChat('hi', VISITOR, db)
    const opening = getChat(chat.id, VISITOR, db)!.messages[0]!
    saveMessages(chat.id, VISITOR, [opening, assistantMessage('a1', 'hello!')], db)

    const stored = getChat(chat.id, VISITOR, db)

    expect(stored?.id).toBe(chat.id)
    expect(stored?.messages).toEqual([opening, assistantMessage('a1', 'hello!')])
  })

  it('returns undefined for a chat owned by a different visitor', () => {
    const chat = createChat('someone else\'s chat', OTHER_VISITOR, db)

    expect(getChat(chat.id, VISITOR, db)).toBeUndefined()
  })
})

describe('saveMessages', () => {
  let db: DatabaseSync

  beforeEach(() => {
    db = createDb(':memory:')
  })

  it('replaces the entire persisted transcript', () => {
    const chat = createChat('hi', VISITOR, db)

    saveMessages(chat.id, VISITOR, [userMessage('u1', 'hi'), assistantMessage('a1', 'hello!')], db)
    expect(getChat(chat.id, VISITOR, db)?.messages).toEqual([userMessage('u1', 'hi'), assistantMessage('a1', 'hello!')])

    saveMessages(chat.id, VISITOR, [userMessage('u1', 'hi'), assistantMessage('a1', 'hello!'), userMessage('u2', 'and you?')], db)
    expect(getChat(chat.id, VISITOR, db)?.messages).toEqual([
      userMessage('u1', 'hi'),
      assistantMessage('a1', 'hello!'),
      userMessage('u2', 'and you?')
    ])
  })

  it('does not touch another visitor\'s chat', () => {
    const chat = createChat('hi', OTHER_VISITOR, db)
    const originalMessages = getChat(chat.id, OTHER_VISITOR, db)!.messages

    saveMessages(chat.id, VISITOR, [userMessage('u1', 'hijacked'), assistantMessage('a1', 'hijacked')], db)

    expect(getChat(chat.id, OTHER_VISITOR, db)?.messages).toEqual(originalMessages)
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
    const chat = createChat('hi', VISITOR, db)

    updateTitle(chat.id, VISITOR, 'A better title', db)

    expect(getChats(VISITOR, db)).toEqual([{ id: chat.id, title: 'A better title' }])
  })

  it('does not touch another visitor\'s chat title', () => {
    const chat = createChat('hi', OTHER_VISITOR, db)

    updateTitle(chat.id, VISITOR, 'hijacked title', db)

    expect(getChats(OTHER_VISITOR, db)).toEqual([{ id: chat.id, title: chat.title }])
  })
})

describe('deleteChat', () => {
  let db: DatabaseSync

  beforeEach(() => {
    db = createDb(':memory:')
  })

  it('deletes the chat and its messages, returning true', () => {
    const chat = createChat('hi', VISITOR, db)

    expect(deleteChat(chat.id, VISITOR, db)).toBe(true)
    expect(getChat(chat.id, VISITOR, db)).toBeUndefined()
  })

  it('returns false and leaves another visitor\'s chat untouched', () => {
    const chat = createChat('hi', OTHER_VISITOR, db)

    expect(deleteChat(chat.id, VISITOR, db)).toBe(false)
    expect(getChat(chat.id, OTHER_VISITOR, db)).toBeDefined()
  })

  it('returns false for an unknown id', () => {
    expect(deleteChat('missing', VISITOR, db)).toBe(false)
  })
})
