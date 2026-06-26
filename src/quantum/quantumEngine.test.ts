import { describe, expect, it } from 'vitest'
import type { GenerateFn } from '../reasoning/types.js'
import { QuantumEngine } from './quantumEngine.js'

/** Mock generator driving the real quantum math deterministically. */
const generateFn: GenerateFn = async (prompt) => {
	if (prompt.includes('propose exactly')) {
		return '1. A secure, concrete approach.\n2. A second distinct approach.\n3. A third approach.'
	}
	if (prompt.includes('Rate how strong')) {
		return '0.8'
	}
	return ''
}

describe('QuantumEngine', () => {
	it('degrades honestly without a generateFn', async () => {
		const engine = new QuantumEngine()
		const analysis = await engine.process('design a secure API')
		expect(analysis.degraded).toBe(true)
		expect(analysis.confidence).toBe(0)
		expect(analysis.states).toEqual([])
		expect(analysis.collapseResult).toBeNull()
	})

	it('runs the full pipeline and collapses a solution with a generateFn', async () => {
		const engine = new QuantumEngine()
		engine.setGenerateFn(generateFn)
		const analysis = await engine.process('design a secure, fast REST API for a SaaS')
		expect(analysis.degraded).toBeFalsy()
		expect(analysis.states.length).toBeGreaterThan(0)
		expect(analysis.dimensionsCovered.length).toBeGreaterThan(0)
		expect(analysis.confidence).toBeGreaterThan(0)
		expect(analysis.confidence).toBeLessThanOrEqual(1)
	})

	it('records history and increments the process counter', async () => {
		const engine = new QuantumEngine()
		engine.setGenerateFn(generateFn)
		await engine.process('task one')
		await engine.process('task two')
		expect(engine.getHistory().length).toBe(2)
	})
})
