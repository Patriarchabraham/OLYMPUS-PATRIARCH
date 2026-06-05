/**
 * Property-Based Testing — Type definitions.
 *
 * QuickCheck-style: generate random inputs from type-aware arbitraries,
 * shrink counterexamples to minimal failing cases, and infer properties
 * from function signatures automatically.
 */

/** A generated value with its seed for reproducibility */
export interface Generated<T> {
	/** The generated value */
	value: T
	/** The seed that produced this value */
	seed: number
	/** The complexity/size of this generated value */
	complexity: number
}

/** An arbitrary knows how to generate and shrink values of type T */
export interface Arbitrary<T> {
	/** Generate a random value given a seed and size */
	generate(seed: number, size: number): Generated<T>
	/** Shrink a value toward simpler candidates */
	shrink(value: T): T[]
	/** Human-readable name for this arbitrary */
	name: string
}

/** A property is a statement that should hold for all inputs */
export interface Property<T> {
	/** Human-readable name */
	name: string
	/** The arbitrary that generates test inputs */
	arbitrary: Arbitrary<T>
	/** The predicate that should return true for all inputs */
	predicate: (value: T) => boolean | void
}

/** Result of running a property */
export interface PropertyResult {
	/** The property that was tested */
	property: string
	/** Whether all tests passed */
	passed: boolean
	/** Number of tests run */
	testsRun: number
	/** The failing input (if any) */
	counterexample?: unknown
	/** The minimal counterexample after shrinking */
	minimalCounterexample?: unknown
	/** The error message (if predicate threw) */
	error?: string
	/** Execution time in ms */
	durationMs: number
	/** Seed for reproducibility */
	seed: number
}

/** An inferred property from code analysis */
export interface InferredProperty {
	/** Name of the inferred property */
	name: string
	/** Type of property */
	kind: 'commutative' | 'associative' | 'idempotent' | 'identity' | 'bounds' | 'pure' | 'invertible'
	/** Confidence that this property holds (0-1) */
	confidence: number
	/** Description of the property */
	description: string
	/** The generated property (ready to test) */
	property: Property<unknown>
}

/** Configuration for the property runner */
export interface PBTRunnerConfig {
	/** Number of random tests to run per property */
	numTests: number
	/** Maximum size/complexity of generated values */
	maxSize: number
	/** Initial seed (0 = random) */
	seed: number
	/** Whether to shrink counterexamples */
	enableShrinking: boolean
	/** Maximum shrink iterations */
	maxShrinkIterations: number
	/** Verbose output */
	verbose: boolean
}

/** Default configuration */
export const DEFAULT_PBT_CONFIG: PBTRunnerConfig = {
	numTests: 1000,
	maxSize: 100,
	seed: 0,
	enableShrinking: true,
	maxShrinkIterations: 500,
	verbose: false,
}

/** Summary of a PBT run across all properties */
export interface PBTRunSummary {
	/** Total properties tested */
	totalProperties: number
	/** Properties that passed */
	passed: number
	/** Properties that failed */
	failed: number
	/** Individual results */
	results: PropertyResult[]
	/** Total tests run */
	totalTestsRun: number
	/** Total duration in ms */
	durationMs: number
}
