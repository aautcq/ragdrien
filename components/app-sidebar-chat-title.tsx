"use client"

import { useTitleOverride } from "@/components/title-stream-context"

/**
 * A Chat's sidebar title, live-updating while its title is streaming in
 * (see components/chat.tsx, components/title-stream-context.tsx) — falls
 * back to `title`, the server-rendered, persisted value, once nothing is
 * overriding it.
 */
export function AppSidebarChatTitle({ id, title }: { id: string; title: string }) {
  const displayedTitle = useTitleOverride(id, title)

  return <span>{displayedTitle}</span>
}
