/**
 * MetaCognitiveEngine — the closed-loop, honest version of "consciousness +
 * depth + aggregative intent".
 *
 * Olympuz already has REAL meta-cognition components (cortex meta-analysis with
 * Bayesian/Dempster-Shafer calibration, meta-reasoner, depth escalation,
 * cross-model verification, session context). The critical gap: they were
 * one-shot ISLANDS — cortex observed but never fed back into the reasoning it
 * was supposed to amplify.
 *
 * This engine closes the loop:
 *   intent → pre-meta (gaps/bias INJECTED into reasoning) → reason+escalate →
 *   meta-evaluate → CONVERGE by re-reasoning on blind spots (until a pass
 *   changes < epsilon) → cross-model verify → transparently-measured
 *   confidence → provenance → feed-forward to the next turn.
 *
 * Every reported number is a measured signal. No "0.997" / "343 pathways".
 */
import type { GenerateFn, ReasoningChain, ReasoningStrategy } from '../reasoning/types.js'
import { runReasoning } from '../reasoning/index.js'
import { runWithEscalation } from '../cortex/depthEscalator.js'
import { evaluateReasoning, type MetaReasoningResult } from '../cortex/metaReasoner.js'
import { verify as crossVerify } from '../cortex/crossModelVerifier.js'
import type { CortexAnalysis, CrossModelResult } from '../cortex/types.js'
import { getCortexEngine } from '../cortex/index.js'
import { getSessionContextManager } from '../cortex/sessionContext.js'
import { resolveIntent } from './intentResolver.js'
import {
	DEFAULT_COGNITION_CONFIG,
	type CognitionConfig,
	type CognitionResult,
	type Intent,
	type MeasuredConfidence,
	type Provenance,
	type VerificationResult,
} from './types.js'

/** Injectable dependencies (defaults wire the real singletons; tests override). */
export interface CognitionDeps {
	generateFn?: GenerateFn | null
	/** Override cortex analysis (tests). Default: singleton CortexEngine.analyze. */
	analyze?: (query: string) => Promise<CortexAnalysis>
	/** Override the reasoning+escalation step (tests). */
	reason?: (query: string, context: string) => Promise<ReasoningChain | null>
	/** Override cross-model verification (tests). */
	verify?: (query: string, output: string) => Promise<CrossModelResult>
}

/** Lowercase word tokens for the convergence similarity check. */
function tokens(s: string): Set<string> {
	return new Set(s.toLowerCase().match(/[a-z0-9]{2,}/g) ?? [])
}
/** Jaccard similarity over word tokens (0-1). */
function similarity(a: string, b: string): number {
	const ta = tokens(a)
	const tb = tokens(b)
	if (ta.size === 0 || tb.size === 0) return 0
	let inter = 0
	for (const t of ta) if (tb.has(t)) inter++
	return inter / (ta.size + tb.size - inter)
}

/** Build the reasoning context from intent + cortex meta-insights + session + blind spots. */
function buildContext(intent: Intent, analysis: CortexAnalysis | null, blindSpots: string[]): string {
	const parts: string[] = []
	if (intent.implicit) parts.push(`Implicit intent: ${intent.implicit}`)
	if (intent.predictive) parts.push(`Likely next need: ${intent.predictive}`)
	if (intent.constraints.length > 0) parts.push(`Constraints: ${intent.constraints.join(', ')}`)
	if (analysis) {
		const high = analysis.metaInsights.filter((m) => m.priority === 'high' || m.priority === 'critical')
		for (const m of high.slice(0, 4)) parts.push(`[meta] ${m.description} → ${m.action}`)
	}
	if (blindSpots.length > 0) parts.push(`Address these previously-missed points: ${blindSpots.join('; ')}`)
	const session = getSessionContextManager().buildContextString()
	if (session) parts.push(session)
	return parts.join('\n')
}

/**
 * Run the closed-loop meta-cognition pipeline on a query.
 * Degrades honestly without a model (provenance.modelAvailable = false).
 */
