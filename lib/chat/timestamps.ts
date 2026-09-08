/**
 * Tracks per-message send/receipt times on the client. Nothing here is
 * persisted server-side (see CONTEXT.md: there is no message persistence),
 * so a message's timestamp is simply the moment it first appeared in the
 * browser's `useChat` state — see app/page.tsx.
 */

/**
 * Reconciles `timestamps` against the message ids currently in state:
 * ids already tracked keep their existing time, ids not yet tracked get
 * `now`, and ids no longer present (e.g. truncated by an edit, or a
 * regenerated assistant message that got a new id) are dropped — otherwise
 * the map would grow unbounded over a long or heavily-edited session.
 * Returns the same map instance when nothing changed, so callers (e.g. a
 * `useState` setter) can skip a re-render.
 */
export function syncMessageTimestamps(
  timestamps: Map<string, number>,
  messageIds: string[],
  now: number
): Map<string, number> {
  const unchanged =
    messageIds.length === timestamps.size &&
    messageIds.every(id => timestamps.has(id))

  if (unchanged) {
    return timestamps
  }

  const next = new Map<string, number>()
  for (const id of messageIds) {
    next.set(id, timestamps.get(id) ?? now)
  }
  return next
}

/**
 * Overwrites the timestamp for a single message id, e.g. when an edited
 * user message replaces its content in place (see AI SDK's `sendMessage`
 * with a `messageId`, which keeps the same id rather than creating a new
 * message).
 */
export function withRefreshedTimestamp(
  timestamps: Map<string, number>,
  messageId: string,
  now: number
): Map<string, number> {
  const next = new Map(timestamps)
  next.set(messageId, now)
  return next
}

/**
 * Formats an epoch time as a locale time-of-day string (e.g. "2:32 PM"),
 * with no date component — see CONTEXT.md: conversations aren't persisted,
 * so a full date is rarely relevant within a single browser session.
 */
export function formatMessageTime(epochMs: number): string {
  return new Date(epochMs).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  })
}
