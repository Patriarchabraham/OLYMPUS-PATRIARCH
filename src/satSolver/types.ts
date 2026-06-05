/**
 * SAT Solver types — DPLL algorithm with unit propagation and pure literal elimination.
 */

/** A boolean variable represented as a positive integer */
export type Variable = number

/** A literal: positive variable or negated variable (negative number) */
export type Literal = number

/** A clause is a disjunction of literals */
export type Clause = Literal[]

/** A CNF formula is a conjunction of clauses */
export type CNFFormula = Clause[]

/** Assignment mapping variables to boolean values */
export type Assignment = Map<Variable, boolean>

/** SAT solver result */
export interface SATResult {
	/** Whether the formula is satisfiable */
	satisfiable: boolean
	/** Model (assignment) if satisfiable, null otherwise */
	model: Assignment | null
	/** Number of decisions made during search */
	decisions: number
	/** Number of unit propagations performed */
	propagations: number
	/** Time taken in milliseconds */
	durationMs: number
}

/** DPLL statistics for performance tracking */
export interface DPLLStats {
	/** Total recursive calls */
	recursiveCalls: number
	/** Unit propagation count */
	unitPropagations: number
	/** Pure literal eliminations */
	pureEliminations: number
	/** Backtracks performed */
	backtracks: number
}

/** SAT configuration */
export interface SATConfig {
	/** Maximum number of recursive calls before timeout (default: 10000) */
	maxRecursiveCalls: number
	/** Enable pure literal elimination (default: true) */
	enablePureLiteral: boolean
	/** Enable clause learning from conflicts (default: false for simplicity) */
	enableClauseLearning: boolean
}

/** Default SAT configuration */
export const DEFAULT_SAT_CONFIG: SATConfig = {
	maxRecursiveCalls: 10000,
	enablePureLiteral: true,
	enableClauseLearning: false,
}

/** Code path constraint for static analysis integration */
export interface PathConstraint {
	/** Source file path */
	filePath: string
	/** Line number */
	lineNumber: number
	/** The condition as a CNF clause */
	clause: Clause
	/** Human-readable description */
	description: string
}

/** Feasibility check result for code paths */
export interface PathFeasibilityResult {
	/** Whether the path is feasible */
	feasible: boolean
	/** The path constraints that were checked */
	constraints: PathConstraint[]
	/** SAT result for the constraint system */
	satResult: SATResult
	/** Explanation if infeasible */
	reason: string | null
}
