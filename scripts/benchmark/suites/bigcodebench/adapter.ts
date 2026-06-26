/**
 * BigCodeBench adapter for the unified benchmark suite.
 *
 * Tests practical programming with diverse function calls and complex instructions.
 * Dataset: https://github.com/bigcode-project/bigcodebench
 */

import { loadJSONL } from '../../core/agent'
import { computeAggregateGeneric, groupByGeneric } from '../../core/scorer'
import type {
	AggregateMetrics,
	BenchmarkAdapter,
	BenchmarkResult,
	BenchmarkRunConfig,
	BenchmarkScore,
	BreakdownGroup,
	CompetitorScore,
} from '../../core/types'
import { scoreBigCodeBench } from './scorer'

// ─── Task Type ──────────────────────────────────────────────────────

/** A single BigCodeBench evaluation instance. */
export interface BigCodeBenchTask {
	/** Unique task identifier (e.g., "BigCodeBench/0"). Alias for BenchmarkTask.id. */
	readonly id: string
	/** Same as id — kept for compatibility with raw dataset. */
	readonly task_id: string
	/** Incomplete function signature with docstring — the prompt to complete. */
	readonly prompt: string
	/** Pytest-based test code for validation. */
	readonly test: string
	/** Function name to implement. */
	readonly entry_point: string
	/** Reference solution. */
	readonly canonical_solution: string
	/** Required import statements. */
	readonly imports?: string
	/** Natural-language description. */
	readonly docstring?: string
	/** Difficulty level (inferred from complexity). */
	readonly difficulty?: string
	/** Programming language (always "python" for BigCodeBench). */
	readonly language: string
}

// ─── Adapter Implementation ─────────────────────────────────────────

/** Normalize a raw JSONL record into a BigCodeBenchTask. */
function normalizeTask(raw: Record<string, unknown>): BigCodeBenchTask {
	const taskId = String(raw.task_id ?? raw.id ?? '')
	return {
		id: taskId,
		task_id: taskId,
		prompt: String(raw.prompt ?? ''),
		test: String(raw.test ?? ''),
		entry_point: String(raw.entry_point ?? ''),
		canonical_solution: String(raw.canonical_solution ?? ''),
		imports: raw.imports != null ? String(raw.imports) : undefined,
		docstring: raw.docstring != null ? String(raw.docstring) : undefined,
		difficulty: raw.difficulty != null ? String(raw.difficulty) : undefined,
		language: 'python',
	}
}

/** BigCodeBench adapter implementing BenchmarkAdapter<BigCodeBenchTask>. */
export const bigCodeBenchAdapter: BenchmarkAdapter<BigCodeBenchTask> = {
	name: 'BigCodeBench',
	version: '1.0.0',
	key: 'bigcodebench',
	datasets: {
		default:
			'https://huggingface.co/datasets/bigcode/bigcodebench/resolve/main/data/bigcodebench.jsonl',
		full: 'https://huggingface.co/datasets/bigcode/bigcodebench/resolve/main/data/bigcodebench.jsonl',
		hard: 'https://huggingface.co/datasets/bigcode/bigcodebench/resolve/main/data/bigcodebench-hard.jsonl',
	},

	async loadTasks(source: string): Promise<BigCodeBenchTask[]> {
		const raw = await loadJSONL<Record<string, unknown>>(source)
		return raw.map(normalizeTask)
	},

	filterTasks(tasks: BigCodeBenchTask[], config: BenchmarkRunConfig): BigCodeBenchTask[] {
		let filtered = tasks

		if (config.difficulty_filter.length > 0) {
			const diffSet = new Set(config.difficulty_filter)
			filtered = filtered.filter((t) => t.difficulty && diffSet.has(t.difficulty))
		}

		if (config.language_filter.length > 0) {
			const langSet = new Set(config.language_filter)
			filtered = filtered.filter((t) => t.language && langSet.has(t.language))
		}

		if (config.max_tasks > 0) {
			filtered = filtered.slice(0, config.max_tasks)
		}

		return filtered
	},

	buildPrompt(task: BigCodeBenchTask): string {
		return [
			'Complete the following Python function that uses various library calls.',
			'',
			'```python',
			task.imports ? `${task.imports}\n\n` : '',
			task.prompt,
			'```',
			'',
			'Output ONLY the function body — no signature, no imports, no explanation.',
			task.docstring ? `\nContext: ${task.docstring}` : '',
		].join('\n')
	},

	async scoreTask(
		task: BigCodeBenchTask,
		result: BenchmarkResult,
		useDocker: boolean,
	): Promise<BenchmarkScore> {
		return scoreBigCodeBench(task, result, useDocker)
	},

	computeAggregate(
		scores: readonly BenchmarkScore[],
		results: readonly BenchmarkResult[],
	): AggregateMetrics {
		return computeAggregateGeneric(scores, results)
	},

	computeBreakdowns(
		tasks: readonly BigCodeBenchTask[],
		scores: readonly BenchmarkScore[],
	): BreakdownGroup[] {
		const byDifficulty = groupByGeneric(tasks, scores, (t) => t.difficulty ?? 'unknown')
		return byDifficulty
	},

	getCompetitorScores(): CompetitorScore[] {
		return [
			{ tool: 'GPT-4o', model: 'gpt-4o', score: 0.32, source: 'ICLR 2025', date: '2025' },
			{
				tool: 'Claude 3.5 Sonnet',
				model: 'claude-3.5-sonnet',
				score: 0.285,
				source: 'Anthropic',
				date: '2024',
			},
			{
				tool: 'Gemini 2.5 Pro',
				model: 'gemini-2.5-pro',
				score: 0.302,
				source: 'Google',
				date: '2025',
			},
			{ tool: 'DeepSeek-V2', model: 'deepseek-v2', score: 0.22, source: 'ICLR 2025', date: '2025' },
			{
				tool: 'Llama 3.1 405B',
				model: 'llama-3.1-405b',
				score: 0.18,
				source: 'Meta',
				date: '2024',
			},
		]
	},
}
