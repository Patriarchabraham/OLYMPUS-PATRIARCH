export interface InteractionRecord {
  id: string
  timestamp: number
  query: string
  strategy: string
  toolsUsed: string[]
  success: boolean
  durationMs: number
  userFeedback?: 'positive' | 'negative' | 'neutral'
  errorType?: string
}

export interface Pattern {
  id: string
  name: string
  description: string
  triggerConditions: string[]
  recommendedStrategy: string
  recommendedTools: string[]
  successRate: number
  sampleSize: number
  lastUpdated: number
}

export interface PromptEvolution {
  id: string
  sectionName: string
  originalPrompt: string
  evolvedPrompt: string
  generation: number
  effectivenessScore: number
  timestamp: number
}

export interface ToolUsageStats {
  toolName: string
  totalUses: number
  successRate: number
  avgDurationMs: number
  commonCombinations: string[][]
  bestForTaskTypes: string[]
}

export interface EvolutionState {
  interactions: InteractionRecord[]
  patterns: Pattern[]
  promptEvolutions: Map<string, PromptEvolution>
  toolStats: Map<string, ToolUsageStats>
  lastEvolutionTimestamp: number
  evolutionCount: number
}

export interface EvolutionConfig {
  maxInteractions: number
  minSampleSize: number
  evolutionIntervalMs: number
  maxPatterns: number
  dataDir: string
}

export interface StrategyEffectiveness {
  strategy: string
  totalUses: number
  successes: number
  successRate: number
  avgDurationMs: number
}

export interface TrendData {
  period: string
  overallSuccessRate: number
  topStrategies: string[]
  failingStrategies: string[]
  topTools: string[]
  failingTools: string[]
}

export interface ToolRecommendation {
  toolName: string
  confidence: number
  reason: string
}

export interface EvolutionReport {
  totalInteractions: number
  overallSuccessRate: number
  patternsLearned: number
  promptEvolutions: number
  topPatterns: Pattern[]
  toolInsights: string[]
  evolutionCount: number
  lastEvolution: number
}
