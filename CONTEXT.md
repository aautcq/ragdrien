# Ragdrien

A personal chatbot: visitors converse with a locally-running LLM about the site owner, with replies grounded in the owner's own documents (RAG) whenever retrieval finds relevant content. This is the Next.js/React/shadcn sibling of the original Nuxt/Vue implementation, kept feature-identical.

## Language

**Turn**:
One exchange in the visible transcript: a visitor message followed by the assistant's reply.

**Conversational turn**:
A turn answered with the full visitor-visible transcript as context — every prior Turn's messages, not just the latest, reach the model. The transcript is sent uncapped; there is no truncation by turn count or token budget.

**RAG**:
Retrieval-Augmented Generation — answering a turn using content retrieved from the owner's own documents, rather than the model's general knowledge alone. The visitor's message is embedded and matched against the Vector store; Chunks that clear the Relevance threshold are injected into the prompt as grounding context. When none clear it (or the store is empty), the turn falls back to a plain, ungrounded reply.

**Relevance threshold**:
The minimum similarity a Chunk's Embedding must reach against the query Embedding to be considered a match worth injecting into the prompt. Chunks below it are discarded rather than forced into context.

**Model**:
The local Ollama-hosted LLM that generates assistant replies, selectable via configuration rather than hardcoded.

**Document**:
One source file (Markdown or PDF) under `lib/rag/documents/`, in its raw authored form before any processing.

**Chunk**:
A contiguous slice of a Document's extracted text, sized to fit the embedding model's input limit; the unit that gets embedded and stored. For Markdown Documents, boundaries follow section structure (headings/paragraphs); for PDF Documents, whose extracted text has no such structure, boundaries are chosen by size alone.

**Embedding**:
The numeric vector representation of a Chunk, produced by the embedding model.

**Vector store**:
The in-memory index of (Chunk, Embedding) pairs, built lazily on first use and held for the server process's lifetime. Not persisted to disk.
