/**
 * Mutation Testing — Type definitions.
 *
 * Generate code mutants (operator flips, boundary changes, statement deletion)
 * and verify test suites catch them. Measures mutation score = killed / total.
 */

/** Types of mutations that can be applied */
export type MutantOperator =
	| 'flip_arithmetic'    // + → -, * → /, etc
	| 'flip_comparison'    // === → !==, > → <, etc
	| 'flip_logical'       // && → ||, !x → x
	| 'flip_boolean'       // true → false, false → true
	| 'negate_condition'   // if (x) → if (!x)
	| 'remove_statement'   // delete a line
	| 'change_return'      // return x → return undefined/0/''
	| 'boundary_change'    // > → >=, < → <=
	| 'string_change'      // 'foo' → ''
	| 'number_change'      // 0 → 1, 1 → 0, any → MAX_VALUE

/** Status of a mutant after being tested */
export type MutantStatus = 'killed' | 'survived' | 'timeout' | 'error' | 'equivalent'

/** A single mutant */
export interface Mutant {
	/** Unique ID */
	id: string
	/** The operator that created this mutant */
	operator: MutantOperator
	/** Original line number */
	lineNumber: number
	/** Original code fragment */
	originalCode: string
	/** Mutated code fragment */
	mutatedCode: string
	/** The full mutated source code */
	mutatedSource: string
	/** Status after testing */
	status: MutantStatus
	/** Which test killed it (if killed) */
	killedBy?: string
	/** Time to run tests against this mutant (ms) */
	durationMs: number
}

/** Mutation score report */
export interface MutationScore {
	/** Total mutants generated */
	total: number
	/** Mutants killed by tests */
	killed: number
	/** Mutants that survived (test gap!) */
	survived: number
	/** Mutants that timed out */
	timedOut: number
	/** Mutants that caused errors */
	errors: number
	/** Equivalent mutants (same behavior as original) */
	equivalent: number
	/** Mutation score: killed / (total - equivalent) */
	score: number
	/** Per-operator breakdown */
	byOperator: Record<MutantOperator, { total: number; killed: number }>
}

/** Configuration */
export interface MutationConfig {
	/** Which operators to use */
	operators: MutantOperator[]
	/** Maximum mutants to generate */
	maxMutants: number
	/** Timeout per mutant test run (ms) */
	timeoutMs: number
	/** Whether to detect equivalent mutants */
	detectEquivalents: boolean
	/** File patterns to exclude */
	excludePatterns: string[]
}

/** Default configuration */
export const DEFAULT_MUTATION_CONFIG: MutationConfig = {
	operators: [
		'flip_arithmetic',
		'flip_comparison',
		'flip_logical',
		'flip_boolean',
		'negate_condition',
		'remove_statement',
		'change_return',
		'boundary_change',
	],
	maxMutants: 100,
	timeoutMs: 5000,
	detectEquivalents: true,
	excludePatterns: ['*.test.ts', '*.spec.ts', '__tests__/**'],
}

/** Mutation report */
export interface MutationReport {
	/** Source file analyzed */
	filePath: string
	/** Score summary */
	score: MutationScore
	/** All mutants */
	mutants: Mutant[]
	/** Duration in ms */
	durationMs: number
	/** Suggestions for improving test coverage */
	suggestions: string[]
}
