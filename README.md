# RAGdrien

A personal chatbot: visitors converse with a locally-running LLM about the
site owner, with replies grounded in the owner's own documents (RAG) whenever
retrieval finds relevant content. This is the Next.js/React/shadcn sibling of
the original Nuxt/Vue implementation, kept feature-identical.

See [`CONTEXT.md`](./CONTEXT.md) for the domain glossary (Turn, Chunk,
Vector store, Visitor, etc.) and [`docs/adr/`](./docs/adr/) for the design
decisions behind the RAG pipeline, persistence, and chat behavior.

## Prerequisites

- Node.js and [pnpm](https://pnpm.io)
- [Ollama](https://ollama.com) running locally, with the chat and embedding
  models pulled:

  ```bash
  ollama pull mistral
  ollama pull nomic-embed-text
  ```

## Getting started

```bash
cp .env.example .env
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) to see the result.
`.env` configures the Ollama base URL/models and the retrieval tuning
(`RAG_RETRIEVAL_K`, `RAG_RELEVANCE_THRESHOLD`) — see `.env.example` for
details.

## Adding documents (Ingestion)

Documents live as Markdown/PDF files under `lib/rag/documents/`. Either add
one by hand, or fetch and clean a web page into Markdown:

```bash
pnpm fetch-document <url> <filename.md>
```

Then rebuild the Vector store from whatever's currently under
`lib/rag/documents/`:

```bash
pnpm ingest-documents
```

Ingestion is never run automatically — restart the dev/prod server
afterwards to pick up the new store.

## Testing

```bash
pnpm test
```
