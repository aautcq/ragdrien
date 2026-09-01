import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { startFakeOllama, successChunks, type FakeOllamaServer } from '../helpers/fake-ollama'
import {
  cleanWithOllama,
  fetchArticle,
  fetchDocument,
  parseArgs,
  withFrontmatter
} from '@/scripts/fetch-document'

const SAMPLE_HTML = `
  <html>
    <head><title>Sample Page</title></head>
    <body>
      <nav>Home | About | Contact</nav>
      <article>
        <h1>Sample Page</h1>
        <p>${'This is the real article content. '.repeat(20)}</p>
      </article>
      <footer>Copyright 2026</footer>
    </body>
  </html>
`

const ORIGINAL_ENV = { ...process.env }

describe('parseArgs', () => {
  it('parses a url and filename with no --force flag', () => {
    expect(parseArgs(['https://example.com', 'about.md'])).toEqual({
      url: 'https://example.com',
      filename: 'about.md',
      force: false
    })
  })

  it('detects a --force flag in any position', () => {
    expect(parseArgs(['--force', 'https://example.com', 'about.md'])).toEqual({
      url: 'https://example.com',
      filename: 'about.md',
      force: true
    })
  })

  it('throws when the url or filename is missing', () => {
    expect(() => parseArgs([])).toThrow(/Usage/)
    expect(() => parseArgs(['https://example.com'])).toThrow(/Usage/)
  })

  it('throws when the filename has path segments', () => {
    expect(() => parseArgs(['https://example.com', '../about.md'])).toThrow(/bare ".md" file name/)
  })

  it('throws when the filename does not end with .md', () => {
    expect(() => parseArgs(['https://example.com', 'about.txt'])).toThrow(/bare ".md" file name/)
  })
})

describe('fetchArticle', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('extracts the article\'s title and readable content, stripping nav/footer boilerplate', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, text: async () => SAMPLE_HTML }))

    const article = await fetchArticle('https://example.com')

    expect(article.title).toBe('Sample Page')
    expect(article.content).toContain('This is the real article content.')
    expect(article.content).not.toContain('Copyright 2026')
    expect(article.content).not.toContain('Home | About | Contact')
  })

  it('throws a clear error when the fetch response is not ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404, statusText: 'Not Found' }))

    await expect(fetchArticle('https://example.com/missing')).rejects.toThrow(/404/)
  })

  it('throws a clear error when no readable article can be extracted', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, text: async () => '<html><body></body></html>' }))

    await expect(fetchArticle('https://example.com/empty')).rejects.toThrow(/Could not extract/)
  })
})

describe('cleanWithOllama', () => {
  let ollama: FakeOllamaServer

  beforeEach(() => {
    process.env.OLLAMA_MODEL = 'test-model'
  })

  afterEach(async () => {
    await ollama.close()
    process.env = { ...ORIGINAL_ENV }
  })

  it('sends the article to Ollama and returns its cleaned Markdown response', async () => {
    ollama = await startFakeOllama(() => ({ chunks: successChunks('# Sample Page\n\nCleaned body.') }))
    process.env.OLLAMA_BASE_URL = ollama.url

    const markdown = await cleanWithOllama({ title: 'Sample Page', content: '<p>raw content</p>' })

    expect(markdown).toBe('# Sample Page\n\nCleaned body.')
    const [request] = ollama.requests
    const messages = request?.body.messages as { role: string, content: string }[]
    expect(messages[0]?.role).toBe('system')
    expect(messages[1]).toEqual({ role: 'user', content: 'Title: Sample Page\n\n<p>raw content</p>' })
  })

  it('strips a wrapping ```markdown code fence, if the model added one', async () => {
    ollama = await startFakeOllama(() => ({ chunks: successChunks('```markdown\n# Title\n\nBody.\n```') }))
    process.env.OLLAMA_BASE_URL = ollama.url

    const markdown = await cleanWithOllama({ title: 'Title', content: '<p>x</p>' })

    expect(markdown).toBe('# Title\n\nBody.')
  })

  it('throws a clear error when Ollama returns an empty document', async () => {
    ollama = await startFakeOllama(() => ({ chunks: successChunks('   ') }))
    process.env.OLLAMA_BASE_URL = ollama.url

    await expect(cleanWithOllama({ title: 'Title', content: '<p>x</p>' })).rejects.toThrow(/empty/)
  })

  it('surfaces a clear error when Ollama is unreachable', async () => {
    ollama = await startFakeOllama(() => ({ chunks: successChunks('reply') }))
    process.env.OLLAMA_BASE_URL = ollama.url
    await ollama.close()

    await expect(cleanWithOllama({ title: 'Title', content: '<p>x</p>' })).rejects.toThrow()
  })
})

describe('withFrontmatter', () => {
  it('prepends a source url and fetchedAt frontmatter block', () => {
    const result = withFrontmatter('# Body', 'https://example.com', new Date('2026-01-01T00:00:00.000Z'))

    expect(result).toBe('---\nsource: https://example.com\nfetchedAt: 2026-01-01T00:00:00.000Z\n---\n\n# Body\n')
  })
})

describe('fetchDocument', () => {
  let dir: string | undefined
  let ollama: FakeOllamaServer
  const realFetch = globalThis.fetch

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'ragdrien-fetch-document-'))
    ollama = await startFakeOllama(() => ({ chunks: successChunks('# Sample Page\n\nCleaned body.') }))
    process.env.OLLAMA_BASE_URL = ollama.url
    process.env.OLLAMA_MODEL = 'test-model'
    // Only intercept the fetched web page's URL — Ollama's own client also
    // uses global fetch to reach the fake Ollama server, so anything else
    // must pass through to the real implementation.
    vi.stubGlobal('fetch', vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      return input.toString() === 'https://example.com'
        ? Promise.resolve({ ok: true, text: async () => SAMPLE_HTML } as Response)
        : realFetch(input, init)
    }))
  })

  afterEach(async () => {
    if (dir) {
      await rm(dir, { recursive: true, force: true })
      dir = undefined
    }
    await ollama.close()
    process.env = { ...ORIGINAL_ENV }
    vi.unstubAllGlobals()
  })

  it('writes a cleaned, frontmatter-prefixed Document to the target directory', async () => {
    const path = await fetchDocument({ url: 'https://example.com', filename: 'about.md', force: false }, dir!)

    expect(path).toBe(join(dir!, 'about.md'))
    const written = await readFile(path, 'utf-8')
    expect(written).toContain('source: https://example.com')
    expect(written).toContain('# Sample Page\n\nCleaned body.')
  })

  it('refuses to overwrite an existing file without --force', async () => {
    await writeFile(join(dir!, 'about.md'), 'existing content')

    await expect(fetchDocument({ url: 'https://example.com', filename: 'about.md', force: false }, dir!))
      .rejects.toThrow(/already exists/)
    expect(await readFile(join(dir!, 'about.md'), 'utf-8')).toBe('existing content')
  })

  it('overwrites an existing file when --force is passed', async () => {
    await writeFile(join(dir!, 'about.md'), 'existing content')

    await fetchDocument({ url: 'https://example.com', filename: 'about.md', force: true }, dir!)

    expect(await readFile(join(dir!, 'about.md'), 'utf-8')).toContain('Cleaned body.')
  })
})
