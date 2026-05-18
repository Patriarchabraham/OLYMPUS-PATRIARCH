// Types
export type {
  Document,
  DocumentChunk,
  EmbeddingEntry,
  SearchResult,
  KnowledgeNode,
  KnowledgeEdge,
  KnowledgeGraph,
  RAGContext,
  IndexOptions,
  QueryOptions,
} from './types.js'

// Embeddings
export {
  generateEmbedding,
  generateEmbeddings,
  cosineSimilarity,
  getEmbeddingProvider,
  setEmbeddingProvider,
  resetEmbeddingProvider,
} from './embeddings.js'
export type { EmbeddingProvider } from './embeddings.js'

// Vector Store
export {
  VectorStore,
  getVectorStore,
  resetVectorStore,
} from './vectorStore.js'

// Document Ingestion
export {
  ingestFile,
  ingestDirectory,
  chunkDocument,
  detectLanguage,
  extractContent,
} from './documentIngester.js'

// Semantic Search
export {
  search,
  searchByEmbedding,
  searchByKeyword,
  hybridSearch,
  registerChunks,
  clearChunkCache,
} from './semanticSearch.js'

// Knowledge Graph
export {
  extractEntities,
  buildGraph,
  addNode,
  addEdge,
  findRelated,
  findPath,
  queryGraph,
} from './knowledgeGraph.js'

// RAG Engine
export {
  RAGEngine,
  getRAGEngine,
  resetRAGEngine,
} from './ragEngine.js'
