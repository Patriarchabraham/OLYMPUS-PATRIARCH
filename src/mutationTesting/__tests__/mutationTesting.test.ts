import { describe, it, expect } from 'vitest'
import { generateMutants, computeMutationScore, generateSuggestions } from '../mutantGenerator.js'

const SAMPLE_CODE = `
function add(a: number, b: number): number {
	return a + b
}

function isPositive(x: number): boolean {
	return x > 0
}

function processItems(items: string[]): number {
	if (items.length > 0) {
		return items.length
	}
	return 0
}

function checkAnd(a: boolean, b: boolean): boolean {
	return a && b
}

const enabled = true
const disabled = false
`

describe('MutantGenerator', () => {
	it('generates arithmetic flip mutants', () => {
		const mutants = generateMutants(SAMPLE_CODE, 'test.ts', ['flip_arithmetic'])
		const addMutants = mutants.filter((m) => m.originalCode.includes('+'))
		expect(addMutants.length).toBeGreaterThan(0)
		expect(addMutants.some((m) => m.mutatedCode.includes('-'))).toBe(true)
	})

	it('generates comparison flip mutants', () => {
		const mutants = generateMutants(SAMPLE_CODE, 'test.ts', ['flip_comparison'])
		expect(mutants.some((m) => m.operator === 'flip_comparison')).toBe(true)
	})

	it('generates boolean flip mutants', () => {
		const mutants = generateMutants(SAMPLE_CODE, 'test.ts', ['flip_boolean'])
		const trueMutants = mutants.filter((m) => m.originalCode.includes('true') && m.mutatedCode.includes('false'))
		expect(trueMutants.length).toBeGreaterThan(0)
	})

	it('generates negate condition mutants', () => {
		const mutants = generateMutants(SAMPLE_CODE, 'test.ts', ['negate_condition'])
		expect(mutants.some((m) => m.operator === 'negate_condition')).toBe(true)
	})

	it('generates remove statement mutants', () => {
		const mutants = generateMutants(SAMPLE_CODE, 'test.ts', ['remove_statement'])
		expect(mutants.some((m) => m.operator === 'remove_statement')).toBe(true)
	})

	it('generates change return mutants', () => {
		const mutants = generateMutants(SAMPLE_CODE, 'test.ts', ['change_return'])
		expect(mutants.some((m) => m.operator === 'change_return')).toBe(true)
		const returnMutants = mutants.filter((m) => m.operator === 'change_return')
		expect(returnMutants.some((m) => m.mutatedCode.includes('undefined'))).toBe(true)
	})

	it('generates boundary change mutants', () => {
		const code = `
function check(items: string[]): number {
	if (items.length >= 1) {
		return items.length
	}
	if (items.length <= 0) {
		return 0
	}
	return -1
}
`
		const mutants = generateMutants(code, 'test.ts', ['boundary_change'])
		expect(mutants.some((m) => m.operator === 'boundary_change')).toBe(true)
	})

	it('generates logical flip mutants', () => {
		const mutants = generateMutants(SAMPLE_CODE, 'test.ts', ['flip_logical'])
		expect(mutants.some((m) => m.operator === 'flip_logical')).toBe(true)
	})

	it('produces valid mutated source', () => {
		const mutants = generateMutants(SAMPLE_CODE, 'test.ts')
		for (const mutant of mutants) {
			expect(mutant.mutatedSource).toBeDefined()
			expect(mutant.mutatedSource.length).toBeGreaterThan(0)
			expect(mutant.mutatedSource).not.toBe(SAMPLE_CODE)
		}
	})

	it('assigns unique IDs', () => {
		const mutants = generateMutants(SAMPLE_CODE, 'test.ts')
		const ids = new Set(mutants.map((m) => m.id))
		expect(ids.size).toBe(mutants.length)
	})

	it('skips comment lines', () => {
		const code = `
// This is a comment
const x = 1 + 2
// Another comment
`
		const mutants = generateMutants(code, 'test.ts')
		// Should not mutate comments
		expect(mutants.every((m) => !m.originalCode.startsWith('//'))).toBe(true)
	})
})

describe('MutationScorer', () => {
	it('computes correct mutation score', () => {
		const mutants = generateMutants(SAMPLE_CODE, 'test.ts')
		// Manually create a simple score scenario
		const half = Math.floor(mutants.length / 2)
		for (let i = 0; i < mutants.length; i++) {
			mutants[i].status = i < half ? 'killed' : 'survived'
		}
		const score = computeMutationScore(mutants)
		expect(score.total).toBe(mutants.length)
		expect(score.killed).toBe(half)
		expect(score.survived).toBe(mutants.length - half)
		expect(score.score).toBeCloseTo(half / mutants.length, 1)
	})

	it('computes perfect score when all killed', () => {
		const code = `
function add(a, b) {
	return a + b
}
`
		const mutants = generateMutants(code, 'test.ts')
		expect(mutants.length).toBeGreaterThan(0)
		for (const m of mutants) m.status = 'killed'
		const score = computeMutationScore(mutants)
		expect(score.score).toBe(1)
	})

	it('computes zero score when all survive', () => {
		const mutants = generateMutants(SAMPLE_CODE, 'test.ts')
		// All default to 'survived'
		const score = computeMutationScore(mutants)
		expect(score.score).toBe(0)
	})

	it('tracks per-operator breakdown', () => {
		const mutants = generateMutants(SAMPLE_CODE, 'test.ts')
		for (let i = 0; i < mutants.length; i++) {
			mutants[i].status = i % 2 === 0 ? 'killed' : 'survived'
		}
		const score = computeMutationScore(mutants)
		for (const op of Object.values(score.byOperator)) {
			expect(op.total).toBeGreaterThan(0)
			expect(op.killed).toBeLessThanOrEqual(op.total)
		}
	})
})

describe('Suggestions', () => {
	it('generates suggestions for surviving mutants', () => {
		const mutants = generateMutants(SAMPLE_CODE, 'test.ts')
		// All survive by default
		const suggestions = generateSuggestions(mutants)
		expect(suggestions.length).toBeGreaterThan(0)
	})

	it('congratulates when all killed', () => {
		const code = `function add(a: number, b: number): number {\n\treturn a + b\n}`
		const mutants = generateMutants(code, 'test.ts')
		for (const m of mutants) m.status = 'killed'
		const suggestions = generateSuggestions(mutants)
		expect(suggestions).toContain('All mutants killed — test suite is strong!')
	})
})
