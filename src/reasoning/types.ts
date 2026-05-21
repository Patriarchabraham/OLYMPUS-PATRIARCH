export type ReasoningStrategy = 'cot' | 'tot' | 'reflect' | 'ensemble' | 'auto'

export interface ReasoningStep {
  id: string
  type: 'analysis' | 'decomposition' | 'hypothesis' | 'verification' | 'synthesis'
  content: string
  confidence: number // 0-1
  children?: ReasoningStep[]
  metadata?: Record<string, unknown>
}

export interface ReasoningChain {
  id: string
  strategy: ReasoningStrategy
  query: string
  steps: ReasoningStep[]
  conclusion: string
  confidence: number
  durationMs: number
  timestamp: number
  metadata?: Record<string, unknown>
}

export interface TreeOfThoughtPath {
  id: string
  thoughts: string[]
  evaluation: number // 0-1
  explored: boolean
  pruned: boolean
}

export interface ReflectionResult {
  originalOutput: string
  critique: string
  improvedOutput: string
  iterationCount: number
  converged: boolean
}

export interface StrategyRecommendation {
  strategy: ReasoningStrategy
  reason: string
  estimatedComplexity: 'low' | 'medium' | 'high'
  estimatedSteps: number
}

export type GenerateFn = (prompt: string) => Promise<string>
