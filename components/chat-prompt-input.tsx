"use client";

import { useState } from "react";
import {
  PromptInput,
  PromptInputBody,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputSubmit,
} from "@/components/ai-elements/prompt-input";
import type { ChatStatus } from "ai";

export function ChatPromptInput({
  onSendMessage,
  onStop,
  preventSending,
  status,
}: {
  onSendMessage: (message: { text: string }) => void
  onStop: () => void
  preventSending?: boolean
  status: ChatStatus
}) {
  const [input, setInput] = useState("");

  function handleSubmit(message: { text: string }) {
    if (!message.text.trim() || preventSending) {
      return;
    }

    onSendMessage({ text: message.text });

    setInput("");
  }

  return (
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
            preventSending ||
            (status === 'ready' && !input.trim()) ||
            ['error', 'submitted'].includes(status)
          }
          onStop={onStop}
        />
      </PromptInputFooter>
    </PromptInput>
  );
}
