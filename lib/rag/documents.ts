import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { extractText, getDocumentProxy } from 'unpdf'

export interface RagDocument {
  /** File name (e.g. "about-me.md"), kept as a stable id for its chunks. */
  id: string
  content: string
  /**
   * The page this Document was fetched from, when known — parsed from a
   * leading frontmatter block (e.g. written by scripts/fetch-document.ts)
   * and stripped out of content. Absent for hand-authored documents.
   */
  sourceUrl?: string
}

// import.meta.dirname isn't reliably populated once this module is bundled
// by Next.js's server build (webpack/Turbopack strip the original file
// location), even though it works fine under vitest's own ESM loader. Next.js
// always runs the server with the project root as its working directory, so
// resolve relative to that instead.
const DEFAULT_DOCUMENTS_DIR = join(process.cwd(), 'lib/rag/documents')

const ACCEPTED_EXTENSIONS = ['.md', '.pdf']

/** Matches a leading `---\n...\n---` frontmatter block at the very start of a file. */
const FRONTMATTER_PATTERN = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/

/** A single flat `key: value` frontmatter line. */
const FRONTMATTER_LINE_PATTERN = /^(\w+):\s*(.*)$/

/**
 * Parses a minimal, flat `key: value` frontmatter block off the start of
 * markdown content (no nested structures or arrays — just the handful of
 * scalar fields scripts/fetch-document.ts writes, e.g. `source` and
 * `fetchedAt`). Returns the content with the block stripped, plus whatever
 * `source` value was found (if any). Content with no leading frontmatter
 * block — including a hand-authored document that merely opens with a
 * Markdown horizontal rule (`---`) — is returned unchanged: every non-blank
 * line inside a leading `---`/`---` span must look like `key: value`, or
 * the whole span is left alone rather than silently discarded.
 */
function parseFrontmatter(raw: string): { content: string, sourceUrl?: string } {
  const match = raw.match(FRONTMATTER_PATTERN)
  if (!match) {
    return { content: raw }
  }

  const [block, body] = match
  const lines = body.split(/\r?\n/).filter(line => line.trim() !== '')
  if (lines.length === 0 || !lines.every(line => FRONTMATTER_LINE_PATTERN.test(line))) {
    return { content: raw }
  }

  let sourceUrl: string | undefined
  for (const line of lines) {
    const [, key, value] = line.match(FRONTMATTER_LINE_PATTERN) ?? []
    if (key === 'source' && value) {
      sourceUrl = value.trim()
    }
  }

  return { content: raw.slice(block.length), sourceUrl }
}

/**
 * Reads one source file's raw text: markdown is read as-is (minus any
 * leading frontmatter block, see parseFrontmatter), PDF text is extracted
 * via unpdf. Returns null (rather than throwing) for a PDF that fails to
 * parse — e.g. a scanned/image-only or corrupt file — so one bad document
 * doesn't stop the rest of the corpus from loading.
 */
async function readDocument(path: string, id: string): Promise<RagDocument | null> {
  if (id.endsWith('.pdf')) {
    try {
      const buffer = await readFile(path)
      const pdf = await getDocumentProxy(new Uint8Array(buffer))
      const { text } = await extractText(pdf, { mergePages: true })
      return { id, content: text }
    } catch (error) {
      console.warn(`[rag] Skipping ${id} — failed to extract PDF text: ${(error as Error).message}`)
      return null
    }
  }

  const raw = await readFile(path, 'utf-8')
  const { content, sourceUrl } = parseFrontmatter(raw)
  return sourceUrl ? { id, content, sourceUrl } : { id, content }
}

/**
 * Loads every markdown and PDF file directly under lib/rag/documents/.
 * Returns an empty array — rather than throwing — if the folder is missing
 * or has no recognized documents, so the app still boots with zero
 * documents.
 */
export async function loadDocuments(directory: string = DEFAULT_DOCUMENTS_DIR): Promise<RagDocument[]> {
  let entries: string[]
  try {
    entries = await readdir(directory)
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return []
    }
    throw error
  }

  const sourceFiles = entries.filter(name => ACCEPTED_EXTENSIONS.some(ext => name.endsWith(ext))).sort()

  const documents = await Promise.all(sourceFiles.map(id => readDocument(join(directory, id), id)))

  return documents.filter((document): document is RagDocument => document !== null)
}
