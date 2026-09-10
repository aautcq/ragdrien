"use client"

import { AlertModal } from "@/components/alert-modal"
import { SidebarMenuAction } from "@/components/ui/sidebar"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { Trash } from "lucide-react"
import { useRouter, usePathname } from "next/navigation";

export function AppSidebarDeleteChatButton({ id }: { id: string }) {
  const router = useRouter();
  const pathname = usePathname();

  async function handleDeleteChat() {
    await fetch(`/api/chats/${id}`, { method: "DELETE" })
    if (pathname === `/${id}`) {
      router.push("/");
    }
    router.refresh();
  }

  return (
    <Tooltip>
      <AlertModal
        render={
          <TooltipTrigger
            render={
              <SidebarMenuAction
                showOnHover={true}
                render={<button type="button" />}
              >
                <Trash /> <span className="sr-only">Delete chat</span>
              </SidebarMenuAction>
            }
          />
        }
        onClick={handleDeleteChat}
      />
      <TooltipContent>
        <p>Delete chat</p>
      </TooltipContent>
    </Tooltip>
  )
}
