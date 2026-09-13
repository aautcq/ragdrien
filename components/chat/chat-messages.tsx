"use client";

import { useEffect, useState } from "react";
import type { ChatStatus, UIMessage } from "ai";
import { Message, MessageEditForm, MessageTimestamp } from "@/components/ai-elements/message";
import {
  formatMessageTime,
  syncMessageTimestamps,
  withRefreshedTimestamp,
} from "@/lib/chat/timestamps";
import { ChatMessage } from "@/components/chat/chat-message";
import { extractText } from "@/lib/chat/messages";
import { Dot } from "lucide-react";

/**
 * Renders a message's timestamp once it's been recorded (see the
 * `messageTimestamps` effect below). Omitted entirely for the one render
 * before a brand-new message id is recorded, rather than falling back to
 * `Date.now()` during render.
 */
function renderMessageTimestamp(
  messageId: string,
  messageTimestamps: Map<string, number>
) {
  const timestamp = messageTimestamps.get(messageId);
  return timestamp === undefined ? null : (
    <MessageTimestamp time={formatMessageTime(timestamp)} />
  );
}

export function ChatMessages({ messages, onSendMessage, onRegenerate, onToggleEditing, status }: { messages: UIMessage[]; onSendMessage: (message: { text: string, messageId?: string }) => void; onRegenerate: () => void; onToggleEditing: (isEditing: boolean) => void; status: ChatStatus }) {
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  // Client-only send/receipt times: nothing is persisted server-side, so a
  // message's timestamp is just the moment it first appeared in this state
  // — see lib/chat/timestamps.ts.
  const [messageTimestamps, setMessageTimestamps] = useState<
    Map<string, number>
  >(new Map());

  useEffect(() => {
    const messageIds = messages.map((message) => message.id);
    const now = Date.now();
    const next = syncMessageTimestamps(messageTimestamps, messageIds, now);

    if (next !== messageTimestamps) {
      // This effect exists to synchronize local timestamp bookkeeping with
      // `messages`, an external system's state (the AI SDK's own chat
      // instance, whose message ids we don't control and can't timestamp
      // any other way) — the documented case for setState-in-effect.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMessageTimestamps(next);
    }
  }, [messages, messageTimestamps]);

  const canEdit = status === "ready" || status === "error";

  // Regenerating/retrying share canEdit's "nothing in-flight" requirement,
  // plus they must not race an in-progress edit of another message.
  const canRegenerate = canEdit && editingMessageId === null;

  function startEdit(message: UIMessage) {
    setEditingMessageId(message.id);
    onToggleEditing(true);
    setEditText(extractText(message));
  }

  function cancelEdit() {
    setEditingMessageId(null);
    onToggleEditing(false);
    setEditText("");
  }

  function submitEdit(messageId: string) {
    // Re-check canEdit here, not just at the pencil button: status can
    // change to submitted/streaming (e.g. a message sent from the main
    // composer) while this edit form stayed open.
    if (!canEdit || !editText.trim()) {
      return;
    }

    // Replacing a message by id truncates every message after it and
    // resends the conversation up to (and including) the edit — see
    // CONTEXT.md's "Turn" and "Conversational turn" terms.
    onSendMessage({ text: editText, messageId });

    // The edited message keeps its original id, so its recorded timestamp
    // wouldn't otherwise update — refresh it to the edit time.
    setMessageTimestamps((prev) =>
      withRefreshedTimestamp(prev, messageId, Date.now())
    );

    setEditingMessageId(null);
    onToggleEditing(false);
    setEditText("");
  }

  return (
    <>
      {messages.map((message, index) => (
        message.role === "user" && editingMessageId === message.id ? (
          <Message from={message.role} key={message.id}>
            {renderMessageTimestamp(message.id, messageTimestamps)}
            <MessageEditForm
              value={editText}
              onValueChange={setEditText}
              onSubmit={() => submitEdit(message.id)}
              onCancel={cancelEdit}
              disabled={!canEdit}
            />
          </Message>
        ) : (
          <ChatMessage
            message={message}
            key={message.id}
            timestamp={messageTimestamps.get(message.id) ?? null}
            onStartEdit={startEdit}
            canEdit={canEdit}
            isLast={index === messages.length - 1}
            canRegenerate={canRegenerate}
            onRegenerate={onRegenerate}
          />
        )
      ))}
      {status === "submitted" && (
        <Dot size={32} className="animate-bounce text-muted-foreground" />
      )}
    </>
  );
}
