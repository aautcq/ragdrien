import { SidebarProvider } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { SidebarButton } from "@/components/app-sidebar-button"

function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider defaultOpen={false}>
      <AppSidebar />
      <main className="flex-auto relative">
        <SidebarButton />
        <div className="min-h-full flex flex-col">
          {children}
        </div>
      </main>
    </SidebarProvider>
  );
}

export { AppShell };
