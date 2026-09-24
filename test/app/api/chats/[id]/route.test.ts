import { beforeEach, describe, expect, it, vi } from 'vitest'
import { userMessage } from '../../../../helpers/ui-messages'
import type { ChatWithMessages } from '@/lib/chat/chats'

const { getChat, deleteChat } = vi.hoisted(() => ({ getChat: vi.fn(), deleteChat: vi.fn() }))

vi.mock('@/lib/chat/chats', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/chat/chats')>()),
  getChat,
  deleteChat
}))

const { GET, DELETE } = await import('@/app/api/chats/[id]/route')

function getChatRequest(id: string) {
  return GET(new Request(`http://localhost/api/chats/${id}`, { headers: { Cookie: 'visitor_id=visitor-1' } }), { params: Promise.resolve({ id }) })
}

function deleteChatRequest(id: string) {
  return DELETE(new Request(`http://localhost/api/chats/${id}`, { method: 'DELETE', headers: { Cookie: 'visitor_id=visitor-1' } }), { params: Promise.resolve({ id }) })
}

function chat(overrides: Partial<ChatWithMessages> = {}): ChatWithMessages {
  return { id: 'chat-1', title: 'A chat', messages: [userMessage('u1', 'hi')], ...overrides }
}

describe('GET /api/chats/[id]', () => {
  beforeEach(() => {
    getChat.mockReset()
  })

  it('returns the chat owned by the requesting visitor', async () => {
    getChat.mockReturnValue(chat())

    const response = await getChatRequest('chat-1')

    expect(getChat).toHaveBeenCalledWith('chat-1', 'visitor-1')
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual(chat())
  })

  it('returns 404 when the chat does not exist, or belongs to another visitor', async () => {
    getChat.mockReturnValue(undefined)

    const response = await getChatRequest('missing')

    expect(response.status).toBe(404)
  })
})

describe('DELETE /api/chats/[id]', () => {
  beforeEach(() => {
    deleteChat.mockReset()
  })

  it('deletes the chat owned by the requesting visitor', async () => {
    deleteChat.mockReturnValue(true)

    const response = await deleteChatRequest('chat-1')

    expect(deleteChat).toHaveBeenCalledWith('chat-1', 'visitor-1')
    expect(response.status).toBe(200)
  })

  it('returns 404 when the chat does not exist, or belongs to another visitor', async () => {
    deleteChat.mockReturnValue(false)

    const response = await deleteChatRequest('missing')

    expect(response.status).toBe(404)
  })
})
