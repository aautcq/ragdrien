import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { extractText, getDocumentProxy } from 'unpdf'

export interface RagDocument {
  /** File name (e.g. "about-me.md"), kept as a stable id for its chunks. */
  id: string
  content: string
}

// import.meta.dirname isn't reliably populated once this module is bundled
// by Next.js's server build (webpack/Turbopack strip the original file
// location), even though it works fine under vitest's own ESM loader. Next.js
// always runs the server with the project root as its working directory, so
// resolve relative to that instead.
const DEFAULT_DOCUMENTS_DIR = join(process.cwd(), 'lib/rag/documents')

const ACCEPTED_EXTENSIONS = ['.md', '.pdf']

/**
 * Reads one source file's raw text: markdown is read as-is, PDF text is
 * extracted via unpdf. Returns null (rather than throwing) for a PDF that
 * fails to parse — e.g. a scanned/image-only or corrupt file — so one bad
 * document doesn't stop the rest of the corpus from loading.
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

  const content = await readFile(path, 'utf-8')
  return { id, content }
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
