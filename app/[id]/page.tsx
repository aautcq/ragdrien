import Chat from "@/components/chat/chat";
import { getChat } from "@/lib/chat/chats";
import { notFound } from "next/navigation";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const chat = getChat(id)

  if (!chat) {
    notFound()
  }

  return (
    <Chat id={chat.id} title={chat.title} initialMessages={chat.messages} />
  );
}
