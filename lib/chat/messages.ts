import type { UIMessage } from 'ai'

/**
 * Extracts the plain text of a message, ignoring any non-text parts. Shared
 * between the server (app/api/chat/route.ts, building the model prompt) and
 * the client (app/page.tsx, prefilling a message's edit box).
 */
export function extractText(message: UIMessage): string {
  return message.parts
    .filter(part => part.type === 'text')
    .map(part => part.text)
    .join('')
}
