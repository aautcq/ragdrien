import type { IncomingMessage, Server, ServerResponse } from 'node:http'
import { createServer } from 'node:http'

export interface FakeOllamaRequest {
  path: string
  body: Record<string, unknown>
}

export interface FakeOllamaResponse {
  status?: number
  /** Sent as a `application/x-ndjson` streamed body, one line per chunk. */
  chunks?: string[]
  /** Sent as a single `application/json` body (e.g. to simulate an Ollama error). */
  json?: unknown
}

export type FakeOllamaResponder = (body: Record<string, unknown>) => FakeOllamaResponse

export interface FakeOllamaServer {
  url: string
  requests: FakeOllamaRequest[]
  setResponder: (responder: FakeOllamaResponder) => void
  close: () => Promise<void>
}

/**
 * Starts a minimal local HTTP server that stands in for a real Ollama
 * instance, so tests can assert on what the server route sends it and
 * control what it sends back, without touching LangChain/ChatOllama.
 */
export async function startFakeOllama(initialResponder: FakeOllamaResponder, port = 0): Promise<FakeOllamaServer> {
  const requests: FakeOllamaRequest[] = []
  let responder = initialResponder
  let closed = false

  const server: Server = createServer((req: IncomingMessage, res: ServerResponse) => {
    const chunks: Buffer[] = []
    req.on('data', chunk => chunks.push(chunk))
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf-8')
      const body = raw ? JSON.parse(raw) : {}
      requests.push({ path: req.url ?? '', body })

      const result = responder(body)

      if (result.json !== undefined) {
        res.writeHead(result.status ?? 200, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify(result.json))
        return
      }

      res.writeHead(result.status ?? 200, { 'Content-Type': 'application/x-ndjson' })
      for (const chunk of result.chunks ?? []) {
        res.write(`${chunk}\n`)
      }
      res.end()
    })
  })

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, '127.0.0.1', () => resolve())
  })

  const address = server.address()
  const resolvedPort = typeof address === 'object' && address ? address.port : port

  return {
    url: `http://127.0.0.1:${resolvedPort}`,
    requests,
    setResponder: (next) => {
      responder = next
    },
    close: () => {
      if (closed) {
        return Promise.resolve()
      }
      closed = true
      return new Promise<void>((resolve, reject) => {
        server.close(err => err ? reject(err) : resolve())
      })
    }
  }
}

/** A single successful, streamed Ollama `/api/chat` response. */
export function successChunks(text: string, model = 'test-model'): string[] {
  return [
    JSON.stringify({ model, created_at: new Date().toISOString(), message: { role: 'assistant', content: text }, done: false }),
    JSON.stringify({
      model,
      created_at: new Date().toISOString(),
      message: { role: 'assistant', content: '' },
      done: true,
      done_reason: 'stop'
    })
  ]
}
