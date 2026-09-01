"use client";

import { useState } from "react";
import { useChat } from "@ai-sdk/react";
import {
  Conversation,
  ConversationContent,
  ConversationEmptyState,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent, MessageResponse, MessageSources } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputBody,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputSubmit,
} from "@/components/ai-elements/prompt-input";

export default function Home() {
  const [input, setInput] = useState("");

  const { messages, status, error, sendMessage } = useChat({
    onError(err) {
      console.error(err);
    },
  });

  function handleSubmit(message: { text: string }) {
    if (!message.text.trim()) {
      return;
    }

    sendMessage({ text: message.text });

    setInput("");
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-8rem)] w-full max-w-3xl flex-col py-4">
      <Conversation className="flex-1">
        <ConversationContent>
          {messages.length === 0 ? (
            <ConversationEmptyState
              title="No messages yet"
              description="Ask me anything..."
            />
          ) : (
            messages.map((message) => (
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
                    .filter((part) => part.type === "source-document")
                    .map((part) => ({
                      sourceId: part.sourceId,
                      title: part.title,
                    }))}
                />
              </Message>
            ))
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
          <PromptInputSubmit status={status} disabled={!input.trim()} />
        </PromptInputFooter>
      </PromptInput>
    </div>
  );
}
