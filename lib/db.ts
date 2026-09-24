import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'

const DEFAULT_DB_PATH = join(process.cwd(), 'data/app.db')

/**
 * Schema for both persisted domains — see CONTEXT.md's Chat/Message and
 * Vector store/Ingestion terms. `CREATE TABLE IF NOT EXISTS` keeps this
 * idempotent across repeated calls (e.g. every getDb() in a long-running
 * process, or every test opening a fresh :memory: database).
 *
 * chats.visitor_id scopes every Chat to the anonymous Visitor that created
 * it (see CONTEXT.md's Visitor term and lib/visitor.ts) — there's no
 * migration for pre-existing rows without one; `data/app.db` is deleted
 * as part of shipping this, see docs/adr/0009-anonymous-visitor-scoping-for-chats.md.
 */
const SCHEMA = `
CREATE TABLE IF NOT EXISTS chats (
  id TEXT PRIMARY KEY,
  visitor_id TEXT NOT NULL,
  title TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  chat_id TEXT NOT NULL REFERENCES chats(id),
  position INTEGER NOT NULL,
  role TEXT NOT NULL,
  parts TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS chunks (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  position INTEGER NOT NULL,
  content TEXT NOT NULL,
  source_url TEXT,
  embedding TEXT NOT NULL
);
`

/** Opens (creating if needed) a SQLite database at `path` and ensures its schema exists. */
export function createDb(path: string): DatabaseSync {
  if (path !== ':memory:') {
    mkdirSync(dirname(path), { recursive: true })
  }
  const db = new DatabaseSync(path)
  db.exec(SCHEMA)
  return db
}

let db: DatabaseSync | null = null

/**
 * The shared, process-wide SQLite connection, opened lazily on first use
 * and cached for the server process's lifetime. Path is overridable via
 * DATABASE_PATH; defaults to data/app.db under the project root. Safe to
 * call from multiple separately-compiled entrypoints (Route Handlers,
 * Server Components): each gets its own DatabaseSync instance, but they all
 * point at the same file, which is what actually keeps them in sync — see
 * docs/adr/0006-sqlite-for-chat-and-vector-store-persistence.md.
 */
export function getDb(): DatabaseSync {
  if (!db) {
    db = createDb(process.env.DATABASE_PATH ?? DEFAULT_DB_PATH)
  }
  return db
}
