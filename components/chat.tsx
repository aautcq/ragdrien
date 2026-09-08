"use client";

import { useEffect, useRef, useState } from "react";
import React from "react";
import { useChat } from "@ai-sdk/react";
import type { UIMessage } from "ai";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageAction,
  MessageActions,
  MessageContent,
  MessageEditForm,
  MessageResponse,
  MessageSources,
  MessageTimestamp,
} from "@/components/ai-elements/message";
import {
  formatMessageTime,
  syncMessageTimestamps,
  withRefreshedTimestamp,
} from "@/lib/chat/timestamps";
import {
  PromptInput,
  PromptInputBody,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputSubmit,
} from "@/components/ai-elements/prompt-input";
import { Button } from "@/components/ui/button";
import { CheckIcon, CopyIcon, PencilIcon, RotateCcwIcon } from "lucide-react";
import { extractText } from "@/lib/chat/messages";

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

export default function Chat({ id, initialMessages }: { id: string; initialMessages: UIMessage[] }) {
  const [input, setInput] = useState("");
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);

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

  // Editing is only safe once the model isn't actively producing a response
  // (there's nothing in-flight for a truncating resend to race with).
  const canEdit = status === "ready" || status === "error";

  // Regenerating/retrying share canEdit's "nothing in-flight" requirement,
  // plus they must not race an in-progress edit of another message.
  const canRegenerate = canEdit && editingMessageId === null;

  function handleSubmit(message: { text: string }) {
    if (!message.text.trim() || editingMessageId !== null) {
      return;
    }

    sendMessage({ text: message.text });

    setInput("");
  }

  function startEdit(message: UIMessage) {
    setEditingMessageId(message.id);
    setEditText(extractText(message));
  }

  function cancelEdit() {
    setEditingMessageId(null);
    setEditText("");
  }

  function copyMessage(message: UIMessage) {
    navigator.clipboard
      .writeText(extractText(message))
      .then(() => {
        setCopiedMessageId(message.id);
        setTimeout(() => setCopiedMessageId((id) => (id === message.id ? null : id)), 1500);
      })
      .catch((err) => console.error(err));
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
    sendMessage({ text: editText, messageId });

    // The edited message keeps its original id, so its recorded timestamp
    // wouldn't otherwise update — refresh it to the edit time.
    setMessageTimestamps((prev) =>
      withRefreshedTimestamp(prev, messageId, Date.now())
    );

    setEditingMessageId(null);
    setEditText("");
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
            messages.map((message, index) =>
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
                <Message from={message.role} key={message.id}>
                  {renderMessageTimestamp(message.id, messageTimestamps)}
                  <MessageContent>
                    {message.parts.map((part, index) =>
                      part.type === "text" ? (
                        <MessageResponse key={`${message.id}-${index}`}>
                          {part.text}
                        </MessageResponse>
                      ) : null
                    )}
                  </MessageContent>
                  <MessageSources
                    sources={message.parts
                      .filter(
                        (part) =>
                          part.type === "source-document" ||
                          part.type === "source-url"
                      )
                      .map((part) => ({
                        sourceId: part.sourceId,
                        title: part.title ?? part.sourceId,
                        ...(part.type === "source-url"
                          ? { url: part.url }
                          : {}),
                      }))}
                  />
                  {message.role === "user" && (
                    <MessageActions className="justify-end">
                      <MessageAction
                        tooltip="Edit"
                        label="Edit message"
                        disabled={!canEdit}
                        onClick={() => startEdit(message)}
                      >
                        <PencilIcon className="size-3.5" />
                      </MessageAction>
                    </MessageActions>
                  )}
                  {message.role === "assistant" && (
                    <MessageActions className="justify-start">
                      <MessageAction
                        tooltip="Copy"
                        label="Copy message"
                        disabled={index === messages.length - 1 && !canEdit}
                        onClick={() => copyMessage(message)}
                      >
                        {copiedMessageId === message.id ? (
                          <CheckIcon className="size-3.5" />
                        ) : (
                          <CopyIcon className="size-3.5" />
                        )}
                      </MessageAction>
                      {index === messages.length - 1 && (
                        <MessageAction
                          tooltip="Regenerate"
                          label="Regenerate response"
                          disabled={!canRegenerate}
                          onClick={() => regenerate()}
                        >
                          <RotateCcwIcon className="size-3.5" />
                        </MessageAction>
                      )}
                    </MessageActions>
                  )}
                </Message>
              )
            )
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      {error && (
        <div className="flex items-center gap-2 px-4 text-sm">
          <p className="text-destructive">{error.message}</p>
          <Button
            size="sm"
            type="button"
            variant="ghost"
            disabled={!canRegenerate}
            onClick={() => regenerate()}
          >
            Retry
          </Button>
        </div>
      )}

      <PromptInput onSubmit={handleSubmit}>
        <PromptInputBody>
          <PromptInputTextarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Ask me anything..."
            autoFocus
          />
        </PromptInputBody>
        <PromptInputFooter>
          <PromptInputSubmit
            status={status}
            disabled={
              editingMessageId !== null ||
              (status === 'ready' && !input.trim()) ||
              ['error', 'submitted'].includes(status)
            }
            onStop={stop}
          />
        </PromptInputFooter>
      </PromptInput>
    </div>
  );
}
