/**
 * LiveCodeBench adapter for the unified benchmark framework.
 *
 * LiveCodeBench is a contamination-free benchmark that harvests fresh
 * competitive programming problems from Codeforces, LeetCode, and AtCoder.
 * It prevents training data memorization by only using problems published
 * after model training cutoffs.
 *
 * @see https://livecodebench.github.io/
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
import { extractPythonCode, scoreLiveCodeBench } from './scorer'

// ─── Task Type ──────────────────────────────────────────────────────

/** A single LiveCodeBench problem instance. */
export interface LiveCodeBenchTask {
	/** Unique identifier. */
	readonly id: string
	/** Problem title. */
	readonly question_title: string
	/** Full problem description in markdown. */
	readonly question_content: string
	/** Starter code template (may be multi-language JSON). */
	readonly starter_code: string
	/** Test cases with input/output pairs. */
	readonly test_cases: ReadonlyArray<{ readonly input: string; readonly output: string }>
	/** Difficulty label (easy, medium, hard). */
	readonly difficulty: string
	/** Source platform (codeforces, leetcode, atcoder). */
	readonly platform: string
	/** Programming language hint. */
	readonly language?: string
}

// ─── Raw JSON Shape ─────────────────────────────────────────────────

/** Raw JSON shape from the HuggingFace dataset. */
interface RawLCBItem {
	readonly question_id?: string
	readonly question_title?: string
	readonly question_content?: string
	readonly starter_code?: string
	readonly input_output?: string
	readonly difficulty?: string
	readonly platform?: string
	readonly contest_date?: string
	[key: string]: unknown
}

// ─── Adapter ────────────────────────────────────────────────────────

/** LiveCodeBench adapter implementing the unified BenchmarkAdapter interface. */
export const liveCodeBenchAdapter: BenchmarkAdapter<LiveCodeBenchTask> = {
	name: 'LiveCodeBench',
	version: '1.0.0',
	key: 'livecodebench',
	datasets: {
		default:
			'https://huggingface.co/datasets/livecodebench/livecodebench/resolve/main/data/jsonl/lcb_codegen.jsonl',
	},

	async loadTasks(source: string): Promise<LiveCodeBenchTask[]> {
		const rawItems = await loadJSONL<RawLCBItem>(source)
		return rawItems.map((item, idx) => normalizeTask(item, idx)).filter(isValidTask)
	},

	filterTasks(tasks: LiveCodeBenchTask[], config: BenchmarkRunConfig): LiveCodeBenchTask[] {
		let filtered = tasks

		if (config.difficulty_filter.length > 0) {
			const diffSet = new Set(config.difficulty_filter)
			filtered = filtered.filter((t) => diffSet.has(t.difficulty))
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

	buildPrompt(task: LiveCodeBenchTask): string {
		return [
			'Solve the following programming problem. Output ONLY a complete Python solution.',
			'Do not include any explanation — only the code.',
			'',
			`## Problem: ${task.question_title}`,
			'',
			task.question_content,
			'',
			'## Starter Code',
			task.starter_code || '# No starter code provided',
			'',
			'## Instructions',
			'- Read input from stdin.',
			'- Write output to stdout.',
			'- Your solution must pass all hidden test cases.',
		].join('\n')
	},

	async scoreTask(
		task: LiveCodeBenchTask,
		result: BenchmarkResult,
		_useDocker: boolean,
	): Promise<BenchmarkScore> {
		if (!result.success || result.output.length === 0) {
			return {
				task_id: task.id,
				resolved: false,
				score: 0,
				duration_s: result.duration_ms / 1000,
				details: { error: result.error ?? 'No output' },
			}
		}

		const code = extractPythonCode(result.output)
		if (code.length === 0) {
			return {
				task_id: task.id,
				resolved: false,
				score: 0,
				duration_s: result.duration_ms / 1000,
				details: { error: 'No Python code found in output' },
			}
		}

		const scoreResult = await scoreLiveCodeBench(code, task.test_cases)

		return {
			task_id: task.id,
			resolved: scoreResult.passRate === 1,
			score: scoreResult.passRate,
			duration_s: result.duration_ms / 1000,
			details: {
				passed: scoreResult.passed,
				total: scoreResult.total,
				perCase: scoreResult.details,
			},
		}
	},

	computeAggregate(
		scores: readonly BenchmarkScore[],
		results: readonly BenchmarkResult[],
	): AggregateMetrics {
		return computeAggregateGeneric(scores, results)
	},

	computeBreakdowns(
		tasks: readonly LiveCodeBenchTask[],
		scores: readonly BenchmarkScore[],
	): BreakdownGroup[] {
		const byDifficulty = groupByGeneric(tasks, scores, (t) => t.difficulty)
		const byPlatform = groupByGeneric(tasks, scores, (t) => t.platform)
		return [...byDifficulty, ...byPlatform.map((g) => ({ ...g, label: `Platform: ${g.label}` }))]
	},

	getCompetitorScores(): CompetitorScore[] {
		return [
			{
				tool: 'Gemini',
				model: 'Gemini 3 Pro Preview',
				score: 0.917,
				source: 'Google',
				date: '2026',
			},
			{
				tool: 'Gemini',
				model: 'Gemini 3 Flash Preview',
				score: 0.908,
				source: 'Google',
				date: '2026',
			},
			{ tool: 'Claude', model: 'Opus 4.5', score: 0.853, source: 'Anthropic', date: '2025' },
			{ tool: 'GPT', model: 'GPT-4o', score: 0.732, source: 'OpenAI', date: '2025' },
			{ tool: 'DeepSeek', model: 'DeepSeek-V3', score: 0.685, source: 'DeepSeek', date: '2025' },
		]
	},
}

// ─── Helpers ────────────────────────────────────────────────────────

/** Normalize a raw JSON item into a LiveCodeBenchTask. */
function normalizeTask(item: RawLCBItem, index: number): LiveCodeBenchTask {
	let testCases: ReadonlyArray<{ readonly input: string; readonly output: string }> = []

	// input_output may be a JSON string or already parsed
	if (typeof item.input_output === 'string') {
		try {
			const parsed = JSON.parse(item.input_output) as {
				inputs?: string[]
				outputs?: string[]
			}
			if (parsed.inputs && parsed.outputs) {
				testCases = parsed.inputs.map((inp: string, i: number) => ({
					input: inp,
					output: parsed.outputs![i] ?? '',
				}))
			}
		} catch {
			testCases = []
		}
	}

	return {
		id: item.question_id ?? `lcb-${index}`,
		question_title: item.question_title ?? `Problem ${index}`,
		question_content: item.question_content ?? '',
		starter_code: typeof item.starter_code === 'string' ? item.starter_code : '',
		test_cases: testCases,
		difficulty: item.difficulty ?? 'unknown',
		platform: item.platform ?? 'unknown',
		language: 'python',
	}
}

/** Check if a task has the minimum required fields. */
function isValidTask(task: LiveCodeBenchTask): boolean {
	return task.question_content.length > 0
}
