"use client";

import { useEffect, useRef, useState } from "react";
import { useChat } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { ChatMessages } from "@/components/chat-messages";
import { ChatPromptInput } from "@/components/chat-prompt-input";
import { ChatError } from "@/components/chat-error";
import { extractText } from "@/lib/chat/messages";
import { deriveTitle } from "@/lib/chat/titles";
import { useSetTitleOverride } from "@/components/title-stream-context";

export default function Chat({ id, title, initialMessages }: { id: string; title: string; initialMessages: UIMessage[] }) {
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const setTitleOverride = useSetTitleOverride();

  const { messages, status, error, sendMessage, regenerate, stop } = useChat({
    id,
    messages: initialMessages,
    onError(err) {
      console.error(err);
    },
  });

  // A chat freshly created from the home page arrives here with a
  // persisted opening visitor Message but no assistant reply yet (see
  // lib/chat/chats.ts's createChat). Resumes that pending turn exactly
  // once: regenerate() with no messageId re-requests a reply for the
  // trailing message without appending a new one, so this can't duplicate
  // the visitor's message the way re-sending it would. Guarded against
  // React Strict Mode's dev-time double-invoke of effects, and against
  // ever firing again once the turn is no longer pending (e.g. after a
  // page reload once the assistant has replied).
  const hasResumedPendingTurn = useRef(false);

  useEffect(() => {
    if (hasResumedPendingTurn.current || messages.at(-1)?.role !== "user") {
      return;
    }

    hasResumedPendingTurn.current = true;
    regenerate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Streams a Model-summarized title for a freshly-created chat, mirroring
  // the "resume pending turn" pattern above — see
  // app/api/chats/[id]/title/route.ts and docs/adr/0008-stream-chat-titles
  // -from-the-client.md. `title` still being exactly the synchronous,
  // truncated-text fallback (see deriveTitle) is how a chat that hasn't had
  // a title generated yet is recognized, since nothing is persisted to mark
  // that state explicitly.
  //
  // Deliberately has NO ref-guard against Strict Mode's dev-time
  // double-invoke (unlike the pattern above): combining one with an
  // aborting cleanup here would abort the first invocation's fetch and
  // then have the ref block the second invocation from ever retrying,
  // leaving the title stuck at its fallback in dev forever. Aborting on
  // cleanup and re-deriving the "still needs generating?" check fresh each
  // invocation is the React-recommended, Strict-Mode-safe shape for a
  // fetch effect: the first (dev-only) invocation's request is cancelled
  // by its own cleanup — before it can meaningfully progress, since Strict
  // Mode's mount→cleanup→remount cycle runs synchronously — and only the
  // second (or, in production, only) invocation's request actually
  // completes. A real unmount (e.g. the visitor navigates away) aborts the
  // in-flight request the same way; the route's own after() block keeps
  // persisting the result server-side regardless.
  useEffect(() => {
    const openingMessage = initialMessages[0];
    if (!openingMessage || deriveTitle(extractText(openingMessage)) !== title) {
      return;
    }

    const controller = new AbortController();

    (async () => {
      try {
        const response = await fetch(`/api/chats/${id}/title`, { method: "PATCH", signal: controller.signal });
        if (!response.ok || !response.body) {
          return;
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let accumulatedTitle = "";

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          accumulatedTitle += decoder.decode(value, { stream: true });
          setTitleOverride(id, accumulatedTitle);
        }
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          console.warn(`[chat] Failed to stream a title for chat ${id}:`, err);
        }
      }
    })();

    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  async function handleSubmit(message: { text: string }) {
    await sendMessage({ text: message.text });
  }

  return (
    <div className="mx-auto flex h-dvh w-full max-w-3xl flex-col py-1 md:py-4 px-1 md:px-0">
      <Conversation className="flex-1">
        <ConversationContent>
          {messages.length === 0 ? (
            <ConversationEmptyState
              title="No messages yet"
              description="Ask me anything about Adrien..."
            />
          ) : (
            <ChatMessages
              messages={messages}
              onSendMessage={sendMessage}
              onRegenerate={regenerate}
              onToggleEditing={setIsEditing}
              status={status}
            />
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      {error && (
        <ChatError
          canRegenerate={(status === "ready" || status === "error") && !isEditing}
          error={error}
          regenerate={regenerate}
        />
      )}

      <ChatPromptInput
        onSendMessage={handleSubmit}
        onStop={stop}
        preventSending={isEditing}
        status={status}
      />
    </div>
  );
}
