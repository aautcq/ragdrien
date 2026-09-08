import type { DatabaseSync } from 'node:sqlite'
import type { UIMessage } from 'ai'
import { getDb } from '@/lib/db'

export interface Chat {
  id: string
  title: string
}

export interface ChatWithMessages extends Chat {
  messages: UIMessage[]
}

/** Sidebar titles are truncated to this length, matching a single line of text. */
const TITLE_MAX_LENGTH = 60

/** Derives a Chat's sidebar title from its opening Message: the message text, truncated. */
function deriveTitle(text: string): string {
  const collapsed = text.trim().replace(/\s+/g, ' ')
  if (collapsed === '') {
    return 'New Chat'
  }
  return collapsed.length > TITLE_MAX_LENGTH ? `${collapsed.slice(0, TITLE_MAX_LENGTH)}…` : collapsed
}

function insertMessages(db: DatabaseSync, chatId: string, messages: UIMessage[]): void {
  const insert = db.prepare('INSERT INTO messages (id, chat_id, position, role, parts) VALUES (?, ?, ?, ?, ?)')
  messages.forEach((message, position) => {
    insert.run(message.id, chatId, position, message.role, JSON.stringify(message.parts))
  })
}

/**
 * Creates a new Chat and persists its opening visitor Message immediately,
 * so app/[id]/page.tsx has something to render as soon as it navigates
 * there — see CONTEXT.md's Chat/Message terms.
 */
export function createChat(firstMessageText: string, db: DatabaseSync = getDb()): Chat {
  const id = crypto.randomUUID()
  const title = deriveTitle(firstMessageText)

  db.prepare('INSERT INTO chats (id, title, created_at) VALUES (?, ?, ?)').run(id, title, Date.now())

  const message: UIMessage = {
    id: crypto.randomUUID(),
    role: 'user',
    parts: [{ type: 'text', text: firstMessageText }]
  }
  insertMessages(db, id, [message])

  return { id, title }
}

/** Every persisted Chat, most recently created first. Ties (same millisecond) break by insertion order. */
export function getChats(db: DatabaseSync = getDb()): Chat[] {
  return db.prepare('SELECT id, title FROM chats ORDER BY created_at DESC, rowid DESC').all() as unknown as Chat[]
}

interface MessageRow {
  id: string
  role: UIMessage['role']
  parts: string
}

/** The Chat with `id` and its full transcript, in order — or undefined if no such Chat exists. */
export function getChat(id: string, db: DatabaseSync = getDb()): ChatWithMessages | undefined {
  const chat = db.prepare('SELECT id, title FROM chats WHERE id = ?').get(id) as Chat | undefined
  if (!chat) {
    return undefined
  }

  const rows = db.prepare('SELECT id, role, parts FROM messages WHERE chat_id = ? ORDER BY position ASC').all(id) as unknown as MessageRow[]
  const messages = rows.map(row => ({ id: row.id, role: row.role, parts: JSON.parse(row.parts) }) as UIMessage)

  return { ...chat, messages }
}

/** Replaces a Chat's entire persisted transcript with `messages`, in order. */
export function saveMessages(chatId: string, messages: UIMessage[], db: DatabaseSync = getDb()): void {
  db.prepare('DELETE FROM messages WHERE chat_id = ?').run(chatId)
  insertMessages(db, chatId, messages)
}