export async function cognize(
	query: string,
	deps: CognitionDeps = {},
	config: CognitionConfig = DEFAULT_COGNITION_CONFIG,
): Promise<CognitionResult> {
	const startedAt = Date.now()
	const generateFn = deps.generateFn ?? null
	const modelAvailable = generateFn != null

	// 1. Intent (model-backed; heuristic fallback without a key).
	const intent = await resolveIntent(query, generateFn).catch(() => ({
		explicit: query, implicit: '', meta: '', predictive: '', constraints: [],
	}))

	// 2. Pre-meta: cortex analysis. This is the INJECTION THAT WAS MISSING —
	//    its meta-insights (gaps/bias/complexity) now feed the reasoning context.
	let analysis: CortexAnalysis | null = null
	try {
		analysis = deps.analyze ? await deps.analyze(query) : await getCortexEngine().analyze(query)
	} catch {
		analysis = null
	}

	let ctx = buildContext(intent, analysis, [])

	// 3. Reason with depth escalation (cot→tot→reflect→ensemble on low confidence).
	const reasonOnce = async (q: string, context: string): Promise<ReasoningChain | null> => {
		if (deps.reason) return deps.reason(q, context)
		if (!generateFn) return null
		const runFn = (qq: string, s: ReasoningStrategy, g?: GenerateFn) => runReasoning(qq, s, context, g ?? generateFn)
		try {
			return await runWithEscalation(q, 'auto', runFn, { minConfidence: config.minConfidence }, generateFn)
		} catch {
			return null
		}
	}

	let chain = await reasonOnce(query, ctx)

	// 4-5. Meta-evaluate + converge: re-reason injecting blind spots until a pass
	//      changes < epsilon (REAL convergence) or the pass budget is exhausted.
	let convergencePasses = 0
	let converged = chain == null // nothing to converge on without a chain
	const strategiesTried: string[] = chain ? collectStrategies(chain) : []
	if (chain) {
		let prevConclusion = chain.conclusion ?? ''
		for (let pass = 0; pass < config.maxConvergencePasses; pass++) {
			const meta = evaluateReasoning(chain)
			if (!meta.additionalPassNeeded || meta.blindSpots.length === 0) {
				converged = true
				break
			}
			ctx = buildContext(intent, analysis, meta.blindSpots)
			const next = await reasonOnce(query, ctx)
			if (!next) {
				converged = true
				break
			}
			convergencePasses++
			for (const s of collectStrategies(next)) if (!strategiesTried.includes(s)) strategiesTried.push(s)
			const sim = similarity(prevConclusion, next.conclusion ?? '')
			chain = next
			if (sim >= config.convergenceEpsilon) {
				converged = true
				break
			}
			prevConclusion = next.conclusion ?? ''
		}
	}
	const finalMeta: MetaReasoningResult | null = chain ? evaluateReasoning(chain) : null

	// 6. Cross-model verification of the final conclusion.
	let verification: VerificationResult | null = null
	let verifyResult: CrossModelResult | null = null
	const conclusion = chain?.conclusion ?? ''
	if (conclusion) {
		try {
			verifyResult = deps.verify ? await deps.verify(query, conclusion) : await crossVerify(query, conclusion, 'cross-model-verify')
		} catch {
			verifyResult = null
		}
		if (verifyResult) {
			verification = {
				provider: verifyResult.provider,
				agreement: typeof verifyResult.agreementWithPrimary === 'number' ? verifyResult.agreementWithPrimary : null,
				contradictions: Array.isArray(verifyResult.contradictions) ? verifyResult.contradictions : [],
			}
		}
	}

	// 7. Transparently-measured confidence (weighted, renormalized if verification absent).
	const cortexConf = analysis?.finalConfidence ?? 0
	const reasoningQuality = finalMeta?.reasoningQuality ?? 0
	const parts: { v: number; w: number }[] = [
		{ v: cortexConf, w: 0.4 },
		{ v: reasoningQuality, w: 0.35 },
	]
	if (verification?.agreement != null) parts.push({ v: verification.agreement, w: 0.25 })
	const totalW = parts.reduce((s, p) => s + p.w, 0)
	const measured = parts.reduce((s, p) => s + p.v * p.w, 0) / (totalW || 1)
	const confidence: MeasuredConfidence = {
		measured,
		cortex: cortexConf,
		reasoningQuality,
		verification: verification?.agreement ?? null,
	}

	// 9. Feed-forward: carry this chain into the next turn's session context.
	if (chain) {
		try {
			getSessionContextManager().updateFromChain(chain)
		} catch {
			/* non-critical */
		}
	}

	const provenance: Provenance = {
		strategiesTried: dedupe(strategiesTried),
		escalations: Math.max(0, strategiesTried.length - 1),
		convergencePasses,
		converged,
		metaInsightsCount: analysis?.metaInsights.length ?? 0,
		blindSpots: finalMeta?.blindSpots ?? [],
		modelAvailable,
		durationMs: Date.now() - startedAt,
	}

	// 8. Augmented context for the model's prompt.
	const augmentedContext = buildContext(intent, analysis, finalMeta?.blindSpots ?? [])

	return {
		query,
		intent,
		conclusion,
		confidence,
		verification,
		provenance,
		augmentedContext,
	}
}

/** Pull the strategies a chain touched (from step metadata / escalation markers). */
function collectStrategies(chain: ReasoningChain): string[] {
	const out = new Set<string>()
	if (chain.strategy) out.add(chain.strategy)
	for (const s of chain.steps) {
		const meta = s.metadata as Record<string, unknown> | undefined
		const strat = meta?.strategy ?? meta?.escalatedFrom ?? meta?.escalationLevel
		if (typeof strat === 'string') out.add(strat)
	}
	return [...out]
}

function dedupe(arr: string[]): string[] {
	return [...new Set(arr)]
}
