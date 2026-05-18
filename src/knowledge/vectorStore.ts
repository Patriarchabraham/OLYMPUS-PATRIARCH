import { readFile, writeFile, mkdir } from 'fs/promises'
import { dirname } from 'path'
import { cosineSimilarity } from './embeddings.js'
import type { EmbeddingEntry, SearchResult } from './types.js'

export class VectorStore {
  private entries: Map<string, EmbeddingEntry> = new Map()
  private docIndex: Map<string, Set<string>> = new Map() // documentId -> entryIds

  addEntry(entry: EmbeddingEntry): void {
    this.entries.set(entry.id, entry)
    if (!this.docIndex.has(entry.documentId)) {
      this.docIndex.set(entry.documentId, new Set())
    }
    this.docIndex.get(entry.documentId)!.add(entry.id)
  }

  addEntries(entries: EmbeddingEntry[]): void {
    for (const entry of entries) {
      this.addEntry(entry)
    }
  }

  search(queryVector: number[], topK: number = 10): SearchResult[] {
    const scored: Array<{ entry: EmbeddingEntry; score: number }> = []

    for (const entry of this.entries.values()) {
      const score = cosineSimilarity(queryVector, entry.vector)
      scored.push({ entry, score })
    }

    scored.sort((a, b) => b.score - a.score)

    return scored.slice(0, topK).map(({ entry, score }) => ({
      chunkId: entry.chunkId,
      documentId: entry.documentId,
      content: '',
      score,
      documentPath: '',
      startLine: 0,
      endLine: 0,
    }))
  }

  removeByDocument(documentId: string): void {
    const entryIds = this.docIndex.get(documentId)
    if (entryIds) {
      for (const id of entryIds) {
        this.entries.delete(id)
      }
      this.docIndex.delete(documentId)
    }
  }

  clear(): void {
    this.entries.clear()
    this.docIndex.clear()
  }

  size(): number {
    return this.entries.size
  }

  getAllEntries(): EmbeddingEntry[] {
    return Array.from(this.entries.values())
  }

  getEntryByChunk(chunkId: string): EmbeddingEntry | undefined {
    for (const entry of this.entries.values()) {
      if (entry.chunkId === chunkId) return entry
    }
    return undefined
  }

  async persist(filePath: string): Promise<void> {
    const data = {
      entries: Array.from(this.entries.values()),
      version: 1,
    }
    await mkdir(dirname(filePath), { recursive: true })
    await writeFile(filePath, JSON.stringify(data), 'utf-8')
  }

  async load(filePath: string): Promise<void> {
    try {
      const raw = await readFile(filePath, 'utf-8')
      const data = JSON.parse(raw) as { entries: EmbeddingEntry[]; version: number }
      this.clear()
      if (data.entries) {
        this.addEntries(data.entries)
      }
    } catch {
      // File doesn't exist or is corrupt — start empty
    }
  }
}

// Singleton
let _store: VectorStore | null = null

export function getVectorStore(): VectorStore {
  if (!_store) {
    _store = new VectorStore()
  }
  return _store
}

export function resetVectorStore(): void {
  _store = null
}
