export interface Document {
	id: string
	path: string
	content: string
	type: 'code' | 'markdown' | 'text' | 'config' | 'json' | 'other'
	language?: string
	lastModified: number
	checksum: string
	chunks: DocumentChunk[]
}

export interface DocumentChunk {
	id: string
	documentId: string
	content: string
	index: number
	startLine: number
	endLine: number
	embedding?: number[]
	metadata?: Record<string, unknown>
}

export interface EmbeddingEntry {
	id: string
	chunkId: string
	documentId: string
	vector: number[]
	timestamp: number
}

export interface SearchResult {
	chunkId: string
	documentId: string
	content: string
	score: number
	documentPath: string
	startLine: number
	endLine: number
}

export interface KnowledgeNode {
	id: string
	type: 'module' | 'function' | 'class' | 'concept' | 'dependency' | 'file'
	name: string
	/** Direct path to the file or module (for file/module nodes). Also stored in properties.path. */
	path?: string
	/** PageRank score computed after graph construction (0–1). Higher = more central. */
	pageRank?: number
	properties: Record<string, unknown>
	edges: KnowledgeEdge[]
}

export interface KnowledgeEdge {
	sourceId: string
	targetId: string
	type:
		| 'imports'
		| 'exports'
		| 'depends_on'
		| 'implements'
		| 'contains'
		| 'references'
		| 'related_to'
	weight: number
}

export interface KnowledgeGraph {
	nodes: Map<string, KnowledgeNode>
	edges: KnowledgeEdge[]
}

export interface RAGContext {
	query: string
	results: SearchResult[]
	augmentedPrompt: string
	totalChunksSearched: number
	searchDurationMs: number
}

export interface IndexOptions {
	extensions?: string[]
	exclude?: string[]
	chunkSize?: number
	chunkOverlap?: number
	persistPath?: string
}

export interface QueryOptions {
	topK?: number
	maxTokens?: number
	includeMetadata?: boolean
}
