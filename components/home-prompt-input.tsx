"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  PromptInput,
  PromptInputBody,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputSubmit,
} from "@/components/ai-elements/prompt-input";

export function HomePromptInput() {
  const [input, setInput] = useState("");

  const router = useRouter();

  async function handleSubmit(message: { text: string }) {
    if (!message.text.trim()) {
      return;
    }

    const response = await fetch("/api/chats", {
      method: "POST",
      body: JSON.stringify({
        text: message.text,
      }),
    });

    const data = await response.json() as { id: string };

    setInput("");
    router.push(`/${data.id}`);
    router.refresh();
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
        <PromptInputSubmit />
      </PromptInputFooter>
    </PromptInput>
  )
}
