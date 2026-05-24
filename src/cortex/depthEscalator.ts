/**
 * DepthEscalator — Confidence-based reasoning depth escalation.
 *
 * Fills Gap 2: No reasoning depth escalation based on confidence.
 * Wraps runReasoning with automatic strategy escalation when
 * confidence is below threshold.
 */

import type { GenerateFn, ReasoningChain, ReasoningStrategy } from '../reasoning/types.js'

/** Configuration for depth escalation behavior */
export interface EscalationConfig {
	/** Minimum confidence to accept a result (default 0.7) */
	minConfidence: number
	/** Maximum number of escalation attempts (default 3) */
	maxEscalations: number
	/** Strategy escalation path (default: cot -> tot -> reflect -> ensemble) */
	escalationPath: ReasoningStrategy[]
}

const DEFAULT_ESCALATION_CONFIG: EscalationConfig = {
	minConfidence: 0.7,
	maxEscalations: 3,
	escalationPath: ['cot', 'tot', 'reflect', 'ensemble'],
}

/**
 * Run reasoning with confidence-based depth escalation.
 *
 * Starts with initialStrategy. If confidence is below minConfidence,
 * escalates through the escalationPath with increasingly powerful
 * strategies until confidence threshold is met.
 *
 * @param query - The query to reason about
 * @param initialStrategy - Starting strategy
 * @param runReasoningFn - Function to run a reasoning chain
 * @param config - Optional escalation configuration
 * @param generateFn - Optional LLM generate function
 * @returns The reasoning chain with highest confidence
 */
export async function runWithEscalation(
	query: string,
	initialStrategy: ReasoningStrategy,
	runReasoningFn: (
		query: string,
		strategy: ReasoningStrategy,
		generateFn?: GenerateFn,
	) => Promise<ReasoningChain>,
	config?: Partial<EscalationConfig>,
	generateFn?: GenerateFn,
): Promise<ReasoningChain> {
	const cfg = { ...DEFAULT_ESCALATION_CONFIG, ...config }

	// Run initial strategy
	let bestChain = await runReasoningFn(query, initialStrategy, generateFn)
	let bestConfidence = bestChain.confidence

	if (bestConfidence >= cfg.minConfidence) {
		return bestChain
	}

	// Find starting position in escalation path
	let pathIndex = cfg.escalationPath.indexOf(initialStrategy)
	if (pathIndex === -1) pathIndex = 0
	else pathIndex++ // Move to next strategy

	// Escalate through strategies
	let escalations = 0
	const additionalSteps = [...bestChain.steps]

	while (
		bestConfidence < cfg.minConfidence &&
		escalations < cfg.maxEscalations &&
		pathIndex < cfg.escalationPath.length
	) {
		const nextStrategy = cfg.escalationPath[pathIndex]!

		try {
			const escalatedChain = await runReasoningFn(query, nextStrategy, generateFn)

			// Append escalated steps with metadata
			for (const step of escalatedChain.steps) {
				additionalSteps.push({
					...step,
					metadata: {
						...step.metadata,
						escalationLevel: escalations + 1,
						originalStrategy: initialStrategy,
						escalatedFrom: bestChain.strategy,
					},
				})
			}

			// Update best if this pass improved confidence
			if (escalatedChain.confidence > bestConfidence) {
				bestConfidence = escalatedChain.confidence
				bestChain = escalatedChain
			}
		} catch {
			// If escalation fails, continue to next strategy
		}

		escalations++
		pathIndex++
	}

	// Return chain with all accumulated steps
	return {
		...bestChain,
		steps: additionalSteps.length > 0 ? additionalSteps : bestChain.steps,
		confidence: bestConfidence,
		metadata: {
			...bestChain.metadata,
			escalationUsed: true,
			escalationCount: escalations,
			initialStrategy,
			finalStrategy: bestChain.strategy,
		},
	}
}
