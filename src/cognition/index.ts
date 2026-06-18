/**
 * Cognition module — the closed-loop MetaCognitiveEngine.
 *
 * Public API: cognize() runs the full pipeline (intent → meta-analysis
 * INJECTED into reasoning → escalate → converge on blind spots → cross-model
 * verify → transparently-measured confidence → provenance → feed-forward).
 * renderProvenance() prints the honest "consciousness report".
 *
 * Reuses Olympuz's real components (cortex, reasoning, metaReasoner,
 * crossModelVerifier, sessionContext) — the gap it closes is the feedback loop
 * those one-shot islands were missing.
 */

export { cognize } from './metaCognitiveEngine.js'
export type { CognitionDeps } from './metaCognitiveEngine.js'
export { resolveIntent } from './intentResolver.js'
export { renderProvenance } from './provenance.js'
export type {
	CognitionConfig,
	CognitionResult,
	Intent,
	MeasuredConfidence,
	Provenance,
	VerificationResult,
} from './types.js'
export { DEFAULT_COGNITION_CONFIG } from './types.js'
