"use client";

import { useState } from "react";
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
} from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputBody,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputSubmit,
} from "@/components/ai-elements/prompt-input";
import { PencilIcon } from "lucide-react";
import { extractText } from "@/lib/chat/messages";

export default function Home() {
  const [input, setInput] = useState("");
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  const { messages, status, error, sendMessage, stop } = useChat({
    onError(err) {
      console.error(err);
    },
  });

  // Editing is only safe once the model isn't actively producing a response
  // (there's nothing in-flight for a truncating resend to race with).
  const canEdit = status === "ready" || status === "error";

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

    setEditingMessageId(null);
    setEditText("");
  }

  return (
    <div className="mx-auto flex h-dvh w-full max-w-3xl flex-col py-4">
      <Conversation className="flex-1">
        <ConversationContent>
          {messages.length === 0 ? (
            <ConversationEmptyState
              title="No messages yet"
              description="Ask me anything about Adrien..."
            />
          ) : (
            messages.map((message) =>
              message.role === "user" && editingMessageId === message.id ? (
                <Message from={message.role} key={message.id}>
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
                </Message>
              )
            )
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      {error && (
        <p className="text-destructive px-4 text-sm">{error.message}</p>
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
