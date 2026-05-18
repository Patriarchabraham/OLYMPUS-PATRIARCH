// Web Intelligence System — Public API
export type {
  ResearchSource,
  ResearchResult,
  SourceComparison,
  MonitorTarget,
  MonitorResult,
  APIEndpoint,
  APIOrchestrationResult,
  DeepResearchConfig,
  SearchFn,
  FetchFn,
  RateLimitEntry,
} from './types.js'

export {
  research,
  generateSubQueries,
  evaluateSource,
  synthesizeFindings,
  identifyContradictions,
} from './deepResearch.js'

export {
  compareSources,
  factCheck,
  synthesize,
  rankSources,
  extractKeyFindings,
} from './sourceSynthesizer.js'

export { DataMonitor } from './dataMonitor.js'
export { APIOrchestrator } from './apiOrchestrator.js'
