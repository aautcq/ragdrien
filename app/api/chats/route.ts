import { createChat, getChats } from "@/lib/chat/chats";

export async function POST(request: Request) {
  const { text } = await request.json() as { text: string };

  const { id } = createChat(text);

  return new Response(JSON.stringify({ id }), { status: 200 });
}

export async function GET() {
  return new Response(JSON.stringify(getChats()), { status: 200 });
}
