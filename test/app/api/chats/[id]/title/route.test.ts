import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { startFakeOllama, successChunks, type FakeOllamaServer } from '../../../../../helpers/fake-ollama'
import { userMessage } from '../../../../../helpers/ui-messages'
import type { ChatWithMessages } from '@/lib/chat/chats'

const { getChat } = vi.hoisted(() => ({ getChat: vi.fn() }))
const { updateTitle } = vi.hoisted(() => ({ updateTitle: vi.fn() }))
const { after } = vi.hoisted(() => ({ after: vi.fn((callback: () => unknown) => callback()) }))

vi.mock('@/lib/chat/chats', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/chat/chats')>()),
  getChat,
  updateTitle
}))
vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/server')>()),
  after
}))

const { PATCH } = await import('@/app/api/chats/[id]/title/route')

const ORIGINAL_ENV = { ...process.env }

function patchTitle(id: string) {
  return PATCH(new Request(`http://localhost/api/chats/${id}/title`, { method: 'PATCH' }), { params: Promise.resolve({ id }) })
}

async function readAll(response: Response): Promise<string> {
  const reader = response.body!.getReader()
  const decoder = new TextDecoder()
  let text = ''
  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    text += decoder.decode(value, { stream: true })
  }
  return text
}

function chat(overrides: Partial<ChatWithMessages> = {}): ChatWithMessages {
  return {
    id: 'chat-1',
    title: 'Where does the owner li…',
    messages: [userMessage('u1', 'Where does the owner live? Tell me all about it in great detail please')],
    ...overrides
  }
}

describe('PATCH /api/chats/[id]/title', () => {
  const MODEL = 'custom-test-model'
  let ollama: FakeOllamaServer

  beforeEach(async () => {
    ollama = await startFakeOllama(() => ({ chunks: successChunks('Owner\'s hometown', MODEL) }))
    process.env.OLLAMA_BASE_URL = ollama.url
    process.env.OLLAMA_MODEL = MODEL
    getChat.mockReset().mockReturnValue(chat())
    updateTitle.mockReset()
    after.mockClear()
  })

  afterEach(async () => {
    await ollama.close()
    process.env = { ...ORIGINAL_ENV }
  })

  it('returns 404 when the chat does not exist', async () => {
    getChat.mockReturnValue(undefined)

    const response = await patchTitle('missing')

    expect(response.status).toBe(404)
  })

  it('returns 400 when the chat has no messages', async () => {
    getChat.mockReturnValue(chat({ messages: [] }))

    const response = await patchTitle('chat-1')

    expect(response.status).toBe(400)
  })

  it('streams the generated title text to the client', async () => {
    const response = await patchTitle('chat-1')

    expect(await readAll(response)).toBe('Owner\'s hometown')
  })

  it('summarizes the opening message, not the chat\'s current (possibly truncated) title', async () => {
    const response = await patchTitle('chat-1')
    await readAll(response)
    await after.mock.results[0]?.value

    const sent = ollama.requests[0]?.body.messages as { content: string }[]
    expect(sent[0]?.content).toBe('Where does the owner live? Tell me all about it in great detail please')
  })

  it('caps generation to a small token budget, as a backstop against the model ignoring the word-count instruction', async () => {
    const response = await patchTitle('chat-1')
    await readAll(response)

    expect(ollama.requests[0]?.body.options).toMatchObject({ num_predict: 20 })
  })

  it('persists the trimmed, length-capped title via after(), without blocking the response', async () => {
    const response = await patchTitle('chat-1')
    await readAll(response)
    await after.mock.results[0]?.value

    expect(after).toHaveBeenCalledTimes(1)
    expect(updateTitle).toHaveBeenCalledWith('chat-1', 'Owner\'s hometown')
  })

  it('caps an overly long generated title before persisting', async () => {
    ollama.setResponder(() => ({ chunks: successChunks('a'.repeat(100), MODEL) }))

    const response = await patchTitle('chat-1')
    await readAll(response)
    await after.mock.results[0]?.value

    expect(updateTitle).toHaveBeenCalledWith('chat-1', `${'a'.repeat(60)}…`)
  })

  it('leaves the fallback title in place, without throwing, when the model returns a blank reply', async () => {
    ollama.setResponder(() => ({ chunks: successChunks('   ', MODEL) }))

    const response = await patchTitle('chat-1')
    await readAll(response)
    await after.mock.results[0]?.value

    expect(updateTitle).not.toHaveBeenCalled()
  })

  it('leaves the fallback title in place, without throwing, when the model is unreachable', async () => {
    await ollama.close()

    const response = await patchTitle('chat-1')
    await readAll(response).catch(() => undefined)
    await after.mock.results[0]?.value

    expect(updateTitle).not.toHaveBeenCalled()
  })
})
