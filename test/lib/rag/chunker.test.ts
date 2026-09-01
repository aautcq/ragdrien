import { describe, expect, it } from 'vitest'
import { chunkDocument } from '@/lib/rag/chunker'

describe('chunkDocument', () => {
  it('keeps a short document as a single chunk', async () => {
    const chunks = await chunkDocument({ id: 'short.md', content: '# Title\n\nA short paragraph.' })

    expect(chunks).toEqual([
      { documentId: 'short.md', index: 0, content: '# Title\n\nA short paragraph.' }
    ])
  })

  it('splits a document too long for one chunk on section boundaries, tagging each chunk with its document id and position', async () => {
    const section = (n: number) => `## Section ${n}\n\n${'lorem ipsum '.repeat(80)}`
    const content = [section(1), section(2), section(3)].join('\n\n')

    const chunks = await chunkDocument({ id: 'long.md', content })

    expect(chunks.length).toBeGreaterThan(1)
    chunks.forEach((chunk, i) => {
      expect(chunk.documentId).toBe('long.md')
      expect(chunk.index).toBe(i)
      expect(chunk.content.length).toBeLessThanOrEqual(1000)
    })
  })

  it('keeps a short pdf document as a single chunk', async () => {
    const chunks = await chunkDocument({ id: 'short.pdf', content: 'A short paragraph extracted from a PDF.' })

    expect(chunks).toEqual([
      { documentId: 'short.pdf', index: 0, content: 'A short paragraph extracted from a PDF.' }
    ])
  })

  it('splits a long pdf document by size only, unlike the section-aware splitting used for markdown', async () => {
    const section = (n: number) => `## Section ${n}\n\n${'lorem ipsum '.repeat(80)}`
    const content = [section(1), section(2), section(3)].join('\n\n')

    const mdChunks = await chunkDocument({ id: 'long.md', content })
    const pdfChunks = await chunkDocument({ id: 'long.pdf', content })

    expect(pdfChunks.length).toBeGreaterThan(1)
    pdfChunks.forEach((chunk, i) => {
      expect(chunk.documentId).toBe('long.pdf')
      expect(chunk.index).toBe(i)
      expect(chunk.content.length).toBeLessThanOrEqual(1000)
    })
    expect(pdfChunks.map(chunk => chunk.content)).not.toEqual(mdChunks.map(chunk => chunk.content))
  })
})
