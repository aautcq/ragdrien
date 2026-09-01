import { OllamaEmbeddings } from '@langchain/ollama'
import { resolveOllamaEmbeddingConfig } from '../ollama/config'

/**
 * Creates the embeddings client used to vectorize chunks, configured the
 * same way as the chat model (env vars resolved at call time).
 */
export function createEmbeddings(config = resolveOllamaEmbeddingConfig()): OllamaEmbeddings {
  return new OllamaEmbeddings(config)
}
