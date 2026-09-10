import { SidebarProvider } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { SidebarButton } from "@/components/app-sidebar-button"
import { TitleStreamProvider } from "@/components/title-stream-context"

function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <TitleStreamProvider>
      <SidebarProvider defaultOpen={false}>
        <AppSidebar />
        <main className="flex-auto relative">
          <SidebarButton />
          <div className="min-h-full flex flex-col">
            {children}
          </div>
        </main>
      </SidebarProvider>
    </TitleStreamProvider>
  );
}

export { AppShell };
