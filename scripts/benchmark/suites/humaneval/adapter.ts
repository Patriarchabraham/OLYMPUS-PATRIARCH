/**
 * HumanEval benchmark adapter for Olympuz Coder.
 *
 * Implements BenchmarkAdapter for OpenAI's HumanEval code completion benchmark.
 * 164 hand-crafted Python problems measuring functional correctness via pass@1.
 */

import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { unzipSync } from 'node:zlib'
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
import { scoreHumanEval } from './scorer'
import type { HumanEvalTask } from './types'

const _execAsync = promisify(execFile)

/**
 * Fetch and decompress the HumanEval JSONL dataset.
 *
 * Handles gzipped files from GitHub by decompressing with zlib.
 */
async function loadHumanEvalDataset(source: string): Promise<HumanEvalTask[]> {
	const response = await fetch(source)
	if (!response.ok) {
		throw new Error(`Failed to fetch HumanEval dataset: ${response.status} ${response.statusText}`)
	}

	const buffer = Buffer.from(await response.arrayBuffer())
	let text: string

	// Decompress gzip if needed
	if (source.endsWith('.gz')) {
		const decompressed = unzipSync(buffer)
		text = decompressed.toString('utf-8')
	} else {
		text = buffer.toString('utf-8')
	}

	const rawTasks: Array<Record<string, unknown>> = []
	for (const line of text.split('\n')) {
		const trimmed = line.trim()
		if (trimmed.length === 0) continue
		try {
			rawTasks.push(JSON.parse(trimmed) as Record<string, unknown>)
		} catch {
			// Skip malformed lines
		}
	}

	// Map to HumanEvalTask with required `id` field
	return rawTasks.map((raw) => ({
		id: raw.task_id as string,
		task_id: raw.task_id as string,
		prompt: raw.prompt as string,
		test: raw.test as string,
		entry_point: raw.entry_point as string,
		canonical_solution: raw.canonical_solution as string,
		language: 'python',
		difficulty: inferDifficulty(raw.task_id as string),
	}))
}

/** Infer difficulty from task ID range. */
function inferDifficulty(taskId: string): string {
	const num = Number.parseInt(taskId.replace('HumanEval/', ''), 10)
	if (num <= 40) return 'easy'
	if (num <= 100) return 'medium'
	return 'hard'
}

/**
 * Extract the code completion from agent output.
 *
 * HumanEval expects the function body only (no signature).
 * The prompt already contains the function signature with docstring.
 * We need to extract just the body lines and re-indent them with 4 spaces.
 */
function extractCompletion(output: string): string {
	// Try to extract code block from markdown
	const codeBlockMatch = output.match(/```(?:python)?\s*\n([\s\S]*?)```/)
	let code: string
	if (codeBlockMatch) {
		// Strip leading/trailing newlines only — preserve indentation.
		// Using trim() would strip leading spaces from the first line.
		code = codeBlockMatch[1]!.replace(/^\n+/, '').replace(/\n+$/, '')
	} else {
		// Fallback: use entire output
		const lines = output.split('\n').filter((l) => l.trim().length > 0)
		code = lines.join('\n')
	}

	// Strip any function signature lines the model might have included
	const lines = code.split('\n')
	const bodyLines = lines.filter(
		(line) => !line.startsWith('def ') && !line.startsWith('from ') && !line.startsWith('import '),
	)

	// If all lines were filtered, use original
	if (bodyLines.length === 0) {
		return code
	}

	// Check if lines already have consistent indentation (>= 4 spaces)
	const minIndent = bodyLines.reduce((min, line) => {
		if (line.trim().length === 0) return min
		const spaces = line.match(/^(\s*)/)?.[1]?.length ?? 0
		return Math.min(min, spaces)
	}, Infinity)

	// If already indented (part of a function body), use as-is
	if (minIndent >= 4) {
		return bodyLines.join('\n')
	}

	// Re-indent: add 4 spaces to each line, preserving relative indentation.
	// Do NOT use trimStart() — it destroys the nesting structure.
	return bodyLines.map((line) => (line.trim().length === 0 ? '' : `    ${line}`)).join('\n')
}

/**
 * HumanEval benchmark adapter.
 */
export const humanevalAdapter: BenchmarkAdapter<HumanEvalTask> = {
	name: 'HumanEval',
	version: '1.0.0',
	key: 'humaneval',
	datasets: {
		humaneval: 'https://raw.githubusercontent.com/openai/human-eval/master/data/HumanEval.jsonl.gz',
	},

	async loadTasks(source: string): Promise<HumanEvalTask[]> {
		return loadHumanEvalDataset(source)
	},

	filterTasks(tasks: HumanEvalTask[], config: BenchmarkRunConfig): HumanEvalTask[] {
		let filtered = tasks

		if (config.language_filter.length > 0) {
			const langSet = new Set(config.language_filter)
			filtered = filtered.filter((t) => t.language && langSet.has(t.language))
		}

		if (config.difficulty_filter.length > 0) {
			const diffSet = new Set(config.difficulty_filter)
			filtered = filtered.filter((t) => t.difficulty && diffSet.has(t.difficulty))
		}

		if (config.max_tasks > 0) {
			filtered = filtered.slice(0, config.max_tasks)
		}

		return filtered
	},

	buildPrompt(task: HumanEvalTask): string {
		return [
			'Complete the following Python function.',
			'Output ONLY the function body, not the signature or any explanation.',
			'',
			'```python',
			task.prompt,
			'```',
		].join('\n')
	},

	async scoreTask(
		task: HumanEvalTask,
		result: BenchmarkResult,
		_useDocker: boolean,
	): Promise<BenchmarkScore> {
		if (!result.success) {
			return {
				task_id: task.id,
				resolved: false,
				score: 0,
				duration_s: result.duration_ms / 1000,
				details: { error: result.error },
			}
		}

		const completion = extractCompletion(result.output)
		const { passed, error } = await scoreHumanEval(task, completion)

		return {
			task_id: task.id,
			resolved: passed,
			score: passed ? 1 : 0,
			duration_s: result.duration_ms / 1000,
			details: { error: error ?? undefined },
		}
	},

	computeAggregate(
		scores: readonly BenchmarkScore[],
		results: readonly BenchmarkResult[],
	): AggregateMetrics {
		return computeAggregateGeneric(scores, results)
	},

	computeBreakdowns(
		tasks: readonly HumanEvalTask[],
		scores: readonly BenchmarkScore[],
	): BreakdownGroup[] {
		const byDifficulty = groupByGeneric(tasks, scores, (t) => t.difficulty ?? 'unknown')
		return byDifficulty
	},

	getCompetitorScores(): CompetitorScore[] {
		return [
			{ tool: 'GPT-4', model: 'gpt-4', score: 0.67, source: 'OpenAI', date: '2023' },
			{
				tool: 'Claude 3.5 Sonnet',
				model: 'claude-3.5-sonnet',
				score: 0.92,
				source: 'Anthropic',
				date: '2024',
			},
			{ tool: 'GPT-4o', model: 'gpt-4o', score: 0.902, source: 'OpenAI', date: '2024' },
			{ tool: 'DeepSeek-V3', model: 'deepseek-v3', score: 0.892, source: 'DeepSeek', date: '2024' },
			{
				tool: 'Gemini 2.5 Pro',
				model: 'gemini-2.5-pro',
				score: 0.915,
				source: 'Google',
				date: '2025',
			},
		]
	},
} satisfies BenchmarkAdapter<HumanEvalTask>
