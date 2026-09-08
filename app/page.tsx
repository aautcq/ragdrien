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

export default function Home() {
  const [input, setInput] = useState("");
  const router = useRouter();

  async function handleSubmit(message: { text: string }) {
    if (!message.text.trim()) {
      return;
    }

    const response = await fetch("/api/chats", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
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
    <div className="mx-auto flex h-dvh w-full max-w-3xl flex-col justify-center py-1 md:py-4 px-1 md:px-0">
      <h1 className="text-center text-3xl font-bold mb-3">Ask me anything</h1>
      <p className="text-center text-muted-foreground mb-12">I&apos;m an expert about Adrien Autricque.</p>
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
    </div>
  );
}
