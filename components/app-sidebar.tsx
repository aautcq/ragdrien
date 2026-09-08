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
import { getChats } from "@/lib/chat/chats"

export async function AppSidebar() {
  const chats = getChats()

  return (
    <Sidebar variant="floating">
      <SidebarHeader>Your chats</SidebarHeader>
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
