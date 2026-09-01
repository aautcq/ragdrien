import { copyFile, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadDocuments } from '@/lib/rag/documents'

const SAMPLE_PDF = join(__dirname, '../../fixtures/sample.pdf')
const CORRUPT_PDF = join(__dirname, '../../fixtures/corrupt.pdf')

describe('loadDocuments', () => {
  let dir: string | undefined

  afterEach(async () => {
    if (dir) {
      await rm(dir, { recursive: true, force: true })
      dir = undefined
    }
  })

  it('returns an empty array when the directory does not exist', async () => {
    expect(await loadDocuments(join(tmpdir(), 'ragdrien-does-not-exist'))).toEqual([])
  })

  it('returns an empty array when the directory has no markdown files', async () => {
    dir = await mkdtemp(join(tmpdir(), 'ragdrien-rag-'))
    await writeFile(join(dir, 'notes.txt'), 'ignored')

    expect(await loadDocuments(dir)).toEqual([])
  })

  it('loads markdown files, sorted by file name, with their raw content', async () => {
    dir = await mkdtemp(join(tmpdir(), 'ragdrien-rag-'))
    await writeFile(join(dir, 'b.md'), '# Second')
    await writeFile(join(dir, 'a.md'), '# First')

    expect(await loadDocuments(dir)).toEqual([
      { id: 'a.md', content: '# First' },
      { id: 'b.md', content: '# Second' }
    ])
  })

  it('rethrows errors other than "directory does not exist" instead of treating them as no documents', async () => {
    dir = await mkdtemp(join(tmpdir(), 'ragdrien-rag-'))
    const notADirectory = join(dir, 'a-file.md')
    await writeFile(notADirectory, '# Not a directory')

    // Passing a file path where a directory is expected fails with ENOTDIR,
    // not ENOENT — that's a real misconfiguration, not "nothing to load".
    await expect(loadDocuments(notADirectory)).rejects.toThrow()
  })

  it('loads pdf files, extracting their text content', async () => {
    dir = await mkdtemp(join(tmpdir(), 'ragdrien-rag-'))
    await copyFile(SAMPLE_PDF, join(dir, 'sample.pdf'))

    expect(await loadDocuments(dir)).toEqual([
      { id: 'sample.pdf', content: 'Hello PDF' }
    ])
  })

  it('loads markdown and pdf files together, sorted by file name', async () => {
    dir = await mkdtemp(join(tmpdir(), 'ragdrien-rag-'))
    await writeFile(join(dir, 'b.md'), '# Second')
    await copyFile(SAMPLE_PDF, join(dir, 'a.pdf'))

    expect(await loadDocuments(dir)).toEqual([
      { id: 'a.pdf', content: 'Hello PDF' },
      { id: 'b.md', content: '# Second' }
    ])
  })

  it('skips a pdf that fails to parse, logging a warning, instead of failing the whole load', async () => {
    dir = await mkdtemp(join(tmpdir(), 'ragdrien-rag-'))
    await copyFile(CORRUPT_PDF, join(dir, 'broken.pdf'))
    await writeFile(join(dir, 'ok.md'), '# Fine')
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    expect(await loadDocuments(dir)).toEqual([
      { id: 'ok.md', content: '# Fine' }
    ])
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('broken.pdf'))

    warn.mockRestore()
  })
})
