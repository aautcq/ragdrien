"use client";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import type { Chat } from "@/lib/chat/chats";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

function ChatsCommandPalette({ onSelect }: { onSelect: (chatId: string) => void }) {
  const router = useRouter();

  const handleSelect = (chatId: string) => {
    router.push(`/${chatId}`);
    onSelect(chatId);
  };

  const [chats, setChats] = useState<Chat[]>([]);

  useEffect(() => {
    fetch("/api/chats")
      .then((res) => res.json())
      .then((data: Chat[]) => setChats(data));
  }, []);

  return (
    <Command>
      <CommandInput placeholder="Search chats..." />
      <CommandList>
        <CommandEmpty>No chats found.</CommandEmpty>
        <CommandGroup heading="Suggestions">
          {chats.map(chat => (
            <CommandItem
              key={chat.id}
              value={chat.title}
              onSelect={() => handleSelect(chat.id)}
            >
              {chat.title}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </Command>
  )
}

export { ChatsCommandPalette }
