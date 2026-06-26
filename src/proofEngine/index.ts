/**
 * Static Analysis Engine (proofEngine) — Public API.
 *
 * Provides regex-based static analysis across four dimensions:
 * logical (contradiction/tautology detection), engineering (style/maintainability),
 * mathematical (numeric edge cases), and typographical (formatting conventions).
 *
 * Despite the "proof" branding inherited from earlier versions, this engine
 * performs heuristic static checks — not formal mathematical proof. Confidence
 * scores are aggregated via weighted averaging and Bayesian-style likelihood
 * ratios, but the inputs are pattern-matched findings, not deductive verifications.
 *
 * Useful as a fast pre-pass before deeper verification. For real formal
 * verification, wire in an external solver (Z3, Coq, etc.).
 */

export { verifyEngineering } from './engineeringVerifier.js'
export { verifyLogically } from './logicalVerifier.js'
export { verifyMathematically } from './mathematicalVerifier.js'
export { ProofEngine } from './proofEngine.js'
export { TokenMultiplierTracker } from './tokenMultiplier.js'
export type {
	DimensionProofScore,
	EfficiencyTrend,
	ProofDimension,
	ProofEngineConfig,
	ProofFinding,
	ProofReport,
	ProofResult,
	ProofSeverity,
	TokenEfficiencyHistoryEntry,
	TokenEfficiencyScore,
	TokenMultiplierReport,
	TokenMultiplierState,
	VerifierContext,
} from './types.js'
export { BAYESIAN_LIKELIHOOD_RATIOS, DEFAULT_PROOF_CONFIG } from './types.js'
export { verifyTypographically } from './typographicalVerifier.js'

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
