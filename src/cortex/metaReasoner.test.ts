import { describe, expect, it } from 'vitest'
import type { ReasoningChain } from '../reasoning/types.js'
import { evaluateReasoning } from './metaReasoner.js'

function makeChain(
	query: string,
	steps: { content: string; confidence: number }[],
): ReasoningChain {
	return {
		id: 'test-chain',
		strategy: 'cot',
		query,
		steps: steps.map((s, i) => ({
			id: `step-${i}`,
			type: 'analysis' as const,
			content: s.content,
			confidence: s.confidence,
		})),
		conclusion: steps[steps.length - 1]?.content ?? '',
		confidence: 0.8,
		durationMs: 100,
		timestamp: Date.now(),
	}
}

describe('evaluateReasoning', () => {
	it('returns low quality for empty chain', () => {
		const chain = makeChain('test query', [])
		const result = evaluateReasoning(chain)
		expect(result.reasoningQuality).toBe(0)
		expect(result.additionalPassNeeded).toBe(true)
	})

	it('returns high quality for coherent chain', () => {
		const chain = makeChain('analyze performance', [
			{
				content: 'First we analyze the performance characteristics of the system',
				confidence: 0.8,
			},
			{ content: 'The performance analysis reveals key bottlenecks', confidence: 0.85 },
			{ content: 'Based on performance analysis, we recommend optimizations', confidence: 0.9 },
		])
		const result = evaluateReasoning(chain)
		expect(result.coherenceScore).toBeGreaterThan(0)
		expect(result.completenessScore).toBeGreaterThan(0)
	})

	it('detects bias in chain with absolutist language', () => {
		const chain = makeChain('test query', [
			{
				content:
					'This is always the best and definitely the only solution that is completely perfect and totally guaranteed',
				confidence: 0.9,
			},
		])
		const result = evaluateReasoning(chain)
		expect(result.biasDetected).toBe(true)
	})

	it('finds blind spots when query topics are uncovered', () => {
		const chain = makeChain('analyze database performance optimization', [
			{ content: 'We looked at the network latency', confidence: 0.8 },
		])
		const result = evaluateReasoning(chain)
		expect(result.blindSpots.length).toBeGreaterThan(0)
	})
})
