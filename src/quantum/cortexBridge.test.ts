import { describe, expect, it } from 'vitest'
import type { GenerateFn } from '../reasoning/types.js'
import { quantumWithCortex } from './cortexBridge.js'

/** A mock generateFn that emits candidates and scores, exercising the real math. */
const generateFn: GenerateFn = async (prompt) => {
	if (prompt.includes('propose exactly')) {
		return '1. First concrete approach for the dimension.\n2. Second distinct approach.\n3. Third approach.'
	}
	if (prompt.includes('Rate how strong')) {
		return '0.82'
	}
	return ''
}

describe('quantumWithCortex', () => {
	it('degrades honestly when no generateFn is provided', async () => {
		const result = await quantumWithCortex('test query', null)
		expect(result).toBeDefined()
		expect(result.quantumAnalysis).toBeDefined()
		expect(result.quantumAnalysis.degraded).toBe(true)
		expect(result.quantumAnalysis.confidence).toBe(0)
		expect(result.quantumAnalysis.states).toEqual([])
		// combinedConfidence still well-formed (quantum 0 * 0.6 + cortex 0.5 * 0.4 = 0.2).
		expect(result.combinedConfidence).toBeGreaterThanOrEqual(0)
		expect(result.combinedConfidence).toBeLessThanOrEqual(1)
		expect(result.cortexAnalysis).toBeNull()
		// PERCEIVE step is always present, so augmentedSteps is non-empty.
		expect(result.augmentedSteps.length).toBeGreaterThan(0)
	})

	it('runs the real pipeline with an LLM-backed generateFn', async () => {
		const result = await quantumWithCortex(
			'analyze system performance',
			null,
			undefined,
			undefined,
			generateFn,
		)
		expect(result.quantumAnalysis.degraded).toBeFalsy()
		expect(result.quantumAnalysis.states.length).toBeGreaterThan(0)
		expect(result.quantumAnalysis.confidence).toBeGreaterThan(0)
		expect(result.quantumAnalysis.confidence).toBeLessThanOrEqual(1)
		expect(result.augmentedSteps.length).toBeGreaterThan(0)
	})
})
