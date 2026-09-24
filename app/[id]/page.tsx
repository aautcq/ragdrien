import Chat from "@/components/chat/chat";
import { getChat } from "@/lib/chat/chats";
import { getVisitorId } from "@/lib/visitor-rsc";
import { notFound } from "next/navigation";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const visitorId = await getVisitorId()

  const chat = getChat(id, visitorId)

  if (!chat) {
    notFound()
  }

  return (
    <Chat id={chat.id} title={chat.title} initialMessages={chat.messages} />
  );
}
