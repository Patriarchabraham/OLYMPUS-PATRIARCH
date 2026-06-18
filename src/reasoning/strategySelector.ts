import type { MetaInsight } from '../cortex/types.js'
import type { ReasoningStrategy, StrategyRecommendation } from './types.js'

const EXPLORATORY_KEYWORDS = [
	'explore',
	'compare',
	'alternatives',
	'options',
	'brainstorm',
	'creative',
	'ideas',
	'different approaches',
	'what if',
	'possibilities',
	'trade-offs',
	'tradeoffs',
	'pros and cons',
	'evaluate',
]

const VERIFICATION_KEYWORDS = [
	'verify',
	'check',
	'ensure',
	'validate',
	'confirm',
	'correct',
	'accurate',
	'audit',
	'review',
	'test',
	'proof',
	'guarantee',
	'security',
	'safety',
	'critical',
	'important',
	'must',
]

const DESIGN_KEYWORDS = [
	'design',
	'architect',
	'plan',
	'system',
	'structure',
	'refactor',
	'redesign',
	'restructure',
	'migrate',
	'scale',
	'infrastructure',
	'complex',
	'comprehensive',
	'end-to-end',
]

/** Options for enhanced strategy selection with cortex and evolution hints */
export interface StrategySelectionOptions {
	/** Cortex meta-insights from meta-cognition analysis */
	metaInsights?: MetaInsight[]
	/** Evolution system hint based on historical success */
	evolutionHint?: { strategy: string; successRate: number }
}

/**
 * Select the best reasoning strategy for a query.
 *
 * Enhanced with cortex meta-insights (Gap 1) and evolution
 * feedback (Gap 3) for 100x smarter strategy selection.
 */
