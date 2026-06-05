/**
 * Abstract Interpretation types — Interval and Sign domain lattices
 * for proving properties without executing code.
 *
 * Sound by construction: zero false negatives (if AI says safe, it IS safe).
 */

/** Interval [lo, hi] where lo <= hi. null = bottom (empty), [−∞,+∞] = top */
export type Interval = { lo: number; hi: number } | null

/** Sign lattice elements */
export type Sign = 'bottom' | 'negative' | 'zero' | 'positive' | 'top'

/** Abstract value: either an interval or sign abstraction */
export interface AbstractValue {
	/** Interval domain value */
	interval: Interval
	/** Sign domain value */
	sign: Sign
	/** Whether this variable might be null */
	mayBeNull: boolean
	/** Whether this variable might be undefined */
	mayBeUndefined: boolean
	/** Whether this value is definitely a number */
	definitelyNumber: boolean
}

/** Variable name to abstract value mapping */
export type AbstractState = Map<string, AbstractValue>

/** A finding from abstract interpretation */
export interface AIFinding {
	/** Severity level */
	severity: 'error' | 'warning' | 'info'
	/** The check that found the issue */
	check: string
	/** Human-readable message */
	message: string
	/** Line number in source */
	lineNumber: number
	/** Confidence (0-1) */
	confidence: number
}

/** Result of abstract interpretation analysis */
export interface AIResult {
	/** Source file analyzed */
	filePath: string
	/** Total variables tracked */
	variablesTracked: number
	/** Findings (potential bugs detected) */
	findings: AIFinding[]
	/** Final abstract state at each program point */
	states: Map<number, AbstractState>
	/** Overall soundness score (0-1, 1 = all checks passed) */
	soundnessScore: number
	/** Duration in ms */
	durationMs: number
}

/** Lattice operations for a domain */
export interface LatticeOps<T> {
	bottom(): T
	top(): T
	join(a: T, b: T): T
	meet(a: T, b: T): T
	isBottom(a: T): boolean
	isTop(a: T): boolean
	lessOrEqual(a: T, b: T): boolean
	widen(a: T, b: T): T
	narrow(a: T, b: T): T
}

/** Configuration for abstract interpretation */
export interface AIConfig {
	/** Maximum fixpoint iterations (default: 100) */
	maxIterations: number
	/** Widening delay — iterations before applying widening (default: 3) */
	wideningDelay: number
	/** Enable interval domain (default: true) */
	enableIntervalDomain: boolean
	/** Enable sign domain (default: true) */
	enableSignDomain: boolean
	/** Enable null analysis (default: true) */
	enableNullAnalysis: boolean
}

/** Default AI configuration */
export const DEFAULT_AI_CONFIG: AIConfig = {
	maxIterations: 100,
	wideningDelay: 3,
	enableIntervalDomain: true,
	enableSignDomain: true,
	enableNullAnalysis: true,
}

/** Constants for infinity representation */
export const POS_INF = Number.POSITIVE_INFINITY
export const NEG_INF = Number.NEGATIVE_INFINITY
