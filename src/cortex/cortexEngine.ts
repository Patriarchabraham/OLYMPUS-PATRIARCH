/**
 * CortexEngine — Main orchestrator for the Deep Intelligence Amplifier.
 * Coordinates all cortex sub-modules: meta-cognition, decomposition, multi-pass
 * reasoning, cross-model verification, knowledge synthesis, and confidence calibration.
 */

import { randomUUID } from 'crypto'
import type {
  CortexConfig,
  CortexAnalysis,
  CortexState,
  DecomposedQuery,
  ReasoningPass,
  CrossModelResult,
  SynthesizedKnowledge,
  MetaInsight,
  ConfidenceScore,
  QueryType,
  ReasoningStrategy,
} from './types.js'
import { DEFAULT_CORTEX_CONFIG, CORTEX_STATE_DEFAULT } from './types.js'
import { analyzeQuery } from './metaCognition.js'
import { decompose } from './queryDecomposer.js'
import { reason } from './multiPassReasoner.js'
import { synthesize } from './knowledgeSynthesizer.js'
import { verify } from './crossModelVerifier.js'
import { calibrate } from './confidenceCalibrator.js'
import { combine } from './insightCombiner.js'
import type { GenerateFn } from '../reasoning/types.js'

export class CortexEngine {
  private config: CortexConfig
  private state: CortexState
  private generateFn?: GenerateFn

  constructor(config?: Partial<CortexConfig>) {
    this.config = { ...DEFAULT_CORTEX_CONFIG, ...config }
    this.state = { ...CORTEX_STATE_DEFAULT }
  }

  /**
   * Set the generate function for LLM calls. Called by orchestrator during initialization.
   */
  setGenerateFn(fn: GenerateFn): void {
    this.generateFn = fn
  }

  /**
   * Run full cortex analysis pipeline on a query.
   *
   * Pipeline:
   * 1. Meta-cognition: analyze query type, complexity, gaps
   * 2. Decomposition: break complex queries into sub-queries
   * 3. Multi-pass reasoning: iterate strategies until confidence threshold
   * 4. Cross-model verification: optional second model check
   * 5. Knowledge synthesis: fuse RAG + Web + Graph insights
   * 6. Confidence calibration: multi-signal scoring
   * 7. Insight combination: produce augmented context string
   */
  async analyze(query: string): Promise<CortexAnalysis> {
    const startTime = Date.now()

    // Step 1: Meta-cognition
    let metaInsights: MetaInsight[] = []
    if (this.config.metaCognitionEnabled) {
      try {
        metaInsights = await analyzeQuery(query)
      } catch {
        metaInsights = [{ type: 'query_complexity', description: 'Complexity: unknown (meta-cognition failed)', action: 'Use default strategy', priority: 'low', confidence: 0.5 }]
      }
    }

    // Step 2: Query decomposition
    let subQueries: DecomposedQuery[] = [{ id: 'q_1', query, type: 'analytical' as QueryType, priority: 1, dependencies: [] }]
    if (this.config.queryDecompositionEnabled) {
      try {
        const decomposed = decompose(query, metaInsights)
        if (decomposed.length > 0) subQueries = decomposed
      } catch {
        // Keep default single query
      }
    }

    // Step 3: Multi-pass reasoning
    let reasoningPasses: ReasoningPass[] = []
    try {
      reasoningPasses = await reason(query, subQueries, this.config.maxPasses, this.generateFn)
    } catch {
      reasoningPasses = [{
        passNumber: 1, strategy: 'cot' as ReasoningStrategy, input: query,
        output: 'Reasoning unavailable', gaps: ['reasoning engine failed'],
        refinement: 'Fallback: no reasoning applied', confidenceDelta: 0.3, durationMs: 0,
      }]
    }

    // Step 4: Cross-model verification
    let crossModelResults: CrossModelResult[] = []
    const bestPass = reasoningPasses[reasoningPasses.length - 1]
    if (this.config.crossModelVerification && this.config.verificationModel) {
      try {
        const result = await verify(query, bestPass?.output ?? '', this.config.verificationModel)
        crossModelResults = [result]
      } catch {
        // Skip verification
      }
    }

    // Step 5: Knowledge synthesis
    let synthesizedKnowledge: SynthesizedKnowledge = {
      ragInsights: [], webInsights: [], graphInsights: [],
      contradictions: [], knowledgeGaps: [],
      combinedSummary: 'Knowledge synthesis not performed', depth: 0,
    }
    if (this.config.knowledgeSynthesisDepth > 0) {
      try {
        synthesizedKnowledge = await synthesize(query, this.config.knowledgeSynthesisDepth)
      } catch {
        // Keep empty synthesis
      }
    }

    // Step 6: Confidence calibration
    let confidenceScore: ConfidenceScore
    try {
      confidenceScore = calibrate(
        reasoningPasses,
        crossModelResults.length > 0 ? crossModelResults[0] : null,
        synthesizedKnowledge,
      )
    } catch {
      confidenceScore = { overall: 0.5, factual: 0.5, logical: 0.5, completeness: 0.5, consistency: 0.5, signals: [] }
    }

    // Step 7: Build analysis object
    const analysis: CortexAnalysis = {
      id: randomUUID(),
      originalQuery: query,
      subQueries,
      reasoningPasses,
      crossModelResults,
      synthesizedKnowledge,
      metaInsights,
      finalConfidence: confidenceScore.overall,
      augmentedContext: '', // Set below
      durationMs: Date.now() - startTime,
      timestamp: Date.now(),
    }

    // Step 8: Combine into augmented context
    analysis.augmentedContext = combine(analysis, this.config.maxTokenBudget)

    // Update state
    this.updateState(analysis)

    return analysis
  }

