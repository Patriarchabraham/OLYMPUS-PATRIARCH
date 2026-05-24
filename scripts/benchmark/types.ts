/**
 * SWE-bench evaluation type definitions for Mythos Patriarch.
 *
 * Covers the full SWE-bench task format, evaluation results,
 * scoring breakdowns, and benchmark configuration.
 */

// ─── SWE-bench Task Format ──────────────────────────────────────────

/** A single SWE-bench evaluation instance. */
export interface SWEBenchTask {
	/** Unique identifier, e.g. "django__django-12345". */
	readonly instance_id: string;
	/** Repository full name, e.g. "django/django". */
	readonly repo: string;
	/** Version string of the target project. */
	readonly version: string;
	/** Base commit hash the task is anchored on. */
	readonly base_commit: string;
	/** Natural-language problem statement (issue body). */
	readonly problem_statement: string;
	/** Optional hints extracted from the issue thread. */
	readonly hints_text: string;
	/** Gold test patch (diff) to apply for validation. */
	readonly test_patch: string;
	/** Gold patch (diff) that resolves the issue. */
	readonly patch: string;
	/** Test names that must PASS after applying the patch. */
	readonly PASS_TO_PASS: readonly string[];
	/** Test names that must FAIL before and PASS after the patch. */
	readonly FAIL_TO_PASS: readonly string[];
	/** Created-at timestamp of the original issue. */
	readonly created_at: string;
	/** Difficulty label (if available). */
	readonly difficulty?: string;
	/** Language hint (if available). */
	readonly language?: string;
}

// ─── Agent Interaction ──────────────────────────────────────────────

/** Result from invoking the Mythos agent on a single task. */
export interface AgentResult {
	/** The instance_id this result belongs to. */
	readonly instance_id: string;
	/** Generated patch text (unified diff). Empty on failure. */
	readonly patch: string;
	/** Model identifier used. */
	readonly model: string;
	/** Provider used. */
	readonly provider: string;
	/** Total wall-clock time in milliseconds. */
	readonly duration_ms: number;
	/** Token usage, if reported. */
	readonly tokens: TokenUsage;
	/** Whether the agent completed without crashing. */
	readonly success: boolean;
	/** Error message on failure. */
	readonly error?: string;
}

/** Token usage statistics. */
export interface TokenUsage {
	readonly input_tokens: number;
	readonly output_tokens: number;
	readonly total_tokens: number;
}

// ─── Scoring ────────────────────────────────────────────────────────

/** Per-task scoring breakdown. */
export interface TaskScore {
	readonly instance_id: string;
	/** Whether the generated patch resolved the issue (tests pass). */
	readonly resolved: boolean;
	/** Fraction of FAIL_TO_PASS tests that now pass. */
	readonly fail_to_pass_rate: number;
	/** Fraction of PASS_TO_PASS tests that still pass. */
	readonly pass_to_pass_rate: number;
	/** Similarity of generated patch to gold patch (0-1). */
	readonly patch_similarity: number;
	/** Wall-clock duration in seconds. */
	readonly duration_s: number;
}

/** Aggregate metrics for a full evaluation run. */
export interface AggregateScore {
	/** Total tasks evaluated. */
	readonly total: number;
	/** Tasks resolved (pass@1). */
	readonly resolved: number;
	/** Resolution rate (0-1). */
	readonly pass_at_1: number;
	/** Average FAIL_TO_PASS rate across all tasks. */
	readonly avg_fail_to_pass: number;
	/** Average PASS_TO_PASS rate across all tasks. */
	readonly avg_pass_to_pass: number;
	/** Average patch similarity to gold. */
	readonly avg_patch_similarity: number;
	/** Total wall-clock time in seconds. */
	readonly total_duration_s: number;
	/** Average wall-clock time per task in seconds. */
	readonly avg_duration_s: number;
	/** Token usage totals. */
	readonly total_tokens: TokenUsage;
}

/** Grouped results for report breakdowns. */
export interface GroupedResults {
	readonly label: string;
	readonly count: number;
	readonly resolved: number;
	readonly pass_at_1: number;
	readonly avg_duration_s: number;
}

// ─── Configuration ──────────────────────────────────────────────────

/** Benchmark run configuration. */
export interface BenchmarkConfig {
	/** Path or URL to the SWE-bench JSONL dataset. */
	readonly dataset: string;
	/** Model to evaluate (e.g. "claude-opus-4-7", "gpt-4o"). */
	readonly model: string;
	/** Provider to use (e.g. "anthropic", "openai"). */
	readonly provider: string;
	/** Maximum concurrent tasks. */
	readonly concurrency: number;
	/** Per-task timeout in milliseconds. */
	readonly task_timeout_ms: number;
	/** Filter: only evaluate these repos (empty = all). */
	readonly repo_filter: readonly string[];
	/** Filter: only evaluate these difficulty levels (empty = all). */
	readonly difficulty_filter: readonly string[];
	/** Filter: only evaluate these languages (empty = all). */
	readonly language_filter: readonly string[];
	/** Maximum number of tasks to evaluate (0 = all). */
	readonly max_tasks: number;
	/** Output directory for results. */
	readonly output_dir: string;
	/** Whether to run Docker-based test validation. */
	readonly run_docker_tests: boolean;
	/** Path to the Mythos CLI binary. */
	readonly mythos_binary: string;
}

/** Full evaluation result persisted to disk. */
export interface EvaluationResult {
	/** ISO timestamp of the run. */
	readonly timestamp: string;
	/** Configuration used. */
	readonly config: BenchmarkConfig;
	/** Per-task scores. */
	readonly task_scores: readonly TaskScore[];
	/** Aggregate metrics. */
	readonly aggregate: AggregateScore;
	/** Results grouped by repository. */
	readonly by_repo: readonly GroupedResults[];
	/** Results grouped by difficulty. */
	readonly by_difficulty: readonly GroupedResults[];
}
