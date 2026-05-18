import { createHash } from 'crypto'

export interface EmbeddingProvider {
  embed(text: string): Promise<number[]>
  embedBatch(texts: string[]): Promise<number[][]>
  dimensions: number
}

const VOCAB_SIZE = 8192
const EMBEDDING_DIM = 256

function hashToken(token: string): number {
  const h = createHash('sha256').update(token).digest()
  return (h.readUInt32BE(0) % VOCAB_SIZE)
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 0)
}

function termFrequency(tokens: string[]): Map<string, number> {
  const tf = new Map<string, number>()
  for (const t of tokens) {
    tf.set(t, (tf.get(t) ?? 0) + 1)
  }
  const len = tokens.length || 1
  for (const [k, v] of tf) {
    tf.set(k, v / len)
  }
  return tf
}

function tfidfToVector(tf: Map<string, number>, idf: Map<string, number>): number[] {
  const vec = new Float64Array(EMBEDDING_DIM)
  for (const [term, freq] of tf) {
    const idfVal = idf.get(term) ?? Math.log(10001)
    const weight = freq * idfVal
    const slot = hashToken(term) % EMBEDDING_DIM
    const sign = hashToken(term + '_sign') % 2 === 0 ? 1 : -1
    vec[slot] += sign * weight
  }
  // L2 normalize
  let norm = 0
  for (let i = 0; i < EMBEDDING_DIM; i++) {
    norm += vec[i] * vec[i]
  }
  norm = Math.sqrt(norm) || 1
  for (let i = 0; i < EMBEDDING_DIM; i++) {
    vec[i] /= norm
  }
  return Array.from(vec)
}

class TfidfEmbeddingProvider implements EmbeddingProvider {
  readonly dimensions = EMBEDDING_DIM
  private idf: Map<string, number> = new Map()
  private docCount = 0

  updateIdf(allTexts: string[]): void {
    this.docCount = allTexts.length
    const df = new Map<string, number>()
    for (const text of allTexts) {
      const seen = new Set<string>()
      for (const token of tokenize(text)) {
        if (!seen.has(token)) {
          df.set(token, (df.get(token) ?? 0) + 1)
          seen.add(token)
        }
      }
    }
    for (const [term, freq] of df) {
      this.idf.set(term, Math.log((this.docCount + 1) / (freq + 1)) + 1)
    }
  }

  async embed(text: string): Promise<number[]> {
    const tokens = tokenize(text)
    const tf = termFrequency(tokens)
    if (this.idf.size === 0) {
      // Fallback: use TF only with smoothed IDF
      const fallbackIdf = new Map<string, number>()
      for (const term of tf.keys()) {
        fallbackIdf.set(term, 1.0)
      }
      return tfidfToVector(tf, fallbackIdf)
    }
    return tfidfToVector(tf, this.idf)
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    // Update IDF from this batch if not yet initialized
    if (this.idf.size === 0) {
      this.updateIdf(texts)
    }
    return Promise.all(texts.map(t => this.embed(t)))
  }
}

/**
 * OpenAI embedding provider — uses text-embedding-3-small for semantic similarity.
 * Falls back gracefully if API key is not available.
 */
class OpenAIEmbeddingProvider implements EmbeddingProvider {
  readonly dimensions = 1536
  private apiKey: string
  private baseUrl: string
  private model: string

  constructor(apiKey: string, baseUrl = 'https://api.openai.com/v1', model = 'text-embedding-3-small') {
    this.apiKey = apiKey
    this.baseUrl = baseUrl
    this.model = model
  }

  async embed(text: string): Promise<number[]> {
    const results = await this.embedBatch([text])
    return results[0]!
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const response = await fetch(`${this.baseUrl}/embeddings`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: this.model,
        input: texts,
      }),
    })

    if (!response.ok) {
      throw new Error(`OpenAI embedding API error: ${response.status} ${await response.text()}`)
    }

    const data = await response.json() as {
      data: Array<{ embedding: number[] }>
    }

    return data.data.map(d => d.embedding)
  }
}

/**
 * Ollama embedding provider — uses local Ollama instance for embeddings.
 */
class OllamaEmbeddingProvider implements EmbeddingProvider {
  readonly dimensions = 768
  private baseUrl: string
  private model: string

  constructor(baseUrl = 'http://localhost:11434', model = 'nomic-embed-text') {
    this.baseUrl = baseUrl
    this.model = model
  }

  async embed(text: string): Promise<number[]> {
    const results = await this.embedBatch([text])
    return results[0]!
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const response = await fetch(`${this.baseUrl}/api/embed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: this.model, input: texts }),
    })

    if (!response.ok) {
      throw new Error(`Ollama embedding API error: ${response.status} ${await response.text()}`)
    }

    const data = await response.json() as {
      embeddings: number[][]
    }

    return data.embeddings
  }
}

/**
 * Auto-detect the best available embedding provider based on environment.
 * Priority: OpenAI API key > Ollama running > TF-IDF fallback.
 */
export function autoDetectEmbeddingProvider(): EmbeddingProvider {
  const openaiKey = process.env.OPENAI_API_KEY
  if (openaiKey) {
    const baseUrl = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'
    return new OpenAIEmbeddingProvider(openaiKey, baseUrl)
  }

  // Check for Ollama via environment or common port
  const ollamaUrl = process.env.OLLAMA_BASE_URL || 'http://localhost:11434'
  // Ollama is checked lazily — we set the provider and let it fail gracefully
  if (process.env.OLLAMA_BASE_URL || process.env.USE_OLLAMA_EMBEDDINGS) {
    return new OllamaEmbeddingProvider(ollamaUrl)
  }

  // Fallback to TF-IDF
  return new TfidfEmbeddingProvider()
}

// Singleton provider
let _provider: EmbeddingProvider | null = null

export function getEmbeddingProvider(): EmbeddingProvider {
  if (!_provider) {
    _provider = autoDetectEmbeddingProvider()
  }
  return _provider
}

export function setEmbeddingProvider(provider: EmbeddingProvider): void {
  _provider = provider
}

export function resetEmbeddingProvider(): void {
  _provider = null
}

export async function generateEmbedding(text: string): Promise<number[]> {
  return getEmbeddingProvider().embed(text)
}

export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  return getEmbeddingProvider().embedBatch(texts)
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0
  let dot = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!
    normA += a[i]! * a[i]!
    normB += b[i]! * b[i]!
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB)
  return denom === 0 ? 0 : dot / denom
}