  /**
   * Get current cortex state (analytics).
   */
  getState(): CortexState {
    return { ...this.state }
  }

  /**
   * Update cortex configuration at runtime.
   */
  updateConfig(config: Partial<CortexConfig>): void {
    this.config = { ...this.config, ...config }
  }

  /**
   * Get current configuration.
   */
  getConfig(): CortexConfig {
    return { ...this.config }
  }

  /**
   * Record the outcome of a query that used cortex analysis.
   * This feeds back into the confidence calibrator so it learns
   * which query types benefit most from deep analysis.
   */
  recordOutcome(query: string, success: boolean, durationMs: number): void {
    // Update strategy effectiveness based on outcome
    if (this.state.recentAnalyses.length > 0) {
      const lastAnalysis = this.state.recentAnalyses[this.state.recentAnalyses.length - 1]
      if (lastAnalysis) {
        const multiplier = success ? 1.05 : 0.95
        for (const pass of lastAnalysis.reasoningPasses) {
          const current = this.state.strategyEffectiveness[pass.strategy] ?? 0.5
          this.state.strategyEffectiveness[pass.strategy] = Math.min(1, current * multiplier)
        }
      }
    }
  }

  /**
   * Update internal state with results from an analysis.
   */
  private updateState(analysis: CortexAnalysis): void {
    this.state.totalAnalyses++

    // Running average confidence
    const prevTotal = this.state.averageConfidence * (this.state.totalAnalyses - 1)
    this.state.averageConfidence = (prevTotal + analysis.finalConfidence) / this.state.totalAnalyses

    // Running average duration
    const prevDurTotal = this.state.averageDurationMs * (this.state.totalAnalyses - 1)
    this.state.averageDurationMs = (prevDurTotal + analysis.durationMs) / this.state.totalAnalyses

    // Strategy effectiveness
    for (const pass of analysis.reasoningPasses) {
      const prev = this.state.strategyEffectiveness[pass.strategy] ?? 0.5
      this.state.strategyEffectiveness[pass.strategy] = prev * 0.9 + pass.confidenceDelta * 0.1
    }

    // Query type distribution
    for (const sq of analysis.subQueries) {
      this.state.queryTypeDistribution[sq.type] = (this.state.queryTypeDistribution[sq.type] ?? 0) + 1
    }

    // Cross-model agreement rate
    if (analysis.crossModelResults.length > 0) {
      const agreement = analysis.crossModelResults[0].agreementWithPrimary
      this.state.crossModelAgreementRate = this.state.crossModelAgreementRate * 0.9 + agreement * 0.1
    }

    // Recent analyses (keep last 100)
    this.state.recentAnalyses.push(analysis)
    if (this.state.recentAnalyses.length > 100) {
      this.state.recentAnalyses = this.state.recentAnalyses.slice(-100)
    }
  }
}
