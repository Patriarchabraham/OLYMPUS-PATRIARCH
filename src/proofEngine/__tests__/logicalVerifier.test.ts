import { describe, it, expect } from 'vitest'
import { verifyLogically } from '../logicalVerifier.js'
import type { VerifierContext } from '../types.js'

describe('Logical Verifier', () => {
	const makeContext = (code: string): VerifierContext => ({
		code,
		filePath: 'test.ts',
		provenConfidences: new Map(),
	})

	it('should score clean conditional code high', () => {
		const result = verifyLogically(makeContext(`
			function classify(n: number): string {
				if (n > 0) return 'positive'
				else if (n < 0) return 'negative'
				else return 'zero'
			}
		`))
		expect(result.value).toBeGreaterThan(0.5)
	})

	it('should detect tautological conditions', () => {
		const result = verifyLogically(makeContext(`
			if (true) { doSomething() }
		`))
		expect(result.findings.some((f) => f.ruleId === 'PROOF-LOGIC-001')).toBe(true)
	})

	it('should detect contradictory conditions', () => {
		const result = verifyLogically(makeContext(`
			if (false) { doSomething() }
		`))
		expect(result.findings.some((f) => f.ruleId === 'PROOF-LOGIC-002')).toBe(true)
	})

	it('should detect dead code after return', () => {
		const result = verifyLogically(makeContext(`
			function foo(): number {
				return 42
				console.log('unreachable')
			}
		`))
		expect(result.findings.some((f) => f.ruleId === 'PROOF-LOGIC-004')).toBe(true)
	})

	it('should detect dead code after throw', () => {
		const result = verifyLogically(makeContext(`
			function bar(): never {
				throw new Error('fail')
				console.log('also unreachable')
			}
		`))
		expect(result.findings.some((f) => f.ruleId === 'PROOF-LOGIC-004')).toBe(true)
	})

	it('should flag .every() without length check', () => {
		const result = verifyLogically(makeContext(`
			const allValid = items.every(x => x > 0)
			if (allValid) { process() }
		`))
		expect(result.findings.some((f) => f.ruleId === 'PROOF-LOGIC-005')).toBe(true)
	})

	it('should flag trivial .some() predicates', () => {
		const result = verifyLogically(makeContext(`
			const hasItems = items.some(() => true)
		`))
		expect(result.findings.some((f) => f.ruleId === 'PROOF-LOGIC-006')).toBe(true)
	})

	it('should flag non-null assertions', () => {
		const result = verifyLogically(makeContext(`
			const a = x!.foo!.bar!.baz!.qux!
		`))
		expect(result.findings.some((f) => f.ruleId === 'PROOF-LOGIC-007')).toBe(true)
	})

	it('should flag switch without default', () => {
		const result = verifyLogically(makeContext(`
			switch (color) {
				case 'red': return 1
				case 'blue': return 2
				case 'green': return 3
			}
		`))
		expect(result.findings.some((f) => f.ruleId === 'PROOF-LOGIC-009')).toBe(true)
	})

	it('should have all sub-scores', () => {
		const result = verifyLogically(makeContext('const x = 1'))
		expect(result.subScores).toHaveProperty('propositionalConsistency')
		expect(result.subScores).toHaveProperty('deadCodeAbsence')
		expect(result.subScores).toHaveProperty('predicateCorrectness')
		expect(result.subScores).toHaveProperty('typeSoundness')
		expect(result.subScores).toHaveProperty('conditionalCompleteness')
	})
})
