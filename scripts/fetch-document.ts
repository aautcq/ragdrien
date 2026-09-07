import { basename, join } from 'node:path'
import { access, mkdir, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { Readability } from '@mozilla/readability'
import { JSDOM } from 'jsdom'
import { ChatOllama } from '@langchain/ollama'
import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import { resolveOllamaConfig } from '@/lib/ollama/config'

const DOCUMENTS_DIR = join(process.cwd(), 'lib/rag/documents')

const CLEANUP_INSTRUCTION = 'You turn a web page\'s extracted article content into a clean Markdown document. '
  + 'Rewrite the article below as well-structured Markdown: use a single top-level heading for the title, '
  + 'section headings where appropriate, and plain paragraphs/lists for the body. Preserve all factual content '
  + '(names, dates, numbers, links-worthy details) faithfully — do not summarize, embellish, or add commentary. '
  + 'Strip anything that isn\'t part of the article itself (navigation, ads, cookie notices, unrelated boilerplate). '
  + 'Respond with only the Markdown document, nothing else.'

export interface ParsedArgs {
  url: string
  filename: string
  force: boolean
}

/**
 * Parses the script's CLI arguments: `<url> <filename> [--force]`. The
 * filename must be a bare ".md" file name (no path segments) since it names
 * a Document written directly under lib/rag/documents/ — see
 * lib/rag/documents.ts.
 */
export function parseArgs(argv: string[]): ParsedArgs {
  const force = argv.includes('--force')
  const [url, filename] = argv.filter(arg => arg !== '--force')

  if (!url || !filename) {
    throw new Error('Usage: pnpm fetch-document <url> <filename.md> [--force]')
  }

  if (filename !== basename(filename) || !filename.endsWith('.md')) {
    throw new Error(`filename must be a bare ".md" file name, got "${filename}"`)
  }

  return { url, filename, force }
}

export interface ExtractedArticle {
  title: string
  content: string
}

/**
 * Fetches a URL and extracts its main readable content (stripping nav, ads,
 * and other boilerplate) via Readability — the same approach browsers use
 * for reader mode. Throws a clear error if the page can't be fetched, or if
 * Readability can't find an article in it (e.g. a page that only renders
 * content client-side via JavaScript, which a plain fetch never executes).
 */
export async function fetchArticle(url: string): Promise<ExtractedArticle> {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`)
  }

  const html = await response.text()
  const dom = new JSDOM(html, { url })
  const article = new Readability(dom.window.document).parse()

  if (!article?.content) {
    throw new Error(`Could not extract readable article content from ${url}`)
  }

  return { title: article.title || url, content: article.content }
}

const CODE_FENCE_PATTERN = /^```(?:markdown)?\r?\n([\s\S]*?)\r?\n```$/

/**
 * Strips a wrapping ```markdown fence, if the model added one despite being
 * told not to (a common LLM quirk when asked to "respond with only" a
 * document) — leaves anything else untouched.
 */
function stripCodeFence(text: string): string {
  const match = text.match(CODE_FENCE_PATTERN)
  return match ? match[1] : text
}

/**
 * Asks the configured Ollama chat model to rewrite an extracted article as
 * clean Markdown. Reuses resolveOllamaConfig/the chat model rather than a
 * dedicated model — this is a general text-cleanup task, not one shown to
 * need a different model.
 */
export async function cleanWithOllama(article: ExtractedArticle): Promise<string> {
  const { baseUrl, model: modelName } = resolveOllamaConfig()
  const model = new ChatOllama({ baseUrl, model: modelName })

  const response = await model.invoke([
    new SystemMessage(CLEANUP_INSTRUCTION),
    new HumanMessage(`Title: ${article.title}\n\n${article.content}`)
  ])

  const content = typeof response.content === 'string' ? stripCodeFence(response.content.trim()) : ''
  if (!content) {
    throw new Error('Ollama returned an empty cleaned document')
  }

  return content
}

/** Prepends a minimal frontmatter block recording where a Document came from — see CONTEXT.md's Document term. */
export function withFrontmatter(markdown: string, url: string, fetchedAt: Date = new Date()): string {
  return `---\nsource: ${url}\nfetchedAt: ${fetchedAt.toISOString()}\n---\n\n${markdown}\n`
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path)
    return true
  } catch {
    return false
  }
}

/**
 * Fetches a web page, extracts its readable content, cleans it into
 * Markdown via Ollama, and writes it to <documentsDir>/<filename> as a new
 * (or --force-overwritten) Document. Defaults to lib/rag/documents/ —
 * overridable for tests, mirroring lib/rag/documents.ts's loadDocuments.
 */
export async function fetchDocument({ url, filename, force }: ParsedArgs, documentsDir: string = DOCUMENTS_DIR): Promise<string> {
  const path = join(documentsDir, filename)

  if (!force && await fileExists(path)) {
    throw new Error(`${filename} already exists in lib/rag/documents/ — pass --force to overwrite it`)
  }

  const article = await fetchArticle(url)
  const markdown = await cleanWithOllama(article)

  await mkdir(documentsDir, { recursive: true })
  await writeFile(path, withFrontmatter(markdown, url))

  return path
}

const isMain = process.argv[1] !== undefined && fileURLToPath(import.meta.url) === process.argv[1]

async function main() {
  // Run outside Next.js (via `tsx`), so .env isn't loaded automatically the
  // way it is for `next dev`/`build`/`start` — load it explicitly here,
  // scoped to script execution only (not test imports of this module).
  const { loadEnvConfig } = await import('@next/env')
  loadEnvConfig(process.cwd(), process.env.NODE_ENV !== 'production')

  const args = parseArgs(process.argv.slice(2))
  const path = await fetchDocument(args)
  console.log(`Wrote ${path}`)
}

if (isMain) {
  main().catch((error: Error) => {
    console.error(error.message)
    process.exit(1)
  })
}
