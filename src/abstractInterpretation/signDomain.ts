/**
 * Sign Domain — lattice for tracking sign of values (+, -, 0, ⊤, ⊥).
 *
 * Useful for quick checks: "can this expression be negative?",
 * "is this value always non-zero?", etc.
 */

import type { LatticeOps, Sign } from './types.js'

/** Sign lattice: bottom < {neg, zero, pos} < top */
const SIGN_LEVELS: Record<Sign, number> = {
	bottom: 0,
	negative: 1,
	zero: 1,
	positive: 1,
	top: 2,
}

export const SignLattice: LatticeOps<Sign> = {
	bottom(): Sign { return 'bottom' },
	top(): Sign { return 'top' },

	join(a: Sign, b: Sign): Sign {
		if (a === 'bottom') return b
		if (b === 'bottom') return a
		if (a === b) return a
		return 'top'
	},

	meet(a: Sign, b: Sign): Sign {
		if (a === 'top') return b
		if (b === 'top') return a
		if (a === b) return a
		return 'bottom'
	},

	isBottom(a: Sign): boolean { return a === 'bottom' },
	isTop(a: Sign): boolean { return a === 'top' },

	lessOrEqual(a: Sign, b: Sign): boolean {
		if (a === 'bottom') return true
		if (b === 'top') return true
		return a === b
	},

	widen(a: Sign, b: Sign): Sign {
		// Sign domain is finite, widening = join
		return SignLattice.join(a, b)
	},

	narrow(a: Sign, b: Sign): Sign {
		// Sign domain is finite, narrowing = meet
		return SignLattice.meet(a, b)
	},
}

/** Determine sign of a concrete number */
export function concreteToSign(n: number): Sign {
	if (Number.isNaN(n)) return 'top'
	if (n > 0) return 'positive'
	if (n < 0) return 'negative'
	return 'zero'
}

/** Sign of addition */
export function signAdd(a: Sign, b: Sign): Sign {
	if (a === 'bottom' || b === 'bottom') return 'bottom'
	if (a === 'top' || b === 'top') return 'top'
	if (a === 'zero') return b
	if (b === 'zero') return a
	if (a === b) return a // pos+pos=pos, neg+neg=neg
	return 'top' // pos+neg=top
}

/** Sign of multiplication */
export function signMul(a: Sign, b: Sign): Sign {
	if (a === 'bottom' || b === 'bottom') return 'bottom'
	if (a === 'zero' || b === 'zero') return 'zero'
	if (a === 'top' || b === 'top') return 'top'
	if (a === b) return 'positive' // pos*pos=pos, neg*neg=pos
	return 'negative' // pos*neg=neg
}

/** Sign of negation */
export function signNeg(a: Sign): Sign {
	if (a === 'bottom') return 'bottom'
	if (a === 'top') return 'top'
	if (a === 'positive') return 'negative'
	if (a === 'negative') return 'positive'
	return 'zero'
}

/** Convert an interval to a sign */
export function intervalToSign(lo: number, hi: number): Sign {
	if (lo > hi) return 'bottom'
	if (lo > 0) return 'positive'
	if (hi < 0) return 'negative'
	if (lo === 0 && hi === 0) return 'zero'
	return 'top'
}
