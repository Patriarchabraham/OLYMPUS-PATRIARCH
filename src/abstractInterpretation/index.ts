/**
 * Abstract Interpretation — barrel exports.
 */

export { analyzeAbstractly } from './abstractInterpreter.js'
export {
	iv, intervalAdd, intervalSub, intervalMul, intervalDiv, intervalNeg,
	isDefinitelyPositive, isDefinitelyNegative, mayBeZero, mayBeOutOfBounds,
	isDefinitelyInBounds, definitelyContainsZero, IntervalLattice,
} from './intervalDomain.js'
export {
	SignLattice, concreteToSign, signAdd, signMul, signNeg, intervalToSign,
} from './signDomain.js'
export type {
	Interval, Sign, AbstractValue, AbstractState, AIFinding, AIResult,
	AIConfig, LatticeOps,
} from './types.js'
export { DEFAULT_AI_CONFIG, POS_INF, NEG_INF } from './types.js'
