# Ragdrien

A personal chatbot: visitors converse with a locally-running LLM about the site owner, with replies grounded in the owner's own documents (RAG) whenever retrieval finds relevant content. This is the Next.js/React/shadcn sibling of the original Nuxt/Vue implementation, kept feature-identical.

## Language

**Turn**:
One exchange in the visible transcript: a visitor message followed by the assistant's reply.

**Conversational turn**:
A turn answered with the full visitor-visible transcript as context — every prior Turn's messages, not just the latest, reach the model. The transcript is sent uncapped; there is no truncation by turn count or token budget.

**RAG**:
Retrieval-Augmented Generation — answering a turn using content retrieved from the owner's own documents, rather than the model's general knowledge alone. The Retrieval query is embedded and matched against the Vector store; Chunks that clear the Relevance threshold are injected into the prompt as grounding context. When none clear it (or the store is empty), the turn falls back to a plain, ungrounded reply.

**Retrieval query**:
The query text used to search the Vector store for a turn: a standalone, English rewrite of the whole Conversational turn's transcript, produced by the Model. Standalone so a message like "and the second one" resolves its reference to an earlier turn, and English because Documents are always English while a visitor may write in any language. Skipped only when the Vector store is empty (nothing to search), in which case the visitor's message is used as-is.

**Relevance threshold**:
The minimum similarity a Chunk's Embedding must reach against the query Embedding to be considered a match worth injecting into the prompt. Chunks below it are discarded rather than forced into context.

**Model**:
The local Ollama-hosted LLM that generates assistant replies, selectable via configuration rather than hardcoded.

**Document**:
One source file (Markdown or PDF) under `lib/rag/documents/`. Either hand-authored directly, or fetched from a web page and cleaned into Markdown by `scripts/fetch-document.ts` — either way, always written in English, regardless of the visitor's language — see Retrieval query. A fetched Document carries the page it came from as its source url, parsed from a leading frontmatter block and never exposed to the Model as part of its content.

**Chunk**:
A contiguous slice of a Document's extracted text, sized to fit the embedding model's input limit; the unit that gets embedded and stored. For Markdown Documents, boundaries follow section structure (headings/paragraphs); for PDF Documents, whose extracted text has no such structure, boundaries are chosen by size alone.

**Embedding**:
The numeric vector representation of a Chunk, produced by the embedding model.

**Vector store**:
The in-memory index of (Chunk, Embedding) pairs, built lazily on first use and held for the server process's lifetime. Not persisted to disk.

**Source**:
A Document that contributed at least one Chunk to a turn's grounding context, shown to the visitor as a "Sources:" list beneath the reply once it has finished streaming. Chunks from the same Document collapse into a single Source entry, ordered by that Document's best-scoring Chunk, highest first. Links out to the Document's source url when it has one (see Document). Absent entirely from an ungrounded turn's reply.
_Avoid_: Citation, Reference
