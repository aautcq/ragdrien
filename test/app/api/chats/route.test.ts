import { beforeEach, describe, expect, it, vi } from 'vitest'

const { createChat, getChats } = vi.hoisted(() => ({ createChat: vi.fn(), getChats: vi.fn() }))

vi.mock('@/lib/chat/chats', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/chat/chats')>()),
  createChat,
  getChats
}))

const { GET, POST } = await import('@/app/api/chats/route')

function postChats(body: unknown) {
  return POST(new Request('http://localhost/api/chats', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: 'visitor_id=visitor-1' },
    body: JSON.stringify(body)
  }))
}

function getChatsRequest() {
  return GET(new Request('http://localhost/api/chats', { headers: { Cookie: 'visitor_id=visitor-1' } }))
}

describe('POST /api/chats', () => {
  beforeEach(() => {
    createChat.mockReset().mockReturnValue({ id: 'chat-1', title: 'Fallback title' })
  })

  it('creates a chat from the given text, owned by the requesting visitor, and returns its id', async () => {
    const response = await postChats({ text: 'Where does the owner live?' })

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ id: 'chat-1' })
    expect(createChat).toHaveBeenCalledWith('Where does the owner live?', 'visitor-1')
  })
})

describe('GET /api/chats', () => {
  beforeEach(() => {
    getChats.mockReset().mockReturnValue([{ id: 'chat-1', title: 'A chat' }])
  })

  it('returns every chat owned by the requesting visitor', async () => {
    const response = await getChatsRequest()

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual([{ id: 'chat-1', title: 'A chat' }])
    expect(getChats).toHaveBeenCalledWith('visitor-1')
  })
})
