import { MarkdownTextSplitter, RecursiveCharacterTextSplitter } from '@langchain/textsplitters'
import type { RagDocument } from './documents'

export interface RagChunk {
  /** id of the source RagDocument this chunk was taken from. */
  documentId: string
  /** Position of this chunk within its source document, starting at 0. */
  index: number
  content: string
  /** Denormalized from the source RagDocument's sourceUrl, when it has one. */
  sourceUrl?: string
}

const CHUNK_SIZE = 1000
const CHUNK_OVERLAP = 200

/**
 * Splits a document's text into chunks, tagging each with its source
 * document id and position. Markdown documents split on heading/paragraph
 * boundaries first, falling back to a fixed-size window (with overlap) for
 * any section too long to keep whole — so a chunk's meaning stays intact
 * where possible. PDF-extracted text has no such structure to rely on
 * (page layout rarely preserves headings/paragraphs cleanly), so it's split
 * purely by size instead.
 */
export async function chunkDocument(document: RagDocument): Promise<RagChunk[]> {
  const splitter = document.id.endsWith('.pdf')
    ? new RecursiveCharacterTextSplitter({ chunkSize: CHUNK_SIZE, chunkOverlap: CHUNK_OVERLAP })
    : new MarkdownTextSplitter({ chunkSize: CHUNK_SIZE, chunkOverlap: CHUNK_OVERLAP })
  const parts = await splitter.splitText(document.content)

  return parts.map((content, index) => document.sourceUrl
    ? { documentId: document.id, index, content, sourceUrl: document.sourceUrl }
    : { documentId: document.id, index, content })
}
