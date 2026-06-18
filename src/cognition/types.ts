/**
 * MetaCognitiveEngine types.
 *
 * The closed-loop meta-cognition pipeline that aggregates Olympuz's REAL
 * components (cortex meta-cognition, reasoning strategies, cross-model
 * verification, meta-reasoner, session context) into one self-feeding loop.
 * Every reported number is a MEASURED signal with provenance — never a
 * theater constant like "0.997".
 */

/** Aggregated intent — the real version of "intent resolution". */
export interface Intent {
	/** What the user literally said. */
	explicit: string
	/** What they meant but didn't say (inferred). */
	implicit: string
	/** Why they are asking (underlying motivation). */
	meta: string
	/** What they will likely need next. */
	predictive: string
	/** Hidden constraints detected (time, scope, quality). */
	constraints: string[]
}

/** Transparent measured confidence — the components are reported, not hidden. */
export interface MeasuredConfidence {
	/** Honest aggregate of the components below (weighted). 0-1. */
	measured: number
	/** Calibrated cortex confidence (Bayesian + Dempster-Shafer fusion). */
	cortex: number
	/** Meta-reasoner reasoning-quality score (coherence/completeness/bias). */
	reasoningQuality: number
	/** Cross-model agreement with the primary output (0-1), or null if unavailable. */
	verification: number | null
}

/** What the cross-model verification actually found. */
export interface VerificationResult {
	provider: string
	agreement: number | null
	contradictions: string[]
}

/** Honest record of what the pipeline actually did — no "343 pathways" theater. */
export interface Provenance {
	/** Reasoning strategies executed (in order, including escalations). */
	strategiesTried: string[]
	/** Number of depth escalations (cot→tot→reflect→...). */
	escalations: number
	/** Number of convergence passes (re-reasoning on blind spots). */
	convergencePasses: number
	/** Did the loop converge (a pass changed < epsilon) vs hit the max? */
	converged: boolean
	/** Meta-insights surfaced by cortex (gaps, bias, complexity). */
	metaInsightsCount: number
	/** Topics the reasoning failed to cover (from meta-reasoner). */
	blindSpots: string[]
	/** Was a model available (API key)? Without it, the loop degrades honestly. */
	modelAvailable: boolean
	/** Total pipeline duration in ms. */
	durationMs: number
}

/** The full output of the closed-loop meta-cognition pipeline. */
export interface CognitionResult {
	query: string
	intent: Intent
	/** Final reasoning conclusion (the chain's synthesis). */
	conclusion: string
	confidence: MeasuredConfidence
	verification: VerificationResult | null
	provenance: Provenance
	/** Context string to inject into the model's prompt (intent + gaps + insights). */
	augmentedContext: string
}

/** Configuration for the cognition pipeline. */
export interface CognitionConfig {
	/** Minimum confidence to stop escalating/converging. */
	minConfidence: number
	/** Max convergence passes (re-reasoning on blind spots). */
	maxConvergencePasses: number
	/** Conclusion-similarity above which a pass is deemed "no material change". */
	convergenceEpsilon: number
}

export const DEFAULT_COGNITION_CONFIG: CognitionConfig = {
	minConfidence: 0.7,
	maxConvergencePasses: 2,
	convergenceEpsilon: 0.92,
}
