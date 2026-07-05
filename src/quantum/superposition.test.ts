import { describe, expect, it } from 'vitest'
import type { GenerateFn } from '../reasoning/types.js'
import { evaluateStates, superpose } from './superposition.js'
import { DEFAULT_QUANTUM_CONFIG } from './types.js'

/** Mock generator: candidates are a numbered list; evaluations are a decimal. */
const generateFn: GenerateFn = async (prompt) => {
	if (prompt.includes('propose exactly')) {
		return '1. Approach A.\n2. Approach B.\n3. Approach C.'
	}
	if (prompt.includes('Rate how strong')) {
		return '0.75'
	}
	return ''
}

const emptyGenerateFn: GenerateFn = async () => ''

describe('superpose (LLM-backed)', () => {
	it('produces candidates from the LLM, not hardcoded templates', async () => {
		const states = await superpose('design a secure API', DEFAULT_QUANTUM_CONFIG, generateFn)
		// 10 dimensions × 3 candidates each.
		expect(states.length).toBe(
			DEFAULT_QUANTUM_CONFIG.dimensions.length * DEFAULT_QUANTUM_CONFIG.maxStatesPerDimension,
		)
		// Solutions come from the mock LLM output...
		expect(states.some((s) => s.solution.includes('Approach A'))).toBe(true)
		// ...not from the old hardcoded templates.
		expect(states.every((s) => !s.solution.includes('Zero-trust architecture'))).toBe(true)
	})

	it('is empty when the LLM returns nothing (honest degradation)', async () => {
		const states = await superpose('x', DEFAULT_QUANTUM_CONFIG, emptyGenerateFn)
		expect(states).toEqual([])
	})
})

describe('evaluateStates (LLM-backed)', () => {
	it('applies the LLM evaluation score and keeps confidence in range', async () => {
		const states = await superpose('design a secure API', DEFAULT_QUANTUM_CONFIG, generateFn)
		const evaluated = await evaluateStates(states, 'design a secure API', generateFn)
		expect(evaluated.length).toBe(states.length)
		for (const s of evaluated) {
			expect(s.confidence).toBeGreaterThanOrEqual(0)
			expect(s.confidence).toBeLessThanOrEqual(1)
		}
	})

	it('is a no-op over an empty state set', async () => {
		const evaluated = await evaluateStates([], 'x', generateFn)
		expect(evaluated).toEqual([])
	})
})

describe('adaptive dimension selection', () => {
	/** Generator that answers the relevance prompt with a subset. */
	const adaptiveFn: GenerateFn = async (prompt) => {
		if (prompt.includes('MOST relevant')) return 'security, performance, ux'
		if (prompt.includes('propose exactly')) return '1. A.\n2. B.\n3. C.'
		if (prompt.includes('Rate how strong')) return '0.8'
		return ''
	}

	it('narrows to the LLM-selected dimensions when available', async () => {
		const states = await superpose('design a secure fast UI', DEFAULT_QUANTUM_CONFIG, adaptiveFn)
		const dims = new Set(states.map((s) => s.dimension))
		expect(dims.size).toBe(3)
		expect(dims.has('security')).toBe(true)
		expect(dims.has('performance')).toBe(true)
		expect(dims.has('ux')).toBe(true)
	})

	it('falls back to all configured dimensions when the LLM gives no relevance answer', async () => {
		// `generateFn` (the default mock) returns '' for the relevance prompt.
		const states = await superpose('x', DEFAULT_QUANTUM_CONFIG, generateFn)
		const dims = new Set(states.map((s) => s.dimension))
		expect(dims.size).toBe(DEFAULT_QUANTUM_CONFIG.dimensions.length)
	})
})
