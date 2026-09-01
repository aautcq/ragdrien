export function userMessage(id: string, text: string) {
  return { id, role: 'user' as const, parts: [{ type: 'text' as const, text }] }
}

export function assistantMessage(id: string, text: string) {
  return { id, role: 'assistant' as const, parts: [{ type: 'text' as const, text }] }
}
