import { getChat, deleteChat } from "@/lib/chat/chats";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const chat = getChat(id)
  return new Response(JSON.stringify(chat), { status: chat ? 200 : 404 })
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const deleted = deleteChat(id)
  return new Response(null, { status: deleted ? 200 : 404 })
}
