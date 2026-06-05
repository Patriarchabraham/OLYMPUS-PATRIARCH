/**
 * Proof Engine — Public API.
 *
 * Provides mathematical, logical, engineering, and typographical
 * verification for code artifacts. Integrates with the super-agent
 * pipeline to ensure zero-error output.
 */

export { ProofEngine } from './proofEngine.js'
export { verifyMathematically } from './mathematicalVerifier.js'
export { verifyLogically } from './logicalVerifier.js'
export { verifyEngineering } from './engineeringVerifier.js'
export { verifyTypographically } from './typographicalVerifier.js'
export { TokenMultiplierTracker } from './tokenMultiplier.js'

export type {
	ProofDimension,
	ProofSeverity,
	ProofFinding,
	DimensionProofScore,
	ProofResult,
	ProofReport,
	TokenEfficiencyScore,
	TokenEfficiencyHistoryEntry,
	TokenMultiplierState,
	TokenMultiplierReport,
	ProofEngineConfig,
	VerifierContext,
	EfficiencyTrend,
} from './types.js'

export { DEFAULT_PROOF_CONFIG, BAYESIAN_LIKELIHOOD_RATIOS } from './types.js'

// ─── Singleton ───────────────────────────────────────────────────────────

import { ProofEngine } from './proofEngine.js'
import type { ProofEngineConfig } from './types.js'
import { DEFAULT_PROOF_CONFIG } from './types.js'

let instance: ProofEngine | null = null

/**
 * Get the singleton ProofEngine instance.
 */
export function getProofEngine(config?: Partial<ProofEngineConfig>): ProofEngine {
	if (!instance) {
		instance = new ProofEngine({ ...DEFAULT_PROOF_CONFIG, ...config })
	}
	return instance
}

/**
 * Reset the singleton (for testing).
 */
export function resetProofEngine(): void {
	instance = null
}
