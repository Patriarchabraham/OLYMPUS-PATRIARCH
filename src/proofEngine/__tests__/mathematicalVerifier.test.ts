import { describe, it, expect } from 'vitest'
import { verifyMathematically } from '../mathematicalVerifier.js'
import type { VerifierContext } from '../types.js'

describe('Mathematical Verifier', () => {
	const makeContext = (code: string): VerifierContext => ({
		code,
		filePath: 'test.ts',
		provenConfidences: new Map(),
	})

	it('should score clean arithmetic code high', () => {
		const result = verifyMathematically(makeContext(`
			function add(a: number, b: number): number {
				if (a !== 0 && b !== 0) {
					return a + b
				}
				return 0
			}
		`))
		expect(result.value).toBeGreaterThan(0.5)
		expect(result.subScores).toHaveProperty('bayesianConfidence')
	})

	it('should flag division without zero-check', () => {
		const result = verifyMathematically(makeContext(`
			function divide(a: number, b: number): number {
				return a / b
			}
		`))
		expect(result.findings.some((f) => f.ruleId === 'PROOF-MATH-004')).toBe(true)
	})

	it('should detect float equality issues', () => {
		const result = verifyMathematically(makeContext(`
			const x: number = 0.1
			const y: number = 0.2
			if (x + y === 0.3) { return true }
		`))
		expect(result.findings.some((f) => f.ruleId === 'PROOF-MATH-003')).toBe(true)
	})

	it('should warn about missing invariants on loops', () => {
		const code = `
			for (let i = 0; i < 100; i++) { doWork(i) }
			for (let j = 0; j < 100; j++) { doMore(j) }
			for (let k = 0; k < 100; k++) { doEvenMore(k) }
		`
		const result = verifyMathematically(makeContext(code))
		expect(result.findings.some((f) => f.ruleId === 'PROOF-MATH-001')).toBe(true)
	})

	it('should detect NaN propagation risk', () => {
		const result = verifyMathematically(makeContext(`
			const a = Math.sqrt(x) * Math.log(y) + Math.exp(z)
			const b = Math.sin(a) * Math.cos(b)
			const c = Math.tan(a) * Math.atan(b)
			const d = Math.pow(c, 2) + Math.abs(d)
		`))
		expect(result.findings.some((f) => f.ruleId === 'PROOF-MATH-006')).toBe(true)
	})

	it('should flag boundary issues with array access', () => {
		const result = verifyMathematically(makeContext(`
			function getFirst(arr: string[]): string {
				return arr[0]
			}
			function getByIndex(arr: string[], i: number): string {
				return arr[i]
			}
			function getItem(list: number[], pos: number): number {
				return list[pos]
			}
		`))
		expect(result.findings.some((f) => f.ruleId === 'PROOF-MATH-007')).toBe(true)
	})

	it('should use compositional proof for proven callees', () => {
		const proven = new Map([
			['safeAdd', 0.99],
			['safeMul', 0.98],
		])
		const result = verifyMathematically({
			code: 'const x = safeAdd(1, safeMul(2, 3))',
			filePath: 'comp.ts',
			provenConfidences: proven,
		})
		expect(result.subScores.compositionalProof).toBeGreaterThan(0.9)
	})

	it('should use Bayesian confidence computation', () => {
		const result = verifyMathematically(makeContext('const x = 1 + 2'))
		expect(result.subScores.bayesianConfidence).toBeGreaterThan(0)
		expect(result.subScores.bayesianConfidence).toBeLessThanOrEqual(1)
	})
})
