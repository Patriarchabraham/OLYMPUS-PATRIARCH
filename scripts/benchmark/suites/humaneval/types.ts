/**
 * HumanEval benchmark task type definitions.
 */

import type { BenchmarkTask } from '../../core/types.js'

/** A single HumanEval evaluation instance. */
export interface HumanEvalTask extends BenchmarkTask {
	/** Unique identifier, e.g. "HumanEval/0". */
	readonly task_id: string
	/** Function signature with docstring — the completion prompt. */
	readonly prompt: string
	/** Assert-based test code. */
	readonly test: string
	/** Name of the function to be completed. */
	readonly entry_point: string
	/** Reference solution. */
	readonly canonical_solution: string
}
