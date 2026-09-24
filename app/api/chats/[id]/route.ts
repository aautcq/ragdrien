import { getChat, deleteChat } from "@/lib/chat/chats";
import { getVisitorIdFromRequest } from "@/lib/visitor";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const visitorId = getVisitorIdFromRequest(request)
  const chat = getChat(id, visitorId)
  return new Response(JSON.stringify(chat), { status: chat ? 200 : 404 })
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const visitorId = getVisitorIdFromRequest(request)
  const deleted = deleteChat(id, visitorId)
  return new Response(null, { status: deleted ? 200 : 404 })
}
