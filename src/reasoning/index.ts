import { cosineSimilarity, termFrequencies } from '../utils/nlp.js'
import { runChainOfThought } from './chainOfThought.js'
import { runSelfReflection } from './selfReflection.js'
import type { StrategySelectionOptions } from './strategySelector.js'
import { resolveStrategy } from './strategySelector.js'
import { runTreeOfThought } from './treeOfThought.js'
import type { GenerateFn, ReasoningChain, ReasoningStep, ReasoningStrategy } from './types.js'

export { runChainOfThought } from './chainOfThought.js'
export { createGenerateFn } from './generateFnFactory.js'
export { runSelfReflection } from './selfReflection.js'
export type { StrategySelectionOptions } from './strategySelector.js'
export { resolveStrategy, selectStrategy } from './strategySelector.js'
export { runTreeOfThought } from './treeOfThought.js'
export type {
	GenerateFn,
	ReasoningChain,
	ReasoningStep,
	ReasoningStrategy,
	ReflectionResult,
	StrategyRecommendation,
	TreeOfThoughtPath,
} from './types.js'

// ============================================================
// Gap 8: Semantic Ensemble Merger
// ============================================================

/** Negation words for contradiction detection */
const NEGATION_WORDS = new Set([
	'not',
	'no',
	'never',
	"don't",
	"doesn't",
	"didn't",
	"won't",
	"wouldn't",
	"shouldn't",
	"can't",
	'cannot',
	"isn't",
	"aren't",
	"wasn't",
	"weren't",
	"hasn't",
	"haven't",
	"hadn't",
	'nor',
])

/**
 * Semantic merge: clusters reasoning steps by TF-IDF cosine similarity,
 * picks the best representative per cluster, detects contradictions,
 * and generates synthesis steps for multi-member clusters.
 */
function semanticMerge(
	chains: ReasoningChain[],
	query: string,
	maxSteps: number,
): { steps: ReasoningStep[]; contradictions: string[] } {
	// Collect all steps with chain source info
	interface StepWithSource {
		step: ReasoningStep
		sourceChain: number
		tf: Map<string, number>
	}

	const allSteps: StepWithSource[] = []
	for (let ci = 0; ci < chains.length; ci++) {
		for (const step of chains[ci]!.steps) {
			const tokens = step.content
				.toLowerCase()
				.split(/\s+/)
				.filter((w) => w.length > 0)
			allSteps.push({
				step,
				sourceChain: ci,
				tf: termFrequencies(tokens),
			})
		}
	}

	if (allSteps.length === 0) {
		return { steps: [], contradictions: [] }
	}

	// Greedy clustering by cosine similarity
	const SIMILARITY_THRESHOLD = 0.65
	const assigned = new Set<number>()
	const clusters: StepWithSource[][] = []

	for (let i = 0; i < allSteps.length; i++) {
		if (assigned.has(i)) continue
		const cluster: StepWithSource[] = [allSteps[i]!]
		assigned.add(i)

		for (let j = i + 1; j < allSteps.length; j++) {
			if (assigned.has(j)) continue
			const sim = cosineSimilarity(allSteps[i]!.tf, allSteps[j]!.tf)
			if (sim >= SIMILARITY_THRESHOLD) {
				cluster.push(allSteps[j]!)
				assigned.add(j)
			}
		}

		clusters.push(cluster)
	}

	// Query TF for sorting
	const queryTokens = query
		.toLowerCase()
		.split(/\s+/)
		.filter((w) => w.length > 0)
	const queryTF = termFrequencies(queryTokens)

	// Process each cluster
	const finalSteps: ReasoningStep[] = []
	const contradictions: string[] = []

	// Sort clusters by centroid similarity to query
	const clusterScores = clusters.map((cluster) => {
		const centroidTF = new Map<string, number>()
		for (const s of cluster) {
			for (const [term, freq] of Array.from(s.tf.entries())) {
				centroidTF.set(term, (centroidTF.get(term) ?? 0) + freq)
			}
		}
		const size = cluster.length || 1
		for (const [term, freq] of Array.from(centroidTF.entries())) {
			centroidTF.set(term, freq / size)
		}
		return { cluster, querySim: cosineSimilarity(centroidTF, queryTF) }
	})

	clusterScores.sort((a, b) => b.querySim - a.querySim)

	for (const { cluster } of clusterScores) {
		if (finalSteps.length >= maxSteps) break

		// Pick highest-confidence step as representative
		const representative = cluster.reduce((best, s) =>
			s.step.confidence > best.step.confidence ? s : best,
		)

		finalSteps.push(representative.step)

		// If cluster has multiple members, check for contradictions
		if (cluster.length > 1) {
			let hasNegation = false
			let hasAffirmation = false

			for (const member of cluster) {
				const words = member.step.content.toLowerCase().split(/\s+/)
				for (const word of words) {
					if (NEGATION_WORDS.has(word)) hasNegation = true
					else hasAffirmation = true
				}
			}

			if (hasNegation && hasAffirmation) {
				const sources = cluster
					.map((s) => chains[s.sourceChain]!.strategy)
					.filter((v, i, a) => a.indexOf(v) === i)
				contradictions.push(
					`Contradiction detected between ${sources.join(' and ')}: "${representative.step.content.slice(0, 80)}..."`,
				)
			}

			// Generate synthesis step from multi-member cluster
			if (cluster.length >= 3 && finalSteps.length < maxSteps) {
				const uniqueSources = [...new Set(cluster.map((s) => chains[s.sourceChain]!.strategy))]
				finalSteps.push({
					id: `ensemble_synthesis_${finalSteps.length}`,
					type: 'synthesis',
					content: `Synthesis from ${cluster.length} perspectives (${uniqueSources.join(', ')}): converging on "${representative.step.content.slice(0, 100)}"`,
					confidence: Math.min(0.99, representative.step.confidence * 1.05),
					metadata: {
						clusterSize: cluster.length,
						sources: uniqueSources,
						isSynthesis: true,
					},
				})
			}
		}
	}

	return { steps: finalSteps, contradictions }
}

