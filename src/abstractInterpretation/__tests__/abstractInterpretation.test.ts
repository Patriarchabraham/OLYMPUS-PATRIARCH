import { describe, it, expect } from 'vitest'
import { analyzeAbstractly, IntervalLattice, SignLattice } from '../index.js'
import { iv, intervalAdd, intervalSub, intervalMul, intervalDiv, intervalNeg, mayBeZero } from '../intervalDomain.js'
import { concreteToSign, signAdd, signMul, signNeg, intervalToSign } from '../signDomain.js'

describe('Abstract Interpretation', () => {
	describe('Interval Domain', () => {
		it('creates intervals', () => {
			expect(iv(1, 5)).toEqual({ lo: 1, hi: 5 })
			expect(iv(5, 1)).toBeNull() // empty
		})

		it('join (union) works', () => {
			expect(IntervalLattice.join(iv(1, 5), iv(3, 8))).toEqual({ lo: 1, hi: 8 })
			expect(IntervalLattice.join(null, iv(1, 5))).toEqual({ lo: 1, hi: 5 })
		})

		it('meet (intersection) works', () => {
			expect(IntervalLattice.meet(iv(1, 5), iv(3, 8))).toEqual({ lo: 3, hi: 5 })
			expect(IntervalLattice.meet(iv(1, 2), iv(3, 4))).toBeNull()
		})

		it('widen accelerates to infinity', () => {
			expect(IntervalLattice.widen(iv(0, 5), iv(0, 10))).toEqual({ lo: 0, hi: Number.POSITIVE_INFINITY })
			expect(IntervalLattice.widen(iv(0, 5), iv(0, 3))).toEqual({ lo: 0, hi: 5 })
		})

		it('narrow refines infinity', () => {
			const wide = { lo: Number.NEGATIVE_INFINITY, hi: Number.POSITIVE_INFINITY }
			expect(IntervalLattice.narrow(wide, iv(0, 10))).toEqual({ lo: 0, hi: 10 })
		})

		it('lessOrEqual checks containment', () => {
			expect(IntervalLattice.lessOrEqual(iv(2, 4), iv(1, 5))).toBe(true)
			expect(IntervalLattice.lessOrEqual(iv(1, 5), iv(2, 4))).toBe(false)
		})

		it('arithmetic: add', () => {
			expect(intervalAdd(iv(1, 3), iv(2, 4))).toEqual({ lo: 3, hi: 7 })
		})

		it('arithmetic: subtract', () => {
			expect(intervalSub(iv(1, 5), iv(2, 3))).toEqual({ lo: -2, hi: 3 })
		})

		it('arithmetic: multiply', () => {
			expect(intervalMul(iv(-1, 2), iv(3, 4))).toEqual({ lo: -4, hi: 8 })
		})

		it('arithmetic: divide (handles zero)', () => {
			const result = intervalDiv(iv(1, 10), iv(-1, 1))
			expect(result).toEqual({ lo: Number.NEGATIVE_INFINITY, hi: Number.POSITIVE_INFINITY })
		})

		it('arithmetic: negate', () => {
			expect(intervalNeg(iv(-3, 5))).toEqual({ lo: -5, hi: 3 })
		})

		it('mayBeZero detection', () => {
			expect(mayBeZero(iv(-1, 1))).toBe(true)
			expect(mayBeZero(iv(2, 5))).toBe(false)
			expect(mayBeZero(iv(-5, -1))).toBe(false)
		})
	})

	describe('Sign Domain', () => {
		it('join combines signs', () => {
			expect(SignLattice.join('positive', 'negative')).toBe('top')
			expect(SignLattice.join('positive', 'positive')).toBe('positive')
			expect(SignLattice.join('positive', 'bottom')).toBe('positive')
		})

		it('meet narrows signs', () => {
			expect(SignLattice.meet('positive', 'top')).toBe('positive')
			expect(SignLattice.meet('positive', 'negative')).toBe('bottom')
		})

		it('sign arithmetic works', () => {
			expect(signAdd('positive', 'positive')).toBe('positive')
			expect(signAdd('positive', 'negative')).toBe('top')
			expect(signMul('positive', 'negative')).toBe('negative')
			expect(signMul('negative', 'negative')).toBe('positive')
			expect(signNeg('positive')).toBe('negative')
		})

		it('concreteToSign', () => {
			expect(concreteToSign(5)).toBe('positive')
			expect(concreteToSign(-3)).toBe('negative')
			expect(concreteToSign(0)).toBe('zero')
		})

		it('intervalToSign', () => {
			expect(intervalToSign(1, 5)).toBe('positive')
			expect(intervalToSign(-5, -1)).toBe('negative')
			expect(intervalToSign(-1, 1)).toBe('top')
			expect(intervalToSign(0, 0)).toBe('zero')
		})
	})

	describe('analyzeAbstractly', () => {
		it('tracks numeric variable declarations', () => {
			const code = `
const x = 5
const y = 10
const z = x + y
`
			const result = analyzeAbstractly(code, 'test.ts')
			const lastState = [...result.states.values()].pop()
			expect(lastState?.get('z')?.interval).toEqual({ lo: 15, hi: 15 })
		})

		it('detects potential division by zero', () => {
			const code = `
const x = 0
const y = 10 / x
`
			const result = analyzeAbstractly(code, 'test.ts')
			const divByZero = result.findings.filter((f) => f.check === 'division-by-zero')
			expect(divByZero.length).toBeGreaterThanOrEqual(1)
		})

		it('detects potential negative array index', () => {
			const code = `
const idx = -1
const arr = [1, 2, 3]
const val = arr[idx]
`
			const result = analyzeAbstractly(code, 'test.ts')
			const oob = result.findings.filter((f) => f.check === 'array-oob')
			expect(oob.length).toBeGreaterThanOrEqual(1)
		})

		it('detects potential null dereference', () => {
			const code = `
const user = null
const name = user.name
`
			const result = analyzeAbstractly(code, 'test.ts')
			const nullDeref = result.findings.filter((f) => f.check === 'null-deref')
			expect(nullDeref.length).toBeGreaterThanOrEqual(1)
		})

		it('computes soundness score', () => {
			const result = analyzeAbstractly('const x = 5', 'test.ts')
			expect(result.soundnessScore).toBe(1) // No findings

			const result2 = analyzeAbstractly('const x = 0\nconst y = 10 / x', 'test.ts')
			expect(result2.soundnessScore).toBeLessThan(1)
		})

		it('tracks compound assignments', () => {
			const code = `
const x = 5
x += 3
`
			const result = analyzeAbstractly(code, 'test.ts')
			const lastState = [...result.states.values()].pop()
			expect(lastState?.get('x')?.interval).toEqual({ lo: 8, hi: 8 })
		})

		it('handles null assignments', () => {
			const code = `const user = null`
			const result = analyzeAbstractly(code, 'test.ts')
			const state = [...result.states.values()].pop()
			expect(state?.get('user')?.mayBeNull).toBe(true)
		})

		it('returns duration', () => {
			const result = analyzeAbstractly('const x = 5', 'test.ts')
			expect(result.durationMs).toBeGreaterThanOrEqual(0)
		})

		it('skips comments and imports', () => {
			const code = `// comment\nimport { x } from 'y'\nconst z = 5`
			const result = analyzeAbstractly(code, 'test.ts')
			expect(result.findings.length).toBe(0)
		})
	})
})
