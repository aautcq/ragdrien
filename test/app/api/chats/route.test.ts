import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { startFakeOllama, successChunks, type FakeOllamaServer } from '../../../helpers/fake-ollama'

const { createChat } = vi.hoisted(() => ({ createChat: vi.fn() }))
const { updateTitle } = vi.hoisted(() => ({ updateTitle: vi.fn() }))
const { after } = vi.hoisted(() => ({ after: vi.fn((callback: () => unknown) => callback()) }))

vi.mock('@/lib/chat/chats', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/chat/chats')>()),
  createChat,
  updateTitle
}))
vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/server')>()),
  after
}))

const { POST } = await import('@/app/api/chats/route')

const ORIGINAL_ENV = { ...process.env }

function postChats(body: unknown) {
  return POST(new Request('http://localhost/api/chats', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  }))
}

describe('POST /api/chats', () => {
  const MODEL = 'custom-test-model'
  let ollama: FakeOllamaServer

  beforeEach(async () => {
    ollama = await startFakeOllama(() => ({ chunks: successChunks('A short title', MODEL) }))
    process.env.OLLAMA_BASE_URL = ollama.url
    process.env.OLLAMA_MODEL = MODEL
    createChat.mockReset().mockReturnValue({ id: 'chat-1', title: 'Fallback title' })
    updateTitle.mockReset()
    after.mockClear()
  })

  afterEach(async () => {
    await ollama.close()
    process.env = { ...ORIGINAL_ENV }
  })

  it('returns the new chat id from the synchronous, truncated-text title', async () => {
    const response = await postChats({ text: 'Where does the owner live?' })
    await after.mock.results[0]?.value

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ id: 'chat-1' })
    expect(createChat).toHaveBeenCalledWith('Where does the owner live?')
  })

  it('schedules an LLM title update via after(), without blocking the response', async () => {
    await postChats({ text: 'Where does the owner live?' })
    await after.mock.results[0]?.value

    expect(after).toHaveBeenCalledTimes(1)
    expect(updateTitle).toHaveBeenCalledWith('chat-1', 'A short title')
  })

  it('leaves the fallback title in place, without throwing, when the model is unreachable', async () => {
    await ollama.close()

    await postChats({ text: 'Where does the owner live?' })
    await after.mock.results[0]?.value

    expect(updateTitle).not.toHaveBeenCalled()
  })

  it('skips title generation entirely for a blank message', async () => {
    await postChats({ text: '   ' })

    expect(after).not.toHaveBeenCalled()
  })
})
