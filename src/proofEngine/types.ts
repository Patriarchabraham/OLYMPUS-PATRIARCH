/**
 * Proof Engine — Type definitions and constants.
 *
 * Every score is a formal number in [0, 1] derived from concrete measurements,
 * not heuristics. The overall confidence uses Bayesian posterior computation.
 */

// ─── Dimensions ──────────────────────────────────────────────────────────

/** The four verification domains of the proof engine */
export type ProofDimension = 'mathematical' | 'logical' | 'engineering' | 'typographical'

/** Severity of an individual finding */
export type ProofSeverity = 'info' | 'warning' | 'error' | 'critical'

/** Trend direction for token efficiency */
export type EfficiencyTrend = 'improving' | 'stable' | 'declining'

// ─── Findings ────────────────────────────────────────────────────────────

/** A single finding produced by a proof verifier */
export interface ProofFinding {
	/** How severe this finding is */
	severity: ProofSeverity
	/** Which dimension produced this finding */
	dimension: ProofDimension
	/** Rule identifier, e.g. 'PROOF-MATH-001' */
	ruleId: string
	/** Human-readable description */
	message: string
	/** Optional source location */
	location?: {
		file: string
		line?: number
		column?: number
	}
	/** Suggested auto-fix */
	suggestion?: string
	/** How certain we are that this finding is real (0-1) */
	confidence: number
}

// ─── Scores ──────────────────────────────────────────────────────────────

/** Score for a single proof dimension */
export interface DimensionProofScore {
	/** Aggregate score 0-1 */
	value: number
	/** Weight in the overall confidence computation */
	weight: number
	/** Findings produced during verification */
	findings: ProofFinding[]
	/** Sub-metric scores within this dimension */
	subScores: Record<string, number>
}

/** Token efficiency measurement for a single verification */
export interface TokenEfficiencyScore {
	/** Correct lines of code produced per token consumed */
	correctLinesPerToken: number
	/** 0 = no rework, 1 = full rework required */
	reworkRatio: number
	/** Useful tokens / total tokens */
	usefulTokenRatio: number
	/** Current trend direction */
	trend: EfficiencyTrend
}

/** A single entry in the token efficiency history */
export interface TokenEfficiencyHistoryEntry {
	timestamp: number
	totalTokensUsed: number
	correctLinesProduced: number
	reworkLines: number
	filesVerified: number
	averageProofConfidence: number
}

// ─── Results ─────────────────────────────────────────────────────────────

/** Complete proof result for a code artifact */
export interface ProofResult {
	/** Unique identifier */
	id: string
	/** Weighted aggregate confidence (0-1) */
	overallConfidence: number
	/** Per-dimension scores */
	dimensions: Record<ProofDimension, DimensionProofScore>
	/** Whether the code passes the confidence threshold */
	passed: boolean
	/** Whether auto-escalation is needed */
	escalationRequired: boolean
	/** Specific fixes to reach the confidence threshold */
	escalationFixes: string[]
	/** Token efficiency measurement */
	tokenEfficiency: TokenEfficiencyScore
	/** Hash-based cache key for incremental re-verification */
	proofCacheKey: string
	/** When this proof was computed */
	timestamp: number
	/** How long the proof took in milliseconds */
	durationMs: number
}

/** Aggregated report for a directory scan */
export interface ProofReport {
	/** Total files analyzed */
	filesAnalyzed: number
	/** Files that pass the confidence threshold */
	filesPassing: number
	/** Files requiring escalation */
	filesFailing: number
	/** Average confidence across all files */
	averageConfidence: number
	/** Per-dimension averages */
	dimensionAverages: Record<ProofDimension, number>
	/** All findings aggregated */
	allFindings: ProofFinding[]
	/** Token efficiency summary */
	tokenEfficiency: TokenEfficiencyScore
	/** Individual file results */
	fileResults: Map<string, ProofResult>
}

// ─── Token Multiplier State ──────────────────────────────────────────────

