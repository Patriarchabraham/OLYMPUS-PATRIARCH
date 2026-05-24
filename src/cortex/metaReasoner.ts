/**
 * MetaReasoner — Evaluates the quality of reasoning chains themselves.
 *
 * Fills Gap 7: No recursive reasoning (reasoning about reasoning).
 * Analyzes coherence, completeness, bias, and blind spots to
 * determine if additional reasoning passes are needed.
 */

import type { ReasoningChain, ReasoningStep } from '../reasoning/types.js'
import { cosineSimilarity, STOP_WORDS, termFrequencies, tokenize } from '../utils/nlp.js'

/** Result of meta-reasoning evaluation */
export interface MetaReasoningResult {
	/** Composite reasoning quality score 0-1 */
	reasoningQuality: number
	/** Are consecutive steps logically connected? 0-1 */
	coherenceScore: number
	/** Did reasoning cover all query aspects? 0-1 */
	completenessScore: number
	/** Whether absolutist bias was detected */
	biasDetected: boolean
	/** Topics from the query that were not covered by reasoning */
	blindSpots: string[]
	/** How to improve the reasoning */
	recommendation: string
	/** Whether an additional reasoning pass is recommended */
	additionalPassNeeded: boolean
}

/** Absolutist/bias words that indicate overconfidence */
const ABSOLUTIST_WORDS = new Set([
	'always',
	'never',
	'obviously',
	'clearly',
	'definitely',
	'certainly',
	'absolutely',
	'impossible',
	'guaranteed',
	'everyone',
	'nobody',
	'all',
	'none',
	'every',
	'completely',
	'totally',
	'utterly',
	'simply',
	'undoubtedly',
])

/**
 * Evaluate the quality of a reasoning chain by analyzing
 * coherence between steps, completeness of topic coverage,
 * potential bias, and blind spots.
 *
 * @param chain - The reasoning chain to evaluate
 * @returns Meta-reasoning evaluation result
 */
export function evaluateReasoning(chain: ReasoningChain): MetaReasoningResult {
	if (chain.steps.length === 0) {
		return {
			reasoningQuality: 0,
			coherenceScore: 0,
			completenessScore: 0,
			biasDetected: false,
			blindSpots: [],
			recommendation: 'Empty reasoning chain — no steps to evaluate',
			additionalPassNeeded: true,
		}
	}

	const coherence = computeCoherence(chain.steps)
	const completeness = computeCompleteness(chain.query, chain.steps)
	const bias = detectBias(chain.steps)
	const blindSpots = findBlindSpots(chain.query, chain.steps)
	const stepCoverage = Math.min(chain.steps.length / 5, 1)

	// Weighted composite quality
	const quality =
		coherence * 0.3 +
		completeness * 0.3 +
		(bias ? 0 : 1) * 0.15 +
		stepCoverage * 0.1 +
		(blindSpots.length === 0 ? 1 : Math.max(0, 1 - blindSpots.length * 0.1)) * 0.15

	const additionalPassNeeded = quality < 0.7

	let recommendation: string
	if (quality >= 0.8) {
		recommendation = 'Reasoning quality is high — chain is coherent and complete'
	} else if (quality >= 0.6) {
		const weakAreas: string[] = []
		if (coherence < 0.6) weakAreas.push('coherence between steps')
		if (completeness < 0.6) weakAreas.push('topic coverage')
		if (bias) weakAreas.push('absolutist language bias')
		if (blindSpots.length > 3) weakAreas.push(`${blindSpots.length} uncovered topics`)
		recommendation = `Moderate quality — consider improving: ${weakAreas.join(', ')}`
	} else {
		recommendation = `Low quality (${quality.toFixed(2)}) — additional reasoning pass strongly recommended`
	}

	return {
		reasoningQuality: quality,
		coherenceScore: coherence,
		completenessScore: completeness,
		biasDetected: bias,
		blindSpots,
		recommendation,
		additionalPassNeeded,
	}
}

/**
 * Compute coherence score: average cosine similarity between consecutive steps.
 * High coherence means steps build logically on each other.
 */
function computeCoherence(steps: ReasoningStep[]): number {
	if (steps.length <= 1) return 0.5

	const similarities: number[] = []
	for (let i = 1; i < steps.length; i++) {
		const prevTokens = tokenize(steps[i - 1]!.content)
		const currTokens = tokenize(steps[i]!.content)

		if (prevTokens.length === 0 || currTokens.length === 0) continue

		const prevTF = termFrequencies(prevTokens)
		const currTF = termFrequencies(currTokens)
		similarities.push(cosineSimilarity(prevTF, currTF))
	}

	return similarities.length > 0 ? similarities.reduce((a, b) => a + b, 0) / similarities.length : 0
}

/**
 * Compute completeness score: ratio of query keywords covered by reasoning steps.
 */
function computeCompleteness(query: string, steps: ReasoningStep[]): number {
	const queryTokens = tokenize(query).filter((t) => !STOP_WORDS.has(t) && t.length > 2)
	if (queryTokens.length === 0) return 1

	const allStepContent = steps
		.map((s) => s.content)
		.join(' ')
		.toLowerCase()
	let covered = 0
	for (const token of queryTokens) {
		if (allStepContent.includes(token)) covered++
	}

	return covered / queryTokens.length
}

/**
 * Detect absolutist bias in reasoning steps.
 */
function detectBias(steps: ReasoningStep[]): boolean {
	let absolutistCount = 0
	let totalWords = 0

	for (const step of steps) {
		const tokens = tokenize(step.content)
		totalWords += tokens.length
		for (const token of tokens) {
			if (ABSOLUTIST_WORDS.has(token)) absolutistCount++
		}
	}

	// More than 2% absolutist words indicates bias
	return totalWords > 0 && absolutistCount / totalWords > 0.02
}

/**
 * Find blind spots: query topics not covered by any reasoning step.
 */
function findBlindSpots(query: string, steps: ReasoningStep[]): string[] {
	const queryTokens = tokenize(query).filter((t) => !STOP_WORDS.has(t) && t.length > 2)

	const allStepContent = steps
		.map((s) => s.content)
		.join(' ')
		.toLowerCase()

	const blindSpots: string[] = []
	for (const token of queryTokens) {
		if (!allStepContent.includes(token)) {
			blindSpots.push(token)
		}
	}

	return blindSpots
}
