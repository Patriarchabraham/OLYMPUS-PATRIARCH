/**
 * Fuzzing Engine types — feedback-directed mutation fuzzing
 * for finding crashes and edge cases.
 */

/** Mutation strategy for fuzzing */
export type MutationStrategy =
	| 'bit-flip'
	| 'byte-flip'
	| 'arithmetic'
	| 'insert-byte'
	| 'delete-byte'
	| 'replace-byte'
	| 'splice'
	| 'havoc'

/**
 * Observed-behavior information for a single fuzz run.
 *
 * Named `CoverageInfo` for backward compatibility, but the contents are
 * observed-behavior signatures (see `observeBehaviors` in fuzzer.ts), not
 * code coverage. Each string in `branchesHit` represents a real execution
 * property: return value, exception class+message, duration bucket, input
 * signature, etc. Wire V8 Profiler.startPreciseCoverage if you need true
 * branch coverage — the overhead is too high for the inner fuzzing loop.
 */
export interface CoverageInfo {
	/** Observed behavior signatures for this input */
	branchesHit: Set<string>
	/** Total distinct behaviors observed for this input */
	totalBranches: number
	/** Reserved — empty unless wired to a real line-coverage source */
	linesCovered: Set<number>
	/** Reserved — 0 unless wired to a real coverage source */
	coveragePercent: number
}

/** A single fuzzing test case */
export interface FuzzTestCase {
	/** Unique ID */
	id: number
	/** Input bytes */
	input: Uint8Array
	/** Execution result */
	result: 'pass' | 'crash' | 'timeout' | 'error'
	/** Coverage for this input */
	coverage: CoverageInfo
	/** Execution time in ms */
	durationMs: number
	/** Mutation strategy that produced this input */
	strategy: MutationStrategy
	/** Parent test case ID (null for seed) */
	parentId: number | null
}

/** Crash found during fuzzing */
export interface FuzzCrash {
	/** The crashing input */
	input: Uint8Array
	/** Human-readable representation */
	inputRepr: string
	/** Error message */
	error: string
	/** Line number if available */
	lineNumber: number | null
	/** The test case that found this crash */
	testCaseId: number
	/** Stack trace if available */
	stack: string | null
}

/** Fuzzing statistics */
export interface FuzzStats {
	/** Total test cases generated */
	totalTests: number
	/** Total crashes found */
	crashes: number
	/** Unique crashes (deduplicated by coverage) */
	uniqueCrashes: number
	/** Total branches discovered */
	totalBranches: number
	/** Current coverage percentage */
	coveragePercent: number
	/** Test cases per second */
	testsPerSecond: number
	/** Duration in ms */
	durationMs: number
}

/** Fuzzing configuration */
export interface FuzzConfig {
	/** Maximum test cases to generate (default: 10000) */
	maxTests: number
	/** Maximum input size in bytes (default: 4096) */
	maxInputSize: number
	/** Timeout per test in ms (default: 100) */
	testTimeoutMs: number
	/** Seed corpus (initial inputs) */
	seeds: Uint8Array[]
	/** Mutation strategies to use */
	strategies: MutationStrategy[]
	/** Coverage-guided mode (default: true) */
	coverageGuided: boolean
	/** Minimum corpus entries before starting mutations (default: 1) */
	minCorpusSize: number
}

/** Default fuzzing configuration */
export const DEFAULT_FUZZ_CONFIG: FuzzConfig = {
	maxTests: 10000,
	maxInputSize: 4096,
	testTimeoutMs: 100,
	seeds: [],
	strategies: ['bit-flip', 'byte-flip', 'arithmetic', 'insert-byte', 'delete-byte', 'havoc'],
	coverageGuided: true,
	minCorpusSize: 1,
}

/** Result of a fuzzing session */
export interface FuzzResult {
	/** Whether fuzzing completed normally */
	completed: boolean
	/** Statistics */
	stats: FuzzStats
	/** Crashes found */
	crashes: FuzzCrash[]
	/** Interesting test cases (new coverage) */
	interestingInputs: FuzzTestCase[]
	/** Final corpus */
	corpus: FuzzTestCase[]
}
