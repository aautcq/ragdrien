# LLM-generated Chat titles

A Chat's sidebar title used to be a plain truncation of its opening Message's text, which reads awkwardly for anything longer than a short sentence. Titles are now summarized by the Model instead.

Generation runs in the background, scheduled via Next.js's `after()` (from `next/server`) inside `POST /api/chats`, rather than blocking the response: `createChat` still returns immediately with the truncated-text title so navigating to the new Chat isn't delayed by an extra model round-trip on top of the one every chat turn already pays. The sidebar picks up the generated title on its next server render.

`lib/chat/chats.ts` stays framework-agnostic — it exports `generateTitle` (the Model call, mirroring `buildRetrievalQuery`'s `model: BaseChatModel` parameter in `lib/rag/retrieval.ts`) and `updateTitle` (persists it), neither importing anything from Next.js. `app/api/chats/route.ts` is the only place that touches `after()`, builds the `ChatOllama` instance, and wires the two together.

Unlike `docs/adr/0002-fail-closed-on-retrieval-errors.md`'s fail-closed stance on retrieval errors, a title is cosmetic, not load-bearing: if generation fails (e.g. the Model is unreachable) the fallback truncated title stays, permanently — nothing retries it later. We accept a Chat occasionally being stuck with an unsummarized title over adding retry complexity for what's a nice-to-have, not something the visitor depends on for a correct answer.
