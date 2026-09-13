"use client"

import Link from "next/link";
import { usePathname } from "next/navigation"
import { SidebarMenuButton } from "@/components/ui/sidebar"

export function AppSidebarNavLink({ href, children }: { href: string; children: React.ReactNode }) {
  const pathname = usePathname()
  const isActive = pathname === href

  return <SidebarMenuButton render={<Link href={href} />} isActive={isActive}>{children}</SidebarMenuButton>
}