/** Internal state of the token multiplier tracker */
export interface TokenMultiplierState {
	/** Rolling window of efficiency measurements */
	history: TokenEfficiencyHistoryEntry[]
	/** Baseline correct-lines-per-token set on first measurement */
	baselineCorrectLinesPerToken: number
	/** Current correct-lines-per-token */
	currentCorrectLinesPerToken: number
	/** Slope of recent trend (positive = improving) */
	improvementRate: number
	/** Total proofs executed */
	totalProofsRun: number
	/** Total tokens analyzed */
	totalTokensAnalyzed: number
	/** Average proof confidence across all runs */
	averageConfidence: number
}

/** Public report from the token multiplier */
export interface TokenMultiplierReport {
	currentCorrectLinesPerToken: number
	baselineCorrectLinesPerToken: number
	averageConfidence: number
	trend: EfficiencyTrend
	improvementRate: number
	totalProofsRun: number
	totalTokensAnalyzed: number
	recommendations: string[]
}

// ─── Bayesian Calibration ────────────────────────────────────────────────

/** Likelihood ratios for Bayesian posterior computation */
export const BAYESIAN_LIKELIHOOD_RATIOS: Record<string, number> = {
	// Mathematical checks
	boundary_coverage: 2.0,
	float_equality: 1.8,
	division_by_zero: 2.0,
	overflow_check: 1.7,
	nan_guard: 1.5,
	invariant_presence: 1.6,
	assertion_density: 1.4,
	// Logical checks
	contradiction_free: 1.9,
	dead_code_absent: 1.8,
	exhaustive_switch: 1.7,
	exhaustive_else: 1.5,
	sound_type_narrowing: 1.6,
	quantifier_correct: 1.5,
	// Engineering checks
	solid_compliance: 1.4,
	performance_bound: 1.6,
	coupling_health: 1.3,
	error_completeness: 1.5,
	pattern_conformance: 1.2,
	// Typographical checks
	naming_consistency: 1.2,
	spell_correctness: 1.3,
	jsdoc_accuracy: 1.2,
	token_efficiency: 1.4,
} as const

// ─── Configuration ───────────────────────────────────────────────────────

/** Configuration for the proof engine */
export interface ProofEngineConfig {
	/** Whether the proof engine is active */
	enabled: boolean
	/** Minimum confidence to consider code "proven" (0-1) */
	confidenceThreshold: number
	/** Which dimensions to verify */
	dimensions: ProofDimension[]
	/** Per-dimension weights (must sum to 1.0) */
	dimensionWeights: Record<ProofDimension, number>
	/** Whether to auto-escalate when confidence < threshold */
	enableAutoEscalation: boolean
	/** Whether to cache proof results */
	enableCaching: boolean
	/** Maximum number of cached results */
	maxCacheSize: number
	/** Whether to track token efficiency */
	enableTokenTracking: boolean
	/** Maximum history entries for token multiplier */
	maxHistoryEntries: number
	/** Directory for persistent state */
	dataDir?: string
}

/** Default configuration with mathematical rigor */
export const DEFAULT_PROOF_CONFIG: ProofEngineConfig = {
	enabled: true,
	confidenceThreshold: 0.997,
	dimensions: ['mathematical', 'logical', 'engineering', 'typographical'],
	dimensionWeights: {
		mathematical: 0.30,
		logical: 0.30,
		engineering: 0.25,
		typographical: 0.15,
	},
	enableAutoEscalation: true,
	enableCaching: true,
	maxCacheSize: 200,
	enableTokenTracking: true,
	maxHistoryEntries: 100,
}

// ─── Verifier Context ────────────────────────────────────────────────────

/** Context passed to each verifier */
export interface VerifierContext {
	/** The code to verify */
	code: string
	/** File path (for location reporting) */
	filePath: string
	/** Previously proven function confidences (for compositional proof) */
	provenConfidences: Map<string, number>
}
