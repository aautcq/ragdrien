"use client";

import { useState } from "react";
import type { UIMessage } from "ai";
import {
  Message,
  MessageAction,
  MessageActions,
  MessageContent,
  MessageResponse,
  MessageSources,
  MessageTimestamp,
} from "@/components/ai-elements/message";
import {
  formatMessageTime,
} from "@/lib/chat/timestamps";
import { CheckIcon, CopyIcon, PencilIcon, RotateCcwIcon } from "lucide-react";
import { extractText } from "@/lib/chat/messages";

export function ChatMessage({ message, timestamp, onStartEdit, canEdit, isLast, canRegenerate, onRegenerate }: { message: UIMessage; timestamp: number | null; onStartEdit: (message: UIMessage) => void; canEdit: boolean; isLast: boolean; canRegenerate: boolean; onRegenerate: () => void }) {
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null);

  function copyMessage(message: UIMessage) {
    navigator.clipboard
      .writeText(extractText(message))
      .then(() => {
        setCopiedMessageId(message.id);
        setTimeout(() => setCopiedMessageId((id) => (id === message.id ? null : id)), 1500);
      })
      .catch((err) => console.error(err));
  }

  return (
    <Message from={message.role}>
      {timestamp === null ? null : (
        <MessageTimestamp time={formatMessageTime(timestamp)} />
      )}
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
            onClick={() => onStartEdit(message)}
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
            disabled={!isLast && !canEdit}
            onClick={() => copyMessage(message)}
          >
            {copiedMessageId === message.id ? (
              <CheckIcon className="size-3.5" />
            ) : (
              <CopyIcon className="size-3.5" />
            )}
          </MessageAction>
          {isLast && (
            <MessageAction
              tooltip="Regenerate"
              label="Regenerate response"
              disabled={!canRegenerate}
              onClick={onRegenerate}
            >
              <RotateCcwIcon className="size-3.5" />
            </MessageAction>
          )}
        </MessageActions>
      )}
    </Message>
  )
}
