"use client";

import { Button } from "@/components/ui/button";

export function ChatError({ canRegenerate, error, regenerate }: { canRegenerate: boolean; error: Error; regenerate: () => void }) {
  return (
    (
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
    )
  )
}
