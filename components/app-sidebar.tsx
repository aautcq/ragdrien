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

export async function AppSidebar() {
  const chats = getChats()

  return (
    <Sidebar variant="floating">
      <SidebarHeader><span className="sr-only">Your chats</span></SidebarHeader>
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
              <SidebarMenuItem>
                <AppSidebarNavLink href="/">+ New chat</AppSidebarNavLink>
              </SidebarMenuItem>
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
