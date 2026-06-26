/**
 * Inference Booster Layer (IBL) — public API.
 *
 * The IBL is the architectural moat that makes Olympuz Coder structurally
 * superior to single-vendor agents like Claude Code. It sits between the
 * agent loop and the raw LLM API, routing each call to the optimal provider
 * and amplifying weak models via parallel ensemble inference (Mixture-of-Agents),
 * speculative drafting (local 3GB model + cloud verify), and prompt compression.
 *
 * See `src/inference/README.md` (to be written) for the full design.
 */

export {
	_setLedgerPathForTest,
	getStats,
	getSummary,
	readRecentEntries,
	recordCost,
	resetStatsCache,
} from './costLedger.js'
export {
	classifyQuery,
	type GetInferenceClientOptions,
	getInferenceClient,
	recordRoutingCost,
} from './getInferenceClient.js'
export {
	compressPrompt,
	DEFAULT_LOCAL_ENDPOINT,
	DEFAULT_LOCAL_MODEL,
	draftResponse,
	getLocalEndpoint,
	getLocalModelName,
	invalidateReadinessCache,
	isLocalReady,
	pullModelInBackground,
	verifyOutput,
} from './localModel.js'
export { DEFAULT_MOA_SIZE, runMoA } from './mixtureOfAgents.js'
export { resolveFamily, route } from './router.js'
export {
	heuristicScore,
	type SpeculativeOptions,
	type SpeculativeResult,
	speculativeExecute,
} from './speculativeExecutor.js'
export {
	type Classification,
	type ClassifyInput,
	classifyTask,
} from './taskClassifier.js'

export type {
	BoosterResult,
	CostEntry,
	CostSummary,
	DEFAULT_VERIFICATION_CONFIG,
	MoACandidate,
	ProviderFamily,
	ProviderId,
	ProviderStats,
	ROUTER_SCORE_WEIGHTS,
	RouteInput,
	RouterConfig,
	RoutingDecision,
	RoutingRule,
	TaskType,
	VerificationConfig,
} from './types.js'
