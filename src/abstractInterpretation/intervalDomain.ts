/**
 * Interval Domain — lattice operations for abstract intervals.
 *
 * An interval [lo, hi] represents all real numbers x where lo ≤ x ≤ hi.
 * null = bottom (no values), [−∞,+∞] = top (all values).
 *
 * Sound: join over-approximates, meet under-approximates.
 * Widening accelerates fixpoint convergence for loops.
 */

import type { Interval, LatticeOps } from './types.js'
import { NEG_INF, POS_INF } from './types.js'

/** Create an interval [lo, hi] */
export function iv(lo: number, hi: number): Interval {
	if (lo > hi) return null // empty
	return { lo, hi }
}

/** Interval lattice operations */
export const IntervalLattice: LatticeOps<Interval> = {
	bottom(): Interval {
		return null
	},

	top(): Interval {
		return { lo: NEG_INF, hi: POS_INF }
	},

	/** Union: [min(lo_a, lo_b), max(hi_a, hi_b)] */
	join(a: Interval, b: Interval): Interval {
		if (a === null) return b
		if (b === null) return a
		return { lo: Math.min(a.lo, b.lo), hi: Math.max(a.hi, b.hi) }
	},

	/** Intersection: [max(lo_a, lo_b), min(hi_a, hi_b)] */
	meet(a: Interval, b: Interval): Interval {
		if (a === null || b === null) return null
		const lo = Math.max(a.lo, b.lo)
		const hi = Math.min(a.hi, b.hi)
		return lo > hi ? null : { lo, hi }
	},

	isBottom(a: Interval): boolean {
		return a === null
	},

	isTop(a: Interval): boolean {
		return a !== null && a.lo === NEG_INF && a.hi === POS_INF
	},

	/** a ⊑ b iff a ⊆ b */
	lessOrEqual(a: Interval, b: Interval): boolean {
		if (a === null) return true // bottom ⊑ everything
		if (b === null) return false // nothing ⊑ bottom (except bottom)
		return a.lo >= b.lo && a.hi <= b.hi
	},

	/**
	 * Widening: if bounds are moving, jump to infinity.
	 * Ensures termination of fixpoint iteration for loops.
	 */
	widen(a: Interval, b: Interval): Interval {
		if (a === null) return b
		if (b === null) return a
		return {
			lo: b.lo < a.lo ? NEG_INF : a.lo,
			hi: b.hi > a.hi ? POS_INF : a.hi,
		}
	},

	/**
	 * Narrowing: refine widened bounds.
	 * If a bound is ±∞ and the new value is finite, use the finite value.
	 */
	narrow(a: Interval, b: Interval): Interval {
		if (a === null || b === null) return a
		return {
			lo: a.lo === NEG_INF ? b.lo : a.lo,
			hi: a.hi === POS_INF ? b.hi : a.hi,
		}
	},
}

/** Interval arithmetic: add two intervals */
export function intervalAdd(a: Interval, b: Interval): Interval {
	if (a === null || b === null) return null
	return { lo: a.lo + b.lo, hi: a.hi + b.hi }
}

/** Interval arithmetic: subtract */
export function intervalSub(a: Interval, b: Interval): Interval {
	if (a === null || b === null) return null
	return { lo: a.lo - b.hi, hi: a.hi - b.lo }
}

/** Interval arithmetic: multiply */
export function intervalMul(a: Interval, b: Interval): Interval {
	if (a === null || b === null) return null
	const products = [a.lo * b.lo, a.lo * b.hi, a.hi * b.lo, a.hi * b.hi]
	return { lo: Math.min(...products), hi: Math.max(...products) }
}

/** Interval arithmetic: divide (handles division by zero interval) */
export function intervalDiv(a: Interval, b: Interval): Interval {
	if (a === null || b === null) return null
	// If b contains 0, result is top (sound over-approximation)
	if (b.lo <= 0 && b.hi >= 0) return { lo: NEG_INF, hi: POS_INF }
	const quotients = [a.lo / b.lo, a.lo / b.hi, a.hi / b.lo, a.hi / b.hi]
	return { lo: Math.min(...quotients), hi: Math.max(...quotients) }
}

/** Interval arithmetic: negate */
export function intervalNeg(a: Interval): Interval {
	if (a === null) return null
	return { lo: -a.hi, hi: -a.lo }
}

/** Check if interval is definitely positive (no zero or negative) */
export function isDefinitelyPositive(a: Interval): boolean {
	return a !== null && a.lo > 0
}

/** Check if interval is definitely negative (no zero or positive) */
export function isDefinitelyNegative(a: Interval): boolean {
	return a !== null && a.hi < 0
}

/** Check if interval definitely contains zero */
export function definitelyContainsZero(a: Interval): boolean {
	return a !== null && a.lo <= 0 && a.hi >= 0
}

/** Check if interval might be zero */
export function mayBeZero(a: Interval): boolean {
	return a !== null && a.lo <= 0 && a.hi >= 0
}

/** Check if an index is definitely within bounds [0, length) */
export function isDefinitelyInBounds(index: Interval, length: number): boolean {
	if (index === null) return false
	return index.lo >= 0 && index.hi < length
}

/** Check if an index might be out of bounds */
export function mayBeOutOfBounds(index: Interval, length: number): boolean {
	if (index === null) return true
	return index.lo < 0 || index.hi >= length
}
