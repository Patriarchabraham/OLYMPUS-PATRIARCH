import { describe, it, expect } from 'vitest'
import { verifyTypographically } from '../typographicalVerifier.js'
import type { VerifierContext } from '../types.js'

describe('Typographical Verifier', () => {
	const makeContext = (code: string): VerifierContext => ({
		code,
		filePath: 'test.ts',
		provenConfidences: new Map(),
	})

	it('should score clean naming high', () => {
		const result = verifyTypographically(makeContext(`
			const itemCount = 10
			const userName = 'test'
			function calculateTotal(items: number[]): number {
				return items.reduce((sum, item) => sum + item, 0)
			}
		`))
		expect(result.value).toBeGreaterThan(0.5)
	})

	it('should flag snake_case in TypeScript', () => {
		const result = verifyTypographically(makeContext(`
			const user_name = 'test'
			const item_count = 10
		`))
		expect(result.findings.some((f) => f.ruleId === 'PROOF-TYPE-002')).toBe(true)
	})

	it('should flag abbreviated identifiers', () => {
		const result = verifyTypographically(makeContext(`
			const xs = [1, 2, 3]
			const fn = () => 1
			const cb = () => {}
		`))
		// These are in ALLOWED_SHORT_NAMES, so should not flag
		// Let's test with non-allowed abbreviations
		const result2 = verifyTypographically(makeContext(`
			const xy = 5
		`))
		expect(result2.findings.some((f) => f.ruleId === 'PROOF-TYPE-001')).toBe(true)
	})

	it('should detect potential typos via Levenshtein', () => {
		const result = verifyTypographically(makeContext(`
			const userCount = 10
			const userCoount = 20
		`))
		expect(result.findings.some((f) => f.ruleId === 'PROOF-TYPE-003')).toBe(true)
	})

	it('should NOT flag known suffixes as typos', () => {
		const result = verifyTypographically(makeContext(`
			const userId = 1
			const userName = 'test'
		`))
		expect(result.findings.some((f) => f.ruleId === 'PROOF-TYPE-003')).toBe(false)
	})

	it('should flag JSDoc param mismatches', () => {
		const result = verifyTypographically(makeContext(`
			/**
			 * @param name The name
			 * @param age The age
			 */
			function greet(person: string, greeting: string): string {
				return greeting + ' ' + person
			}
		`))
		expect(result.findings.some((f) => f.ruleId === 'PROOF-TYPE-004')).toBe(true)
	})

	it('should compute token efficiency', () => {
		const result = verifyTypographically(makeContext('const x = 1 + 2'))
		expect(result.subScores.tokenEfficiency).toBeGreaterThan(0)
		expect(result.subScores.tokenEfficiency).toBeLessThanOrEqual(1)
	})

	it('should have all sub-scores', () => {
		const result = verifyTypographically(makeContext('const x = 1'))
		expect(result.subScores).toHaveProperty('namingConsistency')
		expect(result.subScores).toHaveProperty('spellCorrectness')
		expect(result.subScores).toHaveProperty('jsdocAccuracy')
		expect(result.subScores).toHaveProperty('tokenEfficiency')
	})
})
