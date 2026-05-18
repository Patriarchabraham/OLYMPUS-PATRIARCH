/**
 * Cortex Module — Deep Intelligence Amplifier Types
 * Makes any connected LLM 100x more competent via multi-pass reasoning,
 * cross-model verification, knowledge synthesis, and meta-cognition.
 */

export interface CortexConfig {
  enabled: boolean
  maxPasses: number // default 3
  crossModelVerification: boolean // route to 2nd model for verification
  knowledgeSynthesisDepth: number // 0=off, 1=basic, 2=deep
  metaCognitionEnabled: boolean
  queryDecompositionEnabled: boolean
  confidenceThreshold: number // 0-1, minimum confidence to accept
  maxTokenBudget: number // max tokens for augmented context
  verificationModel?: string // model name for cross-model verification
}

export interface CortexAnalysis {
  id: string
  originalQuery: string
  subQueries: DecomposedQuery[]
  reasoningPasses: ReasoningPass[]
  crossModelResults: CrossModelResult[]
  synthesizedKnowledge: SynthesizedKnowledge
  metaInsights: MetaInsight[]
  finalConfidence: number
  augmentedContext: string
  durationMs: number
  timestamp: number
}

export interface DecomposedQuery {
  id: string
  query: string
  type: QueryType
  priority: number
  dependencies: string[] // IDs of sub-queries that must complete first
}

export type QueryType =
  | 'factual'
  | 'analytical'
  | 'creative'
  | 'procedural'
  | 'verification'
  | 'architectural'
  | 'debugging'
  | 'optimization'

export interface ReasoningPass {
  passNumber: number
  strategy: ReasoningStrategy
  input: string
  output: string
  gaps: string[] // what this pass identified as missing
  refinement: string // what was refined in this pass
  confidenceDelta: number // improvement over previous pass
  durationMs: number
}

export type ReasoningStrategy = 'cot' | 'tot' | 'reflect' | 'ensemble' | 'auto'

export interface CrossModelResult {
  modelName: string
  provider: string
  response: string
  confidence: number
  agreementWithPrimary: number // 0-1 similarity to primary model output
  uniqueInsights: string[] // insights only this model contributed
  contradictions: string[] // points where this model disagrees
  durationMs: number
}

export interface SynthesizedKnowledge {
  ragInsights: string[]
  webInsights: string[]
  graphInsights: string[]
  contradictions: string[]
  knowledgeGaps: string[]
  combinedSummary: string
  depth: number
}

export interface MetaInsight {
  type: MetaInsightType
  description: string
  action: string // suggested action to improve response
  priority: 'low' | 'medium' | 'high' | 'critical'
  confidence: number
}

export type MetaInsightType =
  | 'query_complexity'
  | 'domain_detection'
  | 'missing_context'
  | 'bias_detection'
  | 'reasoning_quality'
  | 'capability_gap'
  | 'optimal_strategy'
  | 'resource_optimization'

export interface ConfidenceScore {
  overall: number
  factual: number
  logical: number
  completeness: number
  consistency: number
  signals: ConfidenceSignal[]
}

export interface ConfidenceSignal {
  name: string
  weight: number
  value: number
  description: string
}

export interface CortexState {
  totalAnalyses: number
  averageConfidence: number
  averageDurationMs: number
  strategyEffectiveness: Record<ReasoningStrategy, number>
  queryTypeDistribution: Record<QueryType, number>
  crossModelAgreementRate: number
  recentAnalyses: CortexAnalysis[] // last 100
}

export const DEFAULT_CORTEX_CONFIG: CortexConfig = {
  enabled: true,
  maxPasses: 3,
  crossModelVerification: true,
  knowledgeSynthesisDepth: 2,
  metaCognitionEnabled: true,
  queryDecompositionEnabled: true,
  confidenceThreshold: 0.7,
  maxTokenBudget: 2000,
}

export const CORTEX_STATE_DEFAULT: CortexState = {
  totalAnalyses: 0,
  averageConfidence: 0,
  averageDurationMs: 0,
  strategyEffectiveness: {
    cot: 0.5,
    tot: 0.5,
    reflect: 0.5,
    ensemble: 0.5,
    auto: 0.5,
  },
  queryTypeDistribution: {
    factual: 0,
    analytical: 0,
    creative: 0,
    procedural: 0,
    verification: 0,
    architectural: 0,
    debugging: 0,
    optimization: 0,
  },
  crossModelAgreementRate: 0,
  recentAnalyses: [],
}
