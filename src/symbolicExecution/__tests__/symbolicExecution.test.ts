import { describe, it, expect } from 'vitest'
import { executeSymbolically, simplifyExpr } from '../index.js'
import type { SymbolicExpr } from '../types.js'

describe('Symbolic Execution', () => {
	describe('executeSymbolically', () => {
		it('analyzes code with no branches (single path)', () => {
			const code = `
const x = 5
const y = 10
const z = x + y
`
			const result = executeSymbolically(code, 'test.ts')
			expect(result.totalPaths).toBe(1)
			expect(result.feasiblePaths).toBe(1)
			expect(result.paths[0]?.feasible).toBe(true)
		})

		it('explores both branches of an if/else', () => {
			const code = `
const x = 5
if (x > 0) {
	const y = 1
} else {
	const y = -1
}
`
			const result = executeSymbolically(code, 'test.ts')
			expect(result.totalPaths).toBe(2)
			expect(result.feasiblePaths).toBeGreaterThanOrEqual(1)
		})

		it('detects division by zero on a specific path', () => {
			const code = `
const x = 0
const y = 10 / x
`
			const result = executeSymbolically(code, 'test.ts')
			const divErrors = result.findings.filter((f) => f.check === 'division-by-zero')
			expect(divErrors.length).toBeGreaterThanOrEqual(1)
			expect(divErrors[0]?.severity).toBe('error')
		})

		it('detects negative array index on a path', () => {
			const code = `
const idx = -1
const arr = [1, 2, 3]
const val = arr[idx]
`
			const result = executeSymbolically(code, 'test.ts')
			const oobErrors = result.findings.filter((f) => f.check === 'array-oob')
			expect(oobErrors.length).toBeGreaterThanOrEqual(1)
		})

		it('detects error paths (throw statements)', () => {
			const code = `
const x = -1
if (x < 0) {
	throw new Error('negative')
}
`
			const result = executeSymbolically(code, 'test.ts')
			const errorPaths = result.findings.filter((f) => f.check === 'error-path')
			expect(errorPaths.length).toBeGreaterThanOrEqual(1)
		})

		it('respects maxPaths limit', () => {
			// Code with many branches
			const code = `
if (a > 0) { } else { }
if (b > 0) { } else { }
if (c > 0) { } else { }
if (d > 0) { } else { }
if (e > 0) { } else { }
`
			const result = executeSymbolically(code, 'test.ts', { maxPaths: 4, maxPathDepth: 10, maxLoopUnroll: 3, enableSimplification: true })
			expect(result.totalPaths).toBeLessThanOrEqual(4)
		})

		it('tracks witness (example inputs)', () => {
			const code = `
const x = 0
const y = 10 / x
`
			const result = executeSymbolically(code, 'test.ts')
			const divError = result.findings.find((f) => f.check === 'division-by-zero')
			expect(divError?.witness).toBeTruthy()
		})

		it('returns duration', () => {
			const result = executeSymbolically('const x = 5', 'test.ts')
			expect(result.durationMs).toBeGreaterThanOrEqual(0)
		})

		it('handles empty code', () => {
			const result = executeSymbolically('', 'test.ts')
			expect(result.totalPaths).toBe(1)
		})
	})

	describe('simplifyExpr', () => {
		it('folds constant arithmetic', () => {
			const expr: SymbolicExpr = {
				kind: 'binop', op: '+',
				left: { kind: 'const', value: 3 },
				right: { kind: 'const', value: 4 },
			}
			const result = simplifyExpr(expr)
			expect(result.kind === 'const' && result.value).toBe(7)
		})

		it('eliminates x + 0', () => {
			const expr: SymbolicExpr = {
				kind: 'binop', op: '+',
				left: { kind: 'var', name: 'x' },
				right: { kind: 'const', value: 0 },
			}
			const result = simplifyExpr(expr)
			expect(result.kind).toBe('var')
		})

		it('eliminates x * 1', () => {
			const expr: SymbolicExpr = {
				kind: 'binop', op: '*',
				left: { kind: 'var', name: 'x' },
				right: { kind: 'const', value: 1 },
			}
			const result = simplifyExpr(expr)
			expect(result.kind).toBe('var')
		})
	})
})
