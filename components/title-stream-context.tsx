"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

interface TitleStreamContextValue {
  overrides: Record<string, string>;
  setOverride: (chatId: string, title: string) => void;
}

const TitleStreamContext = createContext<TitleStreamContextValue | null>(null);

/**
 * Bridges a Chat's live-streaming title (produced client-side by
 * components/chat.tsx, see app/api/chats/[id]/title/route.ts) to the
 * sidebar entry that displays it — the two are otherwise unconnected, since
 * AppSidebar is a Server Component rendered once per navigation while Chat
 * is a Client Component scoped to a single chat's page. Wraps AppShell's
 * whole tree (both the sidebar and the page content) so both sides can
 * reach the same overrides — see docs/adr/0008-stream-chat-titles-from-the
 * -client.md.
 */
export function TitleStreamProvider({ children }: { children: React.ReactNode }) {
  const [overrides, setOverrides] = useState<Record<string, string>>({});

  const setOverride = useCallback((chatId: string, title: string) => {
    setOverrides((previous) => ({ ...previous, [chatId]: title }));
  }, []);

  const value = useMemo(() => ({ overrides, setOverride }), [overrides, setOverride]);

  return <TitleStreamContext.Provider value={value}>{children}</TitleStreamContext.Provider>;
}

/** A Chat's title, live-streamed override taking priority over `fallback` (its server-rendered, persisted title). */
export function useTitleOverride(chatId: string, fallback: string): string {
  const context = useContext(TitleStreamContext);
  return context?.overrides[chatId] ?? fallback;
}

/**
 * Lets a Chat page (see components/chat.tsx) publish its title-generation
 * stream's growing text so the sidebar can render it live. Returns a no-op
 * outside a TitleStreamProvider (e.g. in isolation/tests) rather than
 * throwing, since a missing provider only means the update is silently
 * unobserved, not a broken feature.
 */
export function useSetTitleOverride(): (chatId: string, title: string) => void {
  const context = useContext(TitleStreamContext);
  return context?.setOverride ?? (() => {});
}
