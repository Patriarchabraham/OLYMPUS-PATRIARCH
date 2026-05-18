import { createHash } from 'crypto'
import { join } from 'path'
import { mkdir } from 'fs/promises'
import { getVectorStore } from './vectorStore.js'
import { generateEmbeddings, getEmbeddingProvider, setEmbeddingProvider } from './embeddings.js'
import type { TfidfEmbeddingProvider } from './embeddings.js'
import { ingestDirectory, ingestFile } from './documentIngester.js'
import { hybridSearch, registerChunks, clearChunkCache } from './semanticSearch.js'
import { buildGraph, extractEntities, queryGraph, findRelated, findPath } from './knowledgeGraph.js'
import type { Document, KnowledgeGraph, RAGContext, IndexOptions, QueryOptions } from './types.js'

export class RAGEngine {
  private documents: Map<string, Document> = new Map()
  private graph: KnowledgeGraph | null = null
  private persistPath: string | null = null
  private isIndexed = false

  async index(dirPath: string, options?: IndexOptions): Promise<void> {
    const chunkSize = options?.chunkSize ?? 500
    const chunkOverlap = options?.chunkOverlap ?? 50
    this.persistPath = options?.persistPath ?? null

    // Ingest documents
    const docs = await ingestDirectory(dirPath, {
      extensions: options?.extensions,
      exclude: options?.exclude,
    })

    // Store documents
    for (const doc of docs) {
      this.documents.set(doc.id, doc)
    }

    // Re-chunk with specified size
    for (const doc of docs) {
      if (chunkSize !== 500) {
        doc.chunks = []
        // Re-import chunkDocument with custom size
        const { chunkDocument } = await import('./documentIngester.js')
        const lines = doc.content.split('\n')
        // chunkDocument uses default 500, handle custom size inline
        const chunks: Document['chunks'] = []
        let currentChunk: string[] = []
        let currentSize = 0
        let startLine = 0
        let chunkIndex = 0

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i]!
          const lineSize = line.length + 1

          if (currentSize + lineSize > chunkSize && currentChunk.length > 0) {
            chunks.push({
              id: `${doc.id}_chunk_${chunkIndex}`,
              documentId: doc.id,
              content: currentChunk.join('\n'),
              index: chunkIndex,
              startLine,
              endLine: i - 1,
            })
            chunkIndex++
            const overlapLines: string[] = []
            let overlapSize = 0
            for (let j = currentChunk.length - 1; j >= 0; j--) {
              overlapLines.unshift(currentChunk[j]!)
              overlapSize += currentChunk[j]!.length + 1
              if (overlapSize >= chunkOverlap) break
            }
            currentChunk = [...overlapLines]
            currentSize = overlapSize
            startLine = i - overlapLines.length
          }
          currentChunk.push(line)
          currentSize += lineSize
        }
        if (currentChunk.length > 0) {
          chunks.push({
            id: `${doc.id}_chunk_${chunkIndex}`,
            documentId: doc.id,
            content: currentChunk.join('\n'),
            index: chunkIndex,
            startLine,
            endLine: lines.length - 1,
          })
        }
        doc.chunks = chunks
      }
    }

    // Register chunks in search cache
    clearChunkCache()
    for (const doc of docs) {
      registerChunks(doc.chunks, doc.path)
    }

    // Generate embeddings for all chunks
    const allChunks = docs.flatMap(d => d.chunks)
    if (allChunks.length > 0) {
      const texts = allChunks.map(c => c.content)
      const embeddings = await generateEmbeddings(texts)

      const store = getVectorStore()
      for (let i = 0; i < allChunks.length; i++) {
        const chunk = allChunks[i]!
        const vector = embeddings[i]!
        store.addEntry({
          id: createHash('sha256').update(chunk.id).digest('hex').slice(0, 16),
          chunkId: chunk.id,
          documentId: chunk.documentId,
          vector,
          timestamp: Date.now(),
        })
        chunk.embedding = vector
      }

      // Persist if path given
      if (this.persistPath) {
        await store.persist(join(this.persistPath, 'vectorstore.json'))
      }
    }

    // Build knowledge graph
    this.graph = buildGraph(docs)

    this.isIndexed = true
  }

  async query(query: string, options?: QueryOptions): Promise<RAGContext> {
    const topK = options?.topK ?? 10
    const startTime = Date.now()

    const results = await hybridSearch(query, topK)

    // Enrich results with full content from document store
    const enriched = results.map(r => {
      const doc = this.documents.get(r.documentId)
      return {
        ...r,
        documentPath: doc?.path ?? r.documentPath,
      }
    })

    const maxTokens = options?.maxTokens ?? 4000
    const augmentedPrompt = this.buildAugmentedPrompt(query, enriched, maxTokens)

    return {
      query,
      results: enriched,
      augmentedPrompt,
      totalChunksSearched: getVectorStore().size(),
      searchDurationMs: Date.now() - startTime,
    }
  }

  async getContext(query: string, maxTokens: number = 4000): Promise<string> {
    const ctx = await this.query(query, { maxTokens })
    return ctx.augmentedPrompt
  }

  getDocument(docId: string): Document | undefined {
    return this.documents.get(docId)
  }

  getDocumentsByPath(pathSubstring: string): Document[] {
    return Array.from(this.documents.values())
      .filter(d => d.path.includes(pathSubstring))
  }

  getGraph(): KnowledgeGraph | null {
    return this.graph
  }

  queryGraphEntities(query: string): ReturnType<typeof queryGraph> {
    if (!this.graph) return []
    return queryGraph(this.graph, query)
  }

  getStats(): { documentCount: number; chunkCount: number; vectorCount: number } {
    let chunkCount = 0
    for (const doc of this.documents.values()) {
      chunkCount += doc.chunks.length
    }
    return {
      documentCount: this.documents.size,
      chunkCount,
      vectorCount: getVectorStore().size(),
    }
  }

  private buildAugmentedPrompt(
    query: string,
    results: typeof results,
    maxTokens: number,
  ): string {
    const parts: string[] = [`## Relevant context for: "${query}"\n`]

    let estimatedTokens = 0
    const CHARS_PER_TOKEN = 4

    for (const result of results) {
      const entry = `### ${result.documentPath} (lines ${result.startLine}-${result.endLine}, score: ${result.score.toFixed(3)})\n\`\`\`\n${result.content}\n\`\`\`\n`
      const entryTokens = entry.length / CHARS_PER_TOKEN

      if (estimatedTokens + entryTokens > maxTokens) break

      parts.push(entry)
      estimatedTokens += entryTokens
    }

    return parts.join('\n')
  }
}

// Singleton
let _engine: RAGEngine | null = null

export function getRAGEngine(): RAGEngine {
  if (!_engine) {
    _engine = new RAGEngine()
  }
  return _engine
}

export function resetRAGEngine(): void {
  _engine = null
}
