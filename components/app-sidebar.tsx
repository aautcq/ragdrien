import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarHeader,
} from "@/components/ui/sidebar"
import { AppLogo } from "@/components/app-logo"
import { AppSidebarNavLink } from "@/components/app-sidebar-nav-link"
import { AppSidebarDeleteChatButton } from "@/components/app-sidebar-delete-chat-button"
import { getChats } from "@/lib/chat/chats"
import { SearchChats } from "@/components/search-chats"
import { Plus } from "lucide-react"

export async function AppSidebar() {
  const chats = getChats()

  return (
    <Sidebar variant="floating">
      <SidebarHeader>
        <h2 className="sr-only">Your chats</h2>

        <SidebarMenu>
          <SidebarMenuItem>
            <SearchChats />
          </SidebarMenuItem>
          <SidebarMenuItem>
            <AppSidebarNavLink href="/"><Plus className="size-3.5" /> New chat</AppSidebarNavLink>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Your chats</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {chats.map((chat) => (
                <SidebarMenuItem key={chat.id}>
                  <AppSidebarNavLink href={`/${chat.id}`}>
                    <span>{chat.title}</span>
                  </AppSidebarNavLink>
                  <AppSidebarDeleteChatButton id={chat.id} />
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <AppLogo />
      </SidebarFooter>
    </Sidebar>
  )
}
