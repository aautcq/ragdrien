import { beforeEach, describe, expect, it } from 'vitest'
import type { DatabaseSync } from 'node:sqlite'
import type { BaseChatModel } from '@langchain/core/language_models/chat_models'
import { createDb } from '@/lib/db'
import { createChat, generateTitle, getChat, getChats, saveMessages, updateTitle } from '@/lib/chat/chats'
import { assistantMessage, userMessage } from '../../helpers/ui-messages'

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

describe('generateTitle', () => {
  it('returns the model\'s trimmed summary of the message', async () => {
    const { model } = fakeModel('  Owner\'s hometown  ')

    const title = await generateTitle('Where does the owner live?', model)

    expect(title).toBe('Owner\'s hometown')
  })

  it('sends the message text plus a summarization instruction to the model', async () => {
    const { model, invokedWith } = fakeModel('Some title')

    await generateTitle('Where does the owner live?', model)

    const sent = invokedWith() as { content: string }[]
    expect(sent[0]?.content).toBe('Where does the owner live?')
    expect(sent).toHaveLength(2)
  })

  it('truncates a model reply longer than the sidebar title limit', async () => {
    const { model } = fakeModel('a'.repeat(100))

    const title = await generateTitle('hi', model)

    expect(title).toBe(`${'a'.repeat(60)}…`)
  })

  it('throws when the model returns a blank reply, so callers keep the fallback title', async () => {
    const { model } = fakeModel('   ')

    await expect(generateTitle('hi', model)).rejects.toThrow()
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
