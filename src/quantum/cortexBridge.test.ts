import { describe, expect, it } from 'vitest'
import { quantumWithCortex } from './cortexBridge.js'

describe('quantumWithCortex', () => {
	it('runs with null cortex analysis', async () => {
		const result = await quantumWithCortex('test query', null)
		expect(result).toBeDefined()
		expect(result.quantumAnalysis).toBeDefined()
		expect(result.combinedConfidence).toBeGreaterThanOrEqual(0)
		expect(result.combinedConfidence).toBeLessThanOrEqual(1)
		expect(result.cortexAnalysis).toBeNull()
		expect(result.augmentedSteps.length).toBeGreaterThan(0)
	})

	it('includes quantum analysis with confidence', async () => {
		const result = await quantumWithCortex('analyze system performance', null)
		expect(result.quantumAnalysis.confidence).toBeGreaterThanOrEqual(0)
		expect(result.augmentedSteps.length).toBeGreaterThan(0)
	})
})
