/**
 * Symbolic Execution types — explore all code paths with symbolic values.
 */

/** A symbolic variable (represents any possible concrete value) */
export interface SymbolicVar {
	/** Unique name (e.g., "x_0") */
	name: string
	/** Original variable name */
	originalName: string
	/** Type hint */
	type: 'number' | 'string' | 'boolean' | 'unknown'
}

/** A symbolic expression (tree of operations on symbolic vars) */
export type SymbolicExpr =
	| { kind: 'var'; name: string }
	| { kind: 'const'; value: number | string | boolean | null }
	| { kind: 'binop'; op: string; left: SymbolicExpr; right: SymbolicExpr }
	| { kind: 'unop'; op: string; operand: SymbolicExpr }
	| { kind: 'call'; fn: string; args: SymbolicExpr[] }
	| { kind: 'unknown' }

/** A path condition: conjunction of symbolic constraints along a path */
export interface PathCondition {
	/** The symbolic expression that must be true */
	expr: SymbolicExpr
	/** Whether this is a positive or negated condition */
	negated: boolean
	/** Source line number */
	lineNumber: number
	/** Human-readable description */
	description: string
}

/** Symbolic execution state at a program point */
export interface SymbolicState {
	/** Variable name → symbolic expression mapping */
	vars: Map<string, SymbolicExpr>
	/** Path conditions accumulated so far */
	pathConditions: PathCondition[]
	/** Current line number */
	lineNumber: number
	/** Whether this path is feasible */
	feasible: boolean
}

/** A discovered execution path */
export interface ExecutionPath {
	/** Unique path ID */
	id: string
	/** Path conditions (the branch decisions) */
	conditions: PathCondition[]
	/** Whether this path is feasible */
	feasible: boolean
	/** Symbolic state at end of path */
	finalState: Map<string, SymbolicExpr>
	/** Findings on this path */
	findings: SEFinding[]
	/** Lines covered */
	linesCovered: number[]
}

/** A finding from symbolic execution */
export interface SEFinding {
	/** Severity */
	severity: 'error' | 'warning' | 'info'
	/** Check type */
	check: string
	/** Message */
	message: string
	/** Line number */
	lineNumber: number
	/** The path where this was found */
	pathId: string
	/** Example input that triggers this (if computable) */
	witness: string | null
}

/** Result of symbolic execution analysis */
export interface SEResult {
	/** File analyzed */
	filePath: string
	/** Total paths explored */
	totalPaths: number
	/** Feasible paths */
	feasiblePaths: number
	/** Infeasible paths detected */
	infeasiblePaths: number
	/** All execution paths */
	paths: ExecutionPath[]
	/** All findings across all paths */
	findings: SEFinding[]
	/** Duration in ms */
	durationMs: number
}

/** Configuration for symbolic execution */
export interface SEConfig {
	/** Maximum path depth (branch depth) to explore (default: 10) */
	maxPathDepth: number
	/** Maximum total paths to explore (default: 100) */
	maxPaths: number
	/** Maximum loop unrolling iterations (default: 3) */
	maxLoopUnroll: number
	/** Enable constraint simplification (default: true) */
	enableSimplification: boolean
}

/** Default SE configuration */
export const DEFAULT_SE_CONFIG: SEConfig = {
	maxPathDepth: 10,
	maxPaths: 100,
	maxLoopUnroll: 3,
	enableSimplification: true,
}
