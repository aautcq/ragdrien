---
Status: accepted, supersedes 0007
---

# Stream Chat titles from the client, not a server-side background job

`docs/adr/0007-llm-generated-chat-titles.md` had generation run in the background via `after()` inside `POST /api/chats`, with the sidebar only picking up the finished title on its next server render — the visitor would see the truncated fallback title flip to the summarized one with no visible transition, whenever they next happened to re-render the sidebar.

We now want the summarized title to visibly stream into the sidebar entry, the same way an assistant reply streams into the transcript. That requires a client that can read the Model's output as it arrives, which a server-only `after()` job can't provide. So generation moves to a dedicated `PATCH /api/chats/[id]/title` route that streams its response, and the client — `Chat`, on mount, exactly once per Chat — is what calls it and feeds the growing text into a small Context (`TitleStreamProvider`) that the sidebar's title cell reads. `POST /api/chats` no longer touches titles at all; this is now the only path that generates one.

Persistence still isn't tied to the client watching: the route's own `after()` block reads the (teed) stream to completion and calls `updateTitle` regardless of whether the client is still around to see it — a Chat left mid-stream (e.g. the visitor clicks another chat) still ends up with its generated title saved.

The "cosmetic, not load-bearing" stance from 0007 is unchanged: a failed generation leaves the fallback title in place permanently, logged only to the console, with no retry and no visible error state.