/**
 * Run ensemble reasoning — combines multiple strategies using
 * semantic TF-IDF clustering for intelligent merging (Gap 8).
 */
async function runEnsemble(
	query: string,
	context?: string,
	generateFn?: GenerateFn,
): Promise<ReasoningChain> {
	const startTime = Date.now()
	if (!generateFn) {
		throw new Error('runEnsemble requires a real GenerateFn — no LLM available')
	}
	const generate = generateFn

	// Run all three strategies in parallel
	const [cotResult, totResult, reflectResult] = await Promise.all([
		runChainOfThought(query, context, generate).catch(
			(): ReasoningChain => ({
				id: 'cot_fallback',
				strategy: 'cot',
				query,
				steps: [],
				conclusion: 'CoT reasoning failed',
				confidence: 0,
				durationMs: 0,
				timestamp: Date.now(),
			}),
		),
		runTreeOfThought(query, context, undefined, generate).catch(
			(): ReasoningChain => ({
				id: 'tot_fallback',
				strategy: 'tot',
				query,
				steps: [],
				conclusion: 'ToT reasoning failed',
				confidence: 0,
				durationMs: 0,
				timestamp: Date.now(),
			}),
		),
		runSelfReflection(query, context, undefined, generate).catch(
			(): ReasoningChain => ({
				id: 'reflect_fallback',
				strategy: 'reflect',
				query,
				steps: [],
				conclusion: 'Self-reflection failed',
				confidence: 0,
				durationMs: 0,
				timestamp: Date.now(),
			}),
		),
	])

	const chains = [cotResult, totResult, reflectResult]
	const weights = [1.0, 1.2, 1.1]

	// Use semantic merge instead of word-overlap dedup
	const { steps: mergedSteps, contradictions } = semanticMerge(chains, query, 15)

	// Calculate ensemble confidence as weighted average
	const totalWeight = weights.reduce((sum, w) => sum + w, 0)
	const ensembleConfidence =
		chains.reduce((sum, chain, i) => sum + chain.confidence * (weights[i] ?? 1), 0) / totalWeight

	// Find best chain for conclusion
	const best = chains.reduce((a, b, i) =>
		b.confidence * (weights[i] ?? 1) > a.confidence * (weights[i] ?? 1) ? b : a,
	)

	// Build enriched conclusion
	let conclusion = best.conclusion
	if (contradictions.length > 0) {
		conclusion += ` [Note: ${contradictions.length} contradiction(s) resolved via semantic merging]`
	}

	return {
		id: best.id,
		strategy: 'ensemble',
		query,
		steps: mergedSteps,
		conclusion,
		confidence: Math.min(0.99, ensembleConfidence * 1.05),
		durationMs: Date.now() - startTime,
		timestamp: Date.now(),
		metadata: {
			strategiesUsed: chains.map((c, i) => ({
				strategy: c.strategy,
				confidence: c.confidence,
				weight: weights[i],
			})),
			bestStrategy: best.strategy,
			semanticMergeUsed: true,
			contradictionsFound: contradictions.length,
		},
	}
}

/**
 * Run reasoning with optional strategy selection hints.
 *
 * @param query - The query to reason about
 * @param strategy - Strategy to use ('auto' for automatic selection)
 * @param context - Optional additional context
 * @param generateFn - Optional LLM generate function
 * @param selectionOptions - Optional cortex meta-insights and evolution hints
 */
export async function runReasoning(
	query: string,
	strategy: ReasoningStrategy = 'auto',
	context?: string,
	generateFn?: GenerateFn,
	selectionOptions?: StrategySelectionOptions,
): Promise<ReasoningChain> {
	const resolved = resolveStrategy(strategy, query, selectionOptions)

	switch (resolved) {
		case 'cot':
			return runChainOfThought(query, context, generateFn)
		case 'tot':
			return runTreeOfThought(query, context, undefined, generateFn)
		case 'reflect':
			return runSelfReflection(query, context, undefined, generateFn)
		case 'ensemble':
			return runEnsemble(query, context, generateFn)
		default:
			return runChainOfThought(query, context, generateFn)
	}
}
