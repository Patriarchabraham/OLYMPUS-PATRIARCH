export interface ResearchSource {
  url: string
  title: string
  snippet: string
  relevanceScore: number
  credibilityScore: number
  fetchedContent?: string
  fetchTimestamp?: number
}

export interface ResearchResult {
  id: string
  query: string
  sources: ResearchSource[]
  synthesis: string
  keyFindings: string[]
  contradictions: string[]
  confidence: number
  durationMs: number
  timestamp: number
}

export interface SourceComparison {
  claim: string
  sources: { url: string; agrees: boolean; quote: string }[]
  consensus: 'strong' | 'moderate' | 'weak' | 'conflicting'
}

export interface MonitorTarget {
  id: string
  url: string
  type: 'api' | 'webpage' | 'rss' | 'json-endpoint'
  intervalMs: number
  lastChecked?: number
  lastValue?: string
  changeCallback?: (newValue: string, oldValue: string) => void
  active: boolean
}

export interface MonitorResult {
  targetId: string
  changed: boolean
  currentValue: string
  previousValue?: string
  timestamp: number
}

export interface APIEndpoint {
  name: string
  baseUrl: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE'
  headers?: Record<string, string>
  body?: unknown
  responsePath?: string
}

export interface APIOrchestrationResult {
  endpoint: string
  success: boolean
  data: unknown
  durationMs: number
  error?: string
}

export type SearchFn = (query: string) => Promise<ResearchSource[]>
export type FetchFn = (url: string) => Promise<string>

export interface DeepResearchConfig {
  searchFn?: SearchFn
  fetchFn?: FetchFn
  maxSources?: number
  maxDepth?: number
  credibilityThreshold?: number
}

export interface RateLimitEntry {
  endpoint: string
  requestsPerSecond: number
  lastRequestTime: number
  requestCount: number
}
