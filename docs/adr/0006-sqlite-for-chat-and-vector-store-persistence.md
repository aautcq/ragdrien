# SQLite for Chat and Vector store persistence

Chats/Messages and the Vector store were both held in module-scoped, in-memory JS objects. In practice, App Router compiles Route Handlers and Server Component render trees as separate module graphs, so a plain module-scoped singleton silently forked into multiple instances across entrypoints — a Chat created via `POST /api/chats` was invisible to `app/[id]/page.tsx` and `app-sidebar.tsx`, which read a different instance.

We chose a single SQLite file (via Node's built-in `node:sqlite`, no added dependency) over Postgres/pgvector or Redis: this remains a single-process, local, personal project, so a hosted database or cache is infrastructure the app doesn't need. Persisting to a real file means every entrypoint reads/writes the same underlying data regardless of how many module instances exist in memory, which fixes the root cause rather than papering over it (e.g. with a `globalThis`-pinned singleton).

Vector store data (Chunks/Embeddings) is still rebuilt in full on each Ingestion run — but Ingestion is now an explicit script (`npm run ingest-documents`), not something the server re-triggers automatically on every start. This avoids re-embedding every Document via Ollama on each restart, at the cost of requiring a manual step whenever Documents change.

If this app ever needs to run across multiple server instances (e.g. serverless), SQLite will need to be replaced with a real hosted database/vector store — this decision only holds for the single-process deployment model in place today.
