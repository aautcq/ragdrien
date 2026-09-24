import { getChats, createChat } from "@/lib/chat/chats";
import { getVisitorIdFromRequest } from "@/lib/visitor";

export async function POST(request: Request) {
  const { text } = await request.json() as { text: string };
  const visitorId = getVisitorIdFromRequest(request);

  const { id } = createChat(text, visitorId);

  return new Response(JSON.stringify({ id }), { status: 200 });
}

export async function GET(request: Request) {
  const visitorId = getVisitorIdFromRequest(request);

  return new Response(JSON.stringify(getChats(visitorId)), { status: 200 });
}
