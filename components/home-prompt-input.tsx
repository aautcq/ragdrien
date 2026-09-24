"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  PromptInput,
  PromptInputBody,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputSubmit,
} from "@/components/ai-elements/prompt-input";

const placeholders = [
  "How old are you?",
  "What is your favorite programming language?",
  "Where do you live?",
  "What is your favorite JavaScript framework?",
  "Where are you currently working?",
];

export function HomePromptInput() {
  const [input, setInput] = useState("");
  // Static on server, randomized after mount to avoid a hydration mismatch.
  const [placeholder, setPlaceholder] = useState(placeholders[0]);

  const router = useRouter();

  useEffect(() => {
    // Randomized client-only, after hydration, to avoid an SSR/client mismatch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPlaceholder(placeholders[Math.floor(Math.random() * placeholders.length)]);
  }, []);

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
          placeholder={placeholder}
          autoFocus
        />
      </PromptInputBody>
      <PromptInputFooter>
        <PromptInputSubmit />
      </PromptInputFooter>
    </PromptInput>
  )
}
