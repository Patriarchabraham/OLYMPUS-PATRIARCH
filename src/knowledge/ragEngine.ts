import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { ingestDirectory } from './documentIngester.js'
import { generateEmbeddings } from './embeddings.js'
import { buildGraph, queryGraph } from './knowledgeGraph.js'
import { clearChunkCache, hybridSearch, registerChunks } from './semanticSearch.js'
import type {
	Document,
	IndexOptions,
	KnowledgeGraph,
	QueryOptions,
	RAGContext,
	SearchResult,
} from './types.js'
import { getVectorStore } from './vectorStore.js'

export class RAGEngine {
	private documents: Map<string, Document> = new Map()
	private graph: KnowledgeGraph | null = null
	private persistPath: string | null = null
	/** Set once `index()` has populated the document store + graph. */
	isIndexed = false

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
		const allChunks = docs.flatMap((d) => d.chunks)
		if (allChunks.length > 0) {
			const texts = allChunks.map((c) => c.content)
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

		// Query expansion: augment with semantic synonyms for better recall
		const expandedQuery = expandQuery(query)

		const results = await hybridSearch(expandedQuery, topK)

		// Enrich results with full content from document store
		const enriched: SearchResult[] = results.map((r) => {
			const doc = this.documents.get(r.documentId)
			return {
				...r,
				documentPath: doc?.path ?? r.documentPath,
			}
		})

		// Re-rank: boost results that match original (unexpanded) query
		const reranked = rerankResults(query, enriched)

		const maxTokens = options?.maxTokens ?? 4000
		const augmentedPrompt = this.buildAugmentedPrompt(query, reranked, maxTokens)

		return {
			query,
			results: reranked,
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
		return Array.from(this.documents.values()).filter((d) => d.path.includes(pathSubstring))
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

	private buildAugmentedPrompt(query: string, results: SearchResult[], maxTokens: number): string {
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

// ─── Query expansion helpers ────────────────────────────────────────────────

const SYNONYM_MAP: Record<string, string[]> = {
	bug: ['error', 'defect', 'issue', 'fault', 'exception', 'crash'],
	fix: ['patch', 'repair', 'correct', 'resolve', 'remediate'],
	function: ['method', 'procedure', 'routine', 'subroutine', 'fn'],
	class: ['type', 'struct', 'interface', 'object'],
	test: ['spec', 'assertion', 'verification', 'check', 'unit test'],
	performance: ['speed', 'latency', 'throughput', 'optimization', 'efficiency'],
	security: ['auth', 'authentication', 'authorization', 'vulnerability', 'exploit'],
	api: ['endpoint', 'route', 'interface', 'service', 'contract'],
	database: ['db', 'storage', 'persistence', 'repository', 'datastore'],
	configuration: ['config', 'settings', 'options', 'parameters', 'env'],
}

/**
 * Expand a query with technical synonyms to improve recall.
 * Adds synonyms for known terms without removing the original terms.
 */
function expandQuery(query: string): string {
	const lower = query.toLowerCase()
	const expansions: string[] = []

	for (const [term, synonyms] of Object.entries(SYNONYM_MAP)) {
		if (lower.includes(term)) {
			// Add first 2 synonyms to avoid query drift
			expansions.push(...synonyms.slice(0, 2))
		}
	}

	if (expansions.length === 0) return query
	return `${query} ${expansions.join(' ')}`
}

/**
 * Re-rank results: boost those that contain exact query terms.
 * Uses simple token overlap boosting on top of the hybridSearch score.
 */
function rerankResults(originalQuery: string, results: SearchResult[]): SearchResult[] {
	const queryTerms = originalQuery
		.toLowerCase()
		.split(/\s+/)
		.filter((t) => t.length > 2)

	if (queryTerms.length === 0) return results

	return results
		.map((r) => {
			const lower = r.content.toLowerCase()
			const matches = queryTerms.filter((t) => lower.includes(t)).length
			const boost = (matches / queryTerms.length) * 0.2 // max 0.2 boost
			return { result: r, adjustedScore: r.score + boost }
		})
		.sort((a, b) => b.adjustedScore - a.adjustedScore)
		.map(({ result, adjustedScore }) => ({ ...result, score: adjustedScore }))
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
