"use client";

import { ChatsCommandPalette } from "@/components/chats-command-palette";
import { CommandDialog } from "@/components/ui/command"
import { SidebarMenuButton } from "@/components/ui/sidebar"
import { Search } from "lucide-react"
import { useState } from "react"

function SearchChats() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <SidebarMenuButton onClick={() => setOpen(true)}>
        <Search className="size-3.5" /> Search chats
      </SidebarMenuButton>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <ChatsCommandPalette onSelect={() => setOpen(false)} />
      </CommandDialog>
    </>
  )
}

export { SearchChats }
