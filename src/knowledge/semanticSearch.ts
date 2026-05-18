import { generateEmbedding } from './embeddings.js'
import { getVectorStore } from './vectorStore.js'
import type { SearchResult, DocumentChunk } from './types.js'

// Chunk content cache for filling in SearchResult.content / path / line info
const chunkCache: Map<string, { chunk: DocumentChunk; documentPath: string }> = new Map()

export function registerChunks(chunks: DocumentChunk[], documentPath: string): void {
  for (const chunk of chunks) {
    chunkCache.set(chunk.id, { chunk, documentPath })
  }
}

export function clearChunkCache(): void {
  chunkCache.clear()
}

function enrichResult(raw: SearchResult): SearchResult {
  const cached = chunkCache.get(raw.chunkId)
  if (cached) {
    return {
      ...raw,
      content: cached.chunk.content,
      documentPath: cached.documentPath,
      startLine: cached.chunk.startLine,
      endLine: cached.chunk.endLine,
    }
  }
  return raw
}

export async function search(query: string, topK: number = 10): Promise<SearchResult[]> {
  const embedding = await generateEmbedding(query)
  return searchByEmbedding(embedding, topK)
}

export function searchByEmbedding(embedding: number[], topK: number = 10): SearchResult[] {
  const store = getVectorStore()
  const results = store.search(embedding, topK)
  return results.map(enrichResult)
}

export function searchByKeyword(query: string, topK: number = 10): SearchResult[] {
  const terms = query.toLowerCase().split(/\s+/).filter(t => t.length > 0)
  if (terms.length === 0) return []

  const scored: Array<{ chunkId: string; documentId: string; score: number }> = []

  for (const [id, cached] of chunkCache) {
    const text = cached.chunk.content.toLowerCase()
    let score = 0
    for (const term of terms) {
      // Count occurrences
      let pos = 0
      let count = 0
      while ((pos = text.indexOf(term, pos)) !== -1) {
        count++
        pos += term.length
      }
      score += count
    }
    if (score > 0) {
      scored.push({ chunkId: id, documentId: cached.chunk.documentId, score })
    }
  }

  scored.sort((a, b) => b.score - a.score)

  return scored.slice(0, topK).map(s => enrichResult({
    chunkId: s.chunkId,
    documentId: s.documentId,
    content: '',
    score: s.score,
    documentPath: '',
    startLine: 0,
    endLine: 0,
  }))
}

export async function hybridSearch(query: string, topK: number = 10): Promise<SearchResult[]> {
  const [semanticResults, keywordResults] = await Promise.all([
    search(query, topK * 2),
    Promise.resolve(searchByKeyword(query, topK * 2)),
  ])

  // Merge with reciprocal rank fusion
  const scoreMap = new Map<string, { result: SearchResult; score: number }>()
  const k = 60 // RRF constant

  for (let i = 0; i < semanticResults.length; i++) {
    const r = semanticResults[i]!
    scoreMap.set(r.chunkId, {
      result: r,
      score: (scoreMap.get(r.chunkId)?.score ?? 0) + 1 / (k + i + 1),
    })
  }

  for (let i = 0; i < keywordResults.length; i++) {
    const r = keywordResults[i]!
    scoreMap.set(r.chunkId, {
      result: r,
      score: (scoreMap.get(r.chunkId)?.score ?? 0) + 1 / (k + i + 1),
    })
  }

  const merged = Array.from(scoreMap.values())
  merged.sort((a, b) => b.score - a.score)

  return merged.slice(0, topK).map(m => ({
    ...m.result,
    score: m.score,
  }))
}
