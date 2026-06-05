/**
 * SAT Solver — barrel exports and singleton.
 */

export { solveDPLL, parseToCNF, checkPathFeasibility, extractPathConstraints } from './dpll.js'
export type {
	Variable,
	Literal,
	Clause,
	CNFFormula,
	Assignment,
	SATResult,
	DPLLStats,
	SATConfig,
	PathConstraint,
	PathFeasibilityResult,
} from './types.js'
export { DEFAULT_SAT_CONFIG } from './types.js'
