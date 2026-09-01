const DEFAULT_MODEL = 'mistral:latest'
const DEFAULT_BASE_URL = 'http://localhost:11434'
const DEFAULT_EMBEDDING_MODEL = 'nomic-embed-text'

/**
 * Resolves the Ollama model and base URL from the environment, read at
 * request time (not build time), falling back to sensible defaults so the
 * app works out of the box.
 */
export function resolveOllamaConfig(env: Partial<Record<string, string>> = process.env) {
  return {
    baseUrl: env.OLLAMA_BASE_URL || DEFAULT_BASE_URL,
    model: env.OLLAMA_MODEL || DEFAULT_MODEL
  }
}

/**
 * Resolves the Ollama embedding model and base URL from the environment,
 * mirroring resolveOllamaConfig. Shares the same base URL as the chat model
 * (one local Ollama instance), but the embedding model is configured
 * separately since it's a different kind of model (e.g. nomic-embed-text).
 */
export function resolveOllamaEmbeddingConfig(env: Partial<Record<string, string>> = process.env) {
  return {
    baseUrl: env.OLLAMA_BASE_URL || DEFAULT_BASE_URL,
    model: env.OLLAMA_EMBEDDING_MODEL || DEFAULT_EMBEDDING_MODEL
  }
}
