/**
 * Inference Booster Layer (IBL) — shared types.
 *
 * The IBL sits between the user-facing agent loop and the raw LLM API.
 * Its job: route each query to the optimal provider combination, optionally
 * amplify weak models via Speculative Decoding + Mixture-of-Agents +
 * Verifier-model checks, and record real cost/latency telemetry.
 *
 * See `docs/inference-booster-layer.md` (to be written) for the full design.
 */

/** Canonical task categories used by the router and IBL. */
export type TaskType =
	| 'trivial_fix' // typo, rename, simple format
	| 'boilerplate' // scaffold, generate test stubs
	| 'feature_impl' // default — implement a feature
	| 'deep_refactor' // multi-file structural change
	| 'debugging' // diagnose root cause
	| 'architecture' // design / planning
	| 'verification' // review / verify existing code
	| 'docstring' // docs / comments

/** Provider identifier (loose — any string matching a configured profile). */
export type ProviderId = string

/** A single routing decision returned by the router. */
export interface RoutingDecision {
	/** Provider identifier — must match a configured ProviderProfile. */
	provider: ProviderId
	/** Model identifier as understood by the provider (e.g. "qwen2.5-coder:32b"). */
	model: string
	/** OpenAI-compatible base URL (e.g. "http://localhost:11434/v1"). */
	baseURL: string
	/** API key (may be empty for local servers). */
	apiKey: string
	/** Human-readable explanation for debugging and audit. */
	reason: string
	/** Task type that drove the decision. */
	taskType: TaskType
	/** Estimated USD cost for the upcoming call (best-effort). */
	estimatedCostUsd: number
	/** Estimated latency in milliseconds (best-effort). */
	estimatedLatencyMs: number
	/** Optional: provider family for cross-family verification. */
	family?: ProviderFamily
}

/**
 * Coarse provider family — used to force cross-family verification.
 * Two providers in the same family share training-data biases.
 */
export type ProviderFamily =
	| 'anthropic'
	| 'openai'
	| 'google'
	| 'meta'
	| 'mistral'
	| 'deepseek'
	| 'qwen'
	| 'xai'
	| 'local' // any local inference server (Ollama, vLLM, LM Studio, etc.)
	| 'unknown'

/** User-configurable routing rule. Highest priority wins. */
export interface RoutingRule {
	/** Condition — all set fields must match. */
	condition: {
		taskType?: TaskType
		fileCountGt?: number
		lineCountGt?: number
		contextTokensGt?: number
	}
	/** Provider to route to when condition matches. */
	provider: ProviderId
	/** Model id within that provider. */
	model: string
	/** Higher priority = evaluated first. */
	priority: number
}

/** Router configuration. */
export interface RouterConfig {
	/** Ordered rules; first match wins after stable priority sort. */
	rules: RoutingRule[]
	/** Default provider when no rule matches. */
	defaultProvider?: ProviderId
	/** Weight cost more highly when scoring. */
	costOptimization: boolean
	/** Weight latency more highly when scoring. */
	latencyOptimization: boolean
	/** If true, also pick a draft model and verifier model (IBL mode). */
	enableBooster?: boolean
}

/** Cost/latency entry appended to the ledger after each call. */
export interface CostEntry {
	timestamp: number
	provider: ProviderId
	model: string
	family: ProviderFamily
	inputTokens: number
	outputTokens: number
	/** USD cost — 0 for local. */
	costUsd: number
	latencyMs: number
	taskType: TaskType
	/** Whether the call produced a usable response (no API error). */
	success: boolean
}

/** Aggregated stats per provider (per task type if rolled up that way). */
export interface ProviderStats {
	provider: ProviderId
	calls: number
	successRate: number
	avgLatencyMs: number
	totalCostUsd: number
	avgCostPerCall: number
}

/** Summary surface consumed by the Stats.tsx UI. */
export interface CostSummary {
	totalCost30d: number
	totalCalls30d: number
	avgLatencyByProvider: Record<ProviderId, number>
	successRateByProvider: Record<ProviderId, number>
	callsByTaskType: Record<TaskType, number>
}

/** Configuration for the adversarial verification gate. */
export interface VerificationConfig {
	enabled: boolean
	/** Trigger gate when changed files exceed this count. */
	thresholdFiles: number
	/** Trigger gate when changed line count exceeds this. */
	thresholdLines: number
	/** Force reviewer to a specific provider (skip router). */
	reviewerProvider?: ProviderId
	/** Force reviewer to a specific model. */
	reviewerModel?: string
	/** If true, block delivery on reviewer disagreement (default false). */
	blockOnDisagreement: boolean
	/** Confidence below which the gate is considered failed. */
	minConfidence: number
}

/** Default verification config — non-blocking, conservative thresholds. */
export const DEFAULT_VERIFICATION_CONFIG: VerificationConfig = {
	enabled: true,
	thresholdFiles: 3,
	thresholdLines: 50,
	blockOnDisagreement: false,
	minConfidence: 0.5,
}

/**
 * Output of a single call within a Mixture-of-Agents run.
 * Used by the IBL aggregator to cross-reference parallel candidates.
 */
export interface MoACandidate {
	provider: ProviderId
	model: string
	family: ProviderFamily
	content: string
	confidence: number
	latencyMs: number
	costUsd: number
}

/** Result of an IBL-boosted inference call. */
export interface BoosterResult {
	/** Final delivered content (post-aggregation, post-verification). */
	content: string
	/** Confidence score in [0, 1]. */
	confidence: number
	/** All candidates considered (audit trail). */
	candidates: MoACandidate[]
	/** Total cost across all parallel calls. */
	totalCostUsd: number
	/** Wall-clock latency (parallel calls → max of individual latencies). */
	totalLatencyMs: number
	/** Verifier verdict, if verification ran. */
	verdict?: {
		passed: boolean
		confidence: number
		feedback?: string
	}
}

/** Per-query input to the router. */
export interface RouteInput {
	queryText: string
	/** Estimated tokens already in the conversation (for context-aware routing). */
	contextTokenEstimate: number
	/** Tool budget remaining (low budget → prefer fast model). */
	toolBudget: number
	/** Pre-classified task type (skip classifier if provided). */
	taskType?: TaskType
	/** Number of files currently in flight (e.g. from pending tool calls). */
	fileCount?: number
	/** Per-agent override — wins over everything else. */
	providerOverride?: { model: string; baseURL: string; apiKey: string }
}

/** Default weights for the router's cost/latency/success scorer. */
export const ROUTER_SCORE_WEIGHTS = {
	cost: 0.3,
	latency: 0.4,
	successRate: 0.3,
} as const
