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
	ConfidenceScore,
	ConfidenceSignal,
	CortexAnalysis,
	CortexConfig,
	CortexState,
	CrossModelResult,
	DecomposedQuery,
	MetaInsight,
	MetaInsightType,
	QueryType,
	ReasoningPass,
	ReasoningStrategy,
	SynthesizedKnowledge,
} from './types.js'

export { CORTEX_STATE_DEFAULT, DEFAULT_CORTEX_CONFIG } from './types.js'

import { CortexEngine } from './cortexEngine.js'
import type { CortexConfig } from './types.js'
import { DEFAULT_CORTEX_CONFIG } from './types.js'

/** Singleton instance */
let _instance: CortexEngine | null = null

/**
 * Get the singleton CortexEngine instance.
 * Created with default config on first access.
 * Optionally pass dataDir for state persistence.
 */
export function getCortexEngine(dataDir?: string): CortexEngine {
	if (!_instance) {
		_instance = new CortexEngine(DEFAULT_CORTEX_CONFIG, dataDir)
	} else if (dataDir && !_instance.getDataDir()) {
		_instance.setDataDir(dataDir)
	}
	return _instance
}

/**
 * Create a new CortexEngine with custom configuration.
 * Does NOT replace the singleton — use updateConfig() for that.
 */
export function createCortexEngine(config?: Partial<CortexConfig>, dataDir?: string): CortexEngine {
	return new CortexEngine({ ...DEFAULT_CORTEX_CONFIG, ...config }, dataDir)
}

/**
 * Reset the singleton instance (useful for testing).
 */
export function resetCortexEngine(): void {
	_instance = null
}
