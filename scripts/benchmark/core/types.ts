/**
 * Generic benchmark type definitions for the unified Olympuz Coder benchmark suite.
 *
 * Each benchmark adapter implements the BenchmarkAdapter interface,
 * enabling a single runner to orchestrate SWE-bench, HumanEval, LiveCodeBench, etc.
 */

// ─── Generic Task ──────────────────────────────────────────────────

/** Base task interface that all benchmark tasks extend. */
export interface BenchmarkTask {
	/** Unique task identifier. */
	readonly id: string
	/** Programming language (if applicable). */
	readonly language?: string
	/** Difficulty label (if applicable). */
	readonly difficulty?: string
}

// ─── Agent Interaction ────────────────────────────────────────────

/** Result from invoking the Olympuz agent on a single task. */
export interface BenchmarkResult {
	/** Task identifier this result belongs to. */
	readonly task_id: string
	/** Whether the agent completed without crashing. */
	readonly success: boolean
	/** Raw output text from the agent. */
	readonly output: string
	/** Generated patch/diff (if applicable). */
	readonly patch?: string
	/** Wall-clock time in milliseconds. */
	readonly duration_ms: number
	/** Token usage, if reported. */
	readonly tokens: TokenUsage
	/** Error message on failure. */
	readonly error?: string
}

/** Token usage statistics. */
export interface TokenUsage {
	readonly input_tokens: number
	readonly output_tokens: number
	readonly total_tokens: number
}

// ─── Scoring ──────────────────────────────────────────────────────

/** Per-task scoring result. */
export interface BenchmarkScore {
	/** Task identifier. */
	readonly task_id: string
	/** Whether the task was resolved. */
	readonly resolved: boolean
	/** Normalized score 0–1. */
	readonly score: number
	/** Wall-clock duration in seconds. */
	readonly duration_s: number
	/** Additional scoring details (suite-specific). */
	readonly details: Record<string, unknown>
}

// ─── Aggregation ──────────────────────────────────────────────────

/** Aggregate metrics for a full benchmark run. */
export interface AggregateMetrics {
	readonly total: number
	readonly resolved: number
	readonly pass_at_1: number
	readonly avg_score: number
	readonly total_duration_s: number
	readonly avg_duration_s: number
	readonly total_tokens: TokenUsage
}

/** A grouped result breakdown (by repo, language, difficulty, etc.). */
export interface BreakdownGroup {
	readonly label: string
	readonly count: number
	readonly resolved: number
	readonly pass_at_1: number
	readonly avg_duration_s: number
}

/** A competitor's published score for comparison. */
export interface CompetitorScore {
	readonly tool: string
	readonly model: string
	readonly score: number
	readonly source: string
	readonly date?: string
}

// ─── Run Result ───────────────────────────────────────────────────

/** Full result of a benchmark run, persisted to disk. */
export interface BenchmarkRunResult {
	readonly suite_name: string
	readonly version: string
	readonly timestamp: string
	readonly config: BenchmarkRunConfig
	readonly scores: readonly BenchmarkScore[]
	readonly aggregate: AggregateMetrics
	readonly breakdowns: readonly BreakdownGroup[]
	readonly comparison: readonly CompetitorScore[]
}

// ─── Configuration ────────────────────────────────────────────────

/** Configuration for a benchmark run. */
export interface BenchmarkRunConfig {
	/** Dataset source URL or path. */
	readonly dataset: string
	/** Model to evaluate. */
	readonly model: string
	/** Provider to use. */
	readonly provider: string
	/** Maximum concurrent tasks. */
	readonly concurrency: number
	/** Per-task timeout in milliseconds. */
	readonly task_timeout_ms: number
	/** Maximum number of tasks (0 = all). */
	readonly max_tasks: number
	/** Output directory. */
	readonly output_dir: string
	/** Whether to use Docker for validation. */
	readonly use_docker: boolean
	/** Path to the Olympuz CLI binary. */
	readonly olympuz_binary: string
	/** Filter: repos (empty = all). */
	readonly repo_filter: readonly string[]
	/** Filter: difficulty levels (empty = all). */
	readonly difficulty_filter: readonly string[]
	/** Filter: languages (empty = all). */
	readonly language_filter: readonly string[]
	/**
	 * Number of parallel solution attempts per task (superposition sampling).
	 * 1 = single attempt (default), N = generate N solutions, pick best.
	 * Dramatically improves pass@1 via best-of-N selection.
	 */
	readonly superposition_samples: number
}

// ─── Adapter Interface ────────────────────────────────────────────

/**
 * Adapter interface that each benchmark suite must implement.
 *
 * @typeParam TTask - The specific task type for this benchmark.
 */
export interface BenchmarkAdapter<TTask extends BenchmarkTask> {
	/** Human-readable suite name (e.g., "SWE-bench Verified"). */
	readonly name: string
	/** Version string for the adapter. */
	readonly version: string
	/** Unique key for registry (e.g., "swe-bench-verified"). */
	readonly key: string
	/** Available dataset aliases. */
	readonly datasets: Record<string, string>

	/** Load tasks from a dataset source (URL or file path). */
	loadTasks(source: string): Promise<TTask[]>

	/** Filter tasks based on config criteria. */
	filterTasks(tasks: TTask[], config: BenchmarkRunConfig): TTask[]

	/** Build the prompt for the Olympuz agent. */
	buildPrompt(task: TTask): string

	/** Score a single task result. */
	scoreTask(task: TTask, result: BenchmarkResult, useDocker: boolean): Promise<BenchmarkScore>

	/** Compute aggregate metrics from all scores. */
	computeAggregate(
		scores: readonly BenchmarkScore[],
		results: readonly BenchmarkResult[],
	): AggregateMetrics

	/** Compute breakdown groups (by repo, language, etc.). */
	computeBreakdowns(tasks: readonly TTask[], scores: readonly BenchmarkScore[]): BreakdownGroup[]

	/** Get competitor scores for the comparison table. */
	getCompetitorScores(): CompetitorScore[]
}

/** Suite registration entry. */
export interface SuiteDefinition {
	readonly key: string
	readonly adapter: BenchmarkAdapter<BenchmarkTask>
	readonly defaultDataset: string
}
