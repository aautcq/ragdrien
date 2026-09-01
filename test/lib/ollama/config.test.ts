import { describe, expect, it } from 'vitest'
import { resolveOllamaConfig, resolveOllamaEmbeddingConfig } from '@/lib/ollama/config'

describe('resolveOllamaConfig', () => {
  // The route-seam tests in app/api/chat/route.test.ts cover the default
  // model fallback end-to-end over HTTP. They don't cover the default base
  // URL (http://localhost:11434) the same way, since binding a fake Ollama
  // server on that literal port would conflict with a real Ollama instance
  // possibly running on the developer's machine. This unit test is the
  // deliberate stand-in for that one case.
  it('falls back to the default model and base URL when the env vars are unset', () => {
    expect(resolveOllamaConfig({})).toEqual({
      baseUrl: 'http://localhost:11434',
      model: 'mistral:latest'
    })
  })

  it('uses OLLAMA_MODEL and OLLAMA_BASE_URL from the environment when set', () => {
    expect(resolveOllamaConfig({
      OLLAMA_BASE_URL: 'http://example.test:1234',
      OLLAMA_MODEL: 'llama3'
    })).toEqual({
      baseUrl: 'http://example.test:1234',
      model: 'llama3'
    })
  })
})

describe('resolveOllamaEmbeddingConfig', () => {
  it('falls back to the default embedding model and base URL when the env vars are unset', () => {
    expect(resolveOllamaEmbeddingConfig({})).toEqual({
      baseUrl: 'http://localhost:11434',
      model: 'nomic-embed-text'
    })
  })

  it('uses OLLAMA_EMBEDDING_MODEL and OLLAMA_BASE_URL from the environment when set', () => {
    expect(resolveOllamaEmbeddingConfig({
      OLLAMA_BASE_URL: 'http://example.test:1234',
      OLLAMA_EMBEDDING_MODEL: 'all-minilm'
    })).toEqual({
      baseUrl: 'http://example.test:1234',
      model: 'all-minilm'
    })
  })
})
