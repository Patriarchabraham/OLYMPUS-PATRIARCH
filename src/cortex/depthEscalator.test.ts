import { describe, expect, it } from 'vitest'
import type { ReasoningChain } from '../reasoning/types.js'
import { runWithEscalation } from './depthEscalator.js'

function makeChain(strategy: string, confidence: number): ReasoningChain {
	return {
		id: `test-${Date.now()}`,
		strategy: strategy as ReasoningChain['strategy'],
		query: 'test query',
		steps: [{ id: '1', type: 'analysis', content: `Step from ${strategy}`, confidence }],
		conclusion: `Result from ${strategy}`,
		confidence,
		durationMs: 100,
		timestamp: Date.now(),
	}
}

describe('runWithEscalation', () => {
	it('returns immediately when confidence is high', async () => {
		const highConfidenceChain = makeChain('cot', 0.9)
		const result = await runWithEscalation('test query', 'cot', async (_q, strategy) => {
			if (strategy === 'cot') return highConfidenceChain
			throw new Error('Should not escalate')
		})
		expect(result.confidence).toBe(0.9)
	})

	it('escalates when confidence is low', async () => {
		const lowChain = makeChain('cot', 0.3)
		const highChain = makeChain('tot', 0.8)
		let callCount = 0
		const result = await runWithEscalation(
			'test query',
			'cot',
			async (_q, strategy) => {
				callCount++
				if (strategy === 'cot') return lowChain
				return highChain
			},
			{ minConfidence: 0.7, maxEscalations: 2 },
		)
		expect(callCount).toBeGreaterThan(1)
		expect(result.confidence).toBeGreaterThanOrEqual(0.7)
	})
})
