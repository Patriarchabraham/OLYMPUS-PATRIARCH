import { describe, it, expect } from 'vitest'
import { parseContracts, extractFunctionSignatures } from '../contractParser.js'
import { verifyContracts } from '../contractVerifier.js'
import type { ContractClause } from '../types.js'

const SAMPLE_CODE = `
/**
 * Divide two numbers.
 * @param numerator
 * @param denominator
 * @pre denominator > 0
 * @post result >= 0
 * @invariant numerator is finite
 */
function divide(numerator: number, denominator: number): number {
	if (denominator === 0) throw new Error('Division by zero')
	return numerator / denominator
}

/**
 * Add two values.
 * @param a
 * @param b
 * @pre a >= 0
 * @post result > a
 */
function add(a: number, b: number): number {
	return a + b
}

/**
 * Get user name.
 * @param user
 * @invariant user is not null
 */
const getUserName = (user: { name: string }) => {
	return user.name
}
`

describe('Contract Programming', () => {
	describe('parseContracts', () => {
		it('extracts @pre conditions from JSDoc', () => {
			const clauses = parseContracts(SAMPLE_CODE, 'test.ts')
			const pres = clauses.filter((c) => c.kind === 'precondition')
			expect(pres.length).toBeGreaterThanOrEqual(2)
			expect(pres.some((p) => p.condition.includes('denominator'))).toBe(true)
			expect(pres.some((p) => p.condition.includes('a >= 0'))).toBe(true)
		})

		it('extracts @post conditions from JSDoc', () => {
			const clauses = parseContracts(SAMPLE_CODE, 'test.ts')
			const posts = clauses.filter((c) => c.kind === 'postcondition')
			expect(posts.length).toBeGreaterThanOrEqual(2)
			expect(posts.some((p) => p.condition.includes('result'))).toBe(true)
		})

		it('extracts @invariant from JSDoc', () => {
			const clauses = parseContracts(SAMPLE_CODE, 'test.ts')
			const invs = clauses.filter((c) => c.kind === 'invariant')
			expect(invs.length).toBeGreaterThanOrEqual(2)
		})

		it('associates contracts with function names', () => {
			const clauses = parseContracts(SAMPLE_CODE, 'test.ts')
			const divideClauses = clauses.filter((c) => c.functionName === 'divide')
			expect(divideClauses.length).toBeGreaterThanOrEqual(2)
		})

		it('returns empty array for code without JSDoc', () => {
			const clauses = parseContracts('const x = 5', 'test.ts')
			expect(clauses).toEqual([])
		})

		it('handles single-line JSDoc', () => {
			const code = `/** @pre x > 0 */ function foo(x: number) { return x }`
			const clauses = parseContracts(code, 'test.ts')
			expect(clauses.length).toBeGreaterThanOrEqual(1)
			expect(clauses[0].kind).toBe('precondition')
		})
	})

	describe('extractFunctionSignatures', () => {
		it('extracts named function parameters', () => {
			const sigs = extractFunctionSignatures(SAMPLE_CODE)
			expect(sigs.get('divide')).toEqual(['numerator', 'denominator'])
			expect(sigs.get('add')).toEqual(['a', 'b'])
		})

		it('extracts arrow function parameters', () => {
			const sigs = extractFunctionSignatures(SAMPLE_CODE)
			expect(sigs.has('getUserName')).toBe(true)
		})

		it('handles functions with no parameters', () => {
			const code = 'function noop() { return 1 }'
			const sigs = extractFunctionSignatures(code)
			expect(sigs.get('noop')).toEqual([])
		})
	})

	describe('verifyContracts', () => {
		it('verifies precondition with guard clause as satisfied', () => {
			const clauses: ContractClause[] = [{
				kind: 'precondition',
				condition: 'denominator > 0',
				filePath: 'test.ts',
				functionName: 'divide',
				lineNumber: 5,
				parameters: ['numerator', 'denominator'],
				staticallyCheckable: true,
			}]

			const report = verifyContracts(clauses, SAMPLE_CODE)
			expect(report.totalContracts).toBe(1)
			// The guard clause `if (denominator === 0)` should partially match
			expect(report.results[0].confidence).toBeGreaterThan(0)
		})

		it('detects missing precondition as violated', () => {
			const code = `
function unsafe(x: number) {
	return x
}
`
			const clauses: ContractClause[] = [{
				kind: 'precondition',
				condition: 'x > 100',
				filePath: 'test.ts',
				functionName: 'unsafe',
				lineNumber: 1,
				parameters: ['x'],
				staticallyCheckable: true,
			}]

			const report = verifyContracts(clauses, code)
			expect(report.results[0].satisfied).toBe(false)
		})

		it('generates suggestions for violations', () => {
			const code = `function foo(x: number) { return x }`
			const clauses: ContractClause[] = [{
				kind: 'precondition',
				condition: 'x > 0',
				filePath: 'test.ts',
				functionName: 'foo',
				lineNumber: 1,
				parameters: ['x'],
				staticallyCheckable: true,
			}]

			const report = verifyContracts(clauses, code)
			expect(report.suggestions.length).toBeGreaterThanOrEqual(1)
			expect(report.suggestions[0]).toContain('foo')
		})

		it('computes compliance score', () => {
			const report = verifyContracts([], SAMPLE_CODE)
			expect(report.complianceScore).toBe(1) // No contracts = perfect score
		})

		it('verifies full sample code', () => {
			const clauses = parseContracts(SAMPLE_CODE, 'test.ts')
			const report = verifyContracts(clauses, SAMPLE_CODE)
			expect(report.totalContracts).toBeGreaterThan(0)
			expect(report.complianceScore).toBeGreaterThanOrEqual(0)
			expect(report.complianceScore).toBeLessThanOrEqual(1)
		})
	})
})