export function selectStrategy(
	query: string,
	options?: StrategySelectionOptions,
): StrategyRecommendation {
	// ─── Gap 1: Cortex meta-insight override ───────────────────────
	if (options?.metaInsights) {
		const strategyInsight = options.metaInsights.find((i) => i.type === 'optimal_strategy')
		if (strategyInsight) {
			// Parse score from description like "score=0.570, margin=0.157"
			const scoreMatch = strategyInsight.description.match(/score[=\s]+([0-9.]+)/i)
			const marginMatch = strategyInsight.description.match(/margin[=\s]+([0-9.]+)/i)
			const score = scoreMatch ? Number.parseFloat(scoreMatch[1]!) : 0
			const margin = marginMatch ? Number.parseFloat(marginMatch[1]!) : 0

			if (score > 0.5 && margin > 0.1 && strategyInsight.confidence > 0.5) {
				// Extract strategy from action string
				const actionStr = strategyInsight.action.toLowerCase()
				const matchedStrategy = extractStrategyFromText(actionStr)
				if (matchedStrategy) {
					return {
						strategy: matchedStrategy,
						reason: `Cortex meta-cognition recommends ${matchedStrategy} (score=${score.toFixed(3)}, margin=${margin.toFixed(3)}): ${strategyInsight.description}`,
						estimatedComplexity: score > 0.8 ? 'high' : score > 0.5 ? 'medium' : 'low',
						estimatedSteps: strategyInsight.confidence > 0.7 ? 8 : 5,
					}
				}
			}
		}
	}

	// ─── Gap 3: Evolution hint boost ───────────────────────────────
	const evolutionBoost = options?.evolutionHint
	const lower = query.toLowerCase()
	const len = query.length

	// Check for verification keywords
	const verificationScore = VERIFICATION_KEYWORDS.filter((k) => lower.includes(k)).length
	if (verificationScore >= 2 || (verificationScore >= 1 && lower.includes('critical'))) {
		// Boost with evolution if it recommends reflect
		if (
			evolutionBoost &&
			evolutionBoost.strategy === 'reflect' &&
			evolutionBoost.successRate > 0.7
		) {
			return {
				strategy: 'reflect',
				reason: `Evolution-boosted (${(evolutionBoost.successRate * 100).toFixed(0)}% success): verification query with ${verificationScore} terms`,
				estimatedComplexity: 'high',
				estimatedSteps: 7,
			}
		}
		return {
			strategy: 'reflect',
			reason: `Query contains ${verificationScore} verification-related terms, self-reflection will ensure accuracy`,
			estimatedComplexity: 'high',
			estimatedSteps: 6,
		}
	}

	// Check for exploratory keywords
	const exploratoryScore = EXPLORATORY_KEYWORDS.filter((k) => lower.includes(k)).length
	if (exploratoryScore >= 2) {
		if (evolutionBoost && evolutionBoost.strategy === 'tot' && evolutionBoost.successRate > 0.7) {
			return {
				strategy: 'tot',
				reason: `Evolution-boosted (${(evolutionBoost.successRate * 100).toFixed(0)}% success): exploratory query with ${exploratoryScore} terms`,
				estimatedComplexity: 'high',
				estimatedSteps: 9,
			}
		}
		return {
			strategy: 'tot',
			reason: `Query explores ${exploratoryScore} alternative/comparison concepts, tree-of-thought will evaluate multiple paths`,
			estimatedComplexity: 'high',
			estimatedSteps: 8,
		}
	}

	// Check for design/architecture keywords
	const designScore = DESIGN_KEYWORDS.filter((k) => lower.includes(k)).length
	if (designScore >= 2) {
		return {
			strategy: 'tot',
			reason: `Query involves architectural decisions with ${designScore} design terms, tree-of-thought explores design space`,
			estimatedComplexity: 'high',
			estimatedSteps: 10,
		}
	}

	// ─── Evolution hint fallback boost ──────────────────────────────
	if (evolutionBoost && evolutionBoost.successRate > 0.7) {
		const validStrategies: ReasoningStrategy[] = ['cot', 'tot', 'reflect', 'ensemble']
		if (validStrategies.includes(evolutionBoost.strategy as ReasoningStrategy)) {
			return {
				strategy: evolutionBoost.strategy as ReasoningStrategy,
				reason: `Evolution recommends ${evolutionBoost.strategy} based on ${(evolutionBoost.successRate * 100).toFixed(0)}% historical success rate`,
				estimatedComplexity: 'medium',
				estimatedSteps: 6,
			}
		}
	}

	// Complexity by length
	if (len > 500) {
		return {
			strategy: 'tot',
			reason: 'Query is extensive, tree-of-thought will explore multiple solution paths',
			estimatedComplexity: 'high',
			estimatedSteps: 8,
		}
	}

	if (len > 200) {
		return {
			strategy: 'cot',
			reason: 'Medium-complexity query, chain-of-thought will decompose into logical steps',
			estimatedComplexity: 'medium',
			estimatedSteps: 4,
		}
	}

	// Check if verification is primary intent even with single keyword
	if (verificationScore === 1) {
		return {
			strategy: 'reflect',
			reason: 'Query has verification intent, self-reflection adds a verification loop',
			estimatedComplexity: 'medium',
			estimatedSteps: 5,
		}
	}

	if (exploratoryScore === 1) {
		return {
			strategy: 'tot',
			reason: 'Query has exploratory intent, tree-of-thought provides broader coverage',
			estimatedComplexity: 'medium',
			estimatedSteps: 6,
		}
	}

	return {
		strategy: 'cot',
		reason: 'Straightforward query, chain-of-thought provides structured reasoning',
		estimatedComplexity: 'low',
		estimatedSteps: 3,
	}
}

/**
 * Resolve a strategy (handles 'auto') with optional cortex and evolution hints.
 */
export function resolveStrategy(
	strategy: ReasoningStrategy,
	query: string,
	options?: StrategySelectionOptions,
): Exclude<ReasoningStrategy, 'auto'> {
	if (strategy !== 'auto') return strategy
	return selectStrategy(query, options).strategy as Exclude<ReasoningStrategy, 'auto'>
}

/** Extract a valid strategy name from a text string */
function extractStrategyFromText(text: string): ReasoningStrategy | null {
	const strategies: ReasoningStrategy[] = ['cot', 'tot', 'reflect', 'ensemble']
	for (const s of strategies) {
		if (
			text.includes(s) ||
			text.includes(
				s === 'cot'
					? 'chain-of-thought'
					: s === 'tot'
						? 'tree-of-thought'
						: s === 'reflect'
							? 'self-reflection'
							: s,
			)
		) {
			return s
		}
	}
	return null
}
