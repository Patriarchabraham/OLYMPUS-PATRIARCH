/**
 * Cortex Module — Deep Intelligence Amplifier
 * Public API and singleton management.
 *
 * Makes any connected LLM 100x more competent via multi-pass reasoning,
 * cross-model verification, knowledge synthesis, and meta-cognition.
 */

// Export main class
export { CortexEngine } from './cortexEngine.js'

// Re-export all types
export type {
  CortexConfig,
  CortexAnalysis,
  DecomposedQuery,
  QueryType,
  ReasoningPass,
  ReasoningStrategy,
  CrossModelResult,
  SynthesizedKnowledge,
  MetaInsight,
  MetaInsightType,
  ConfidenceScore,
  ConfidenceSignal,
  CortexState,
} from './types.js'

export { DEFAULT_CORTEX_CONFIG, CORTEX_STATE_DEFAULT } from './types.js'

import { CortexEngine } from './cortexEngine.js'
import type { CortexConfig } from './types.js'
import { DEFAULT_CORTEX_CONFIG } from './types.js'

/** Singleton instance */
let _instance: CortexEngine | null = null

/**
 * Get the singleton CortexEngine instance.
 * Created with default config on first access.
 */
export function getCortexEngine(): CortexEngine {
  if (!_instance) {
    _instance = new CortexEngine(DEFAULT_CORTEX_CONFIG)
  }
  return _instance
}

/**
 * Create a new CortexEngine with custom configuration.
 * Does NOT replace the singleton — use updateConfig() for that.
 */
export function createCortexEngine(config?: Partial<CortexConfig>): CortexEngine {
  return new CortexEngine({ ...DEFAULT_CORTEX_CONFIG, ...config })
}

/**
 * Reset the singleton instance (useful for testing).
 */
export function resetCortexEngine(): void {
  _instance = null
}
