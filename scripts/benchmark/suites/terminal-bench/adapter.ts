/**
 * Terminal-Bench 2.0 adapter for the Olympuz Coder benchmark suite.
 *
 * Terminal-Bench is the only benchmark specifically designed for CLI coding agents.
 * It tests software engineering, system administration, and data processing tasks
 * in terminal environments using setup and validation scripts.
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
import { scoreTerminalTask } from './scorer'

// ─── Task Type ──────────────────────────────────────────────────────

/** A single Terminal-Bench task. */
export interface TerminalBenchTask {
	/** Unique task identifier. */
	readonly id: string
	/** Natural-language task description. */
	readonly task_description: string
	/** Bash script that sets up the environment before evaluation. */
	readonly setup_script: string
	/** Bash script that validates whether the task was completed correctly. */
	readonly validation_script: string
	/** Optional hints for the agent. */
	readonly hints?: string
	/** Task category: "software_engineering", "system_admin", or "data_processing". */
	readonly category: string
	/** Programming language hint (if applicable). */
	readonly language?: string
	/** Difficulty label. */
	readonly difficulty?: string
}

// ─── Raw Data Shape ─────────────────────────────────────────────────

/** Expected shape of a raw task from the JSON dataset. */
interface RawTerminalBenchTask {
	readonly task_id?: string
	readonly id?: string
	readonly task_description: string
	readonly setup_script: string
	readonly validation_script: string
	readonly hints?: string
	readonly category?: string
	readonly language?: string
	readonly difficulty?: string
}

// ─── Adapter ────────────────────────────────────────────────────────

/** Terminal-Bench 2.0 benchmark adapter. */
export const terminalBenchAdapter: BenchmarkAdapter<TerminalBenchTask> = {
	name: 'Terminal-Bench 2.0',
	version: '1.0.0',
	key: 'terminal-bench',
	datasets: {
		default: 'https://raw.githubusercontent.com/laudeering/terminal-bench/main/tasks/tasks.json',
	},

	async loadTasks(source: string): Promise<TerminalBenchTask[]> {
		/** Attempt JSON parse — Terminal-Bench may ship as a JSON array or JSONL. */
		let raw: string
		if (source.startsWith('http://') || source.startsWith('https://')) {
			const resp = await fetch(source)
			if (!resp.ok) {
				throw new Error(`Failed to fetch Terminal-Bench dataset: ${resp.status} ${resp.statusText}`)
			}
			raw = await resp.text()
		} else {
			const { readFile } = await import('node:fs/promises')
			raw = await readFile(source, 'utf-8')
		}

		const trimmed = raw.trim()

		// Try parsing as JSON array first
		try {
			const parsed = JSON.parse(trimmed) as RawTerminalBenchTask[]
			if (Array.isArray(parsed)) {
				return parsed.map(normalizeTask).filter((t): t is TerminalBenchTask => t !== null)
			}
		} catch {
			// Not JSON array — try JSONL
		}

		// Fallback: JSONL
		return loadJSONL<RawTerminalBenchTask>(source).then((items) =>
			items.map(normalizeTask).filter((t): t is TerminalBenchTask => t !== null),
		)
	},

	filterTasks(tasks: TerminalBenchTask[], config: BenchmarkRunConfig): TerminalBenchTask[] {
		let filtered = tasks

		if (config.repo_filter.length > 0) {
			const catSet = new Set(config.repo_filter)
			filtered = filtered.filter((t) => catSet.has(t.category))
		}

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

	buildPrompt(task: TerminalBenchTask): string {
		const parts = [
			'Complete the following task in the terminal environment.',
			'',
			'## Task',
			task.task_description,
			'',
		]

		if (task.hints && task.hints.length > 0) {
			parts.push('## Hints', task.hints, '')
		}

		parts.push(
			'Provide the exact commands and/or code to complete this task.',
			'Output only the solution — no explanations.',
		)

		return parts.join('\n')
	},

	async scoreTask(
		task: TerminalBenchTask,
		result: BenchmarkResult,
		useDocker: boolean,
	): Promise<BenchmarkScore> {
		if (!result.success || result.output.trim().length === 0) {
			return {
				task_id: task.id,
				resolved: false,
				score: 0,
				duration_s: result.duration_ms / 1000,
				details: { error: result.error ?? 'Agent produced no output' },
			}
		}

		return scoreTerminalTask(task, result.output, useDocker)
	},

	computeAggregate(
		scores: readonly BenchmarkScore[],
		results: readonly BenchmarkResult[],
	): AggregateMetrics {
		return computeAggregateGeneric(scores, results)
	},

	computeBreakdowns(
		tasks: readonly TerminalBenchTask[],
		scores: readonly BenchmarkScore[],
	): BreakdownGroup[] {
		return groupByGeneric(tasks, scores, (t) => t.category)
	},

	getCompetitorScores(): CompetitorScore[] {
		return [
			{
				tool: 'Claude Code',
				model: 'Opus 4.5',
				score: 0.72,
				source: 'Terminal-Bench 2.0',
				date: '2026',
			},
			{
				tool: 'GPT-5 Codex',
				model: 'GPT-5',
				score: 0.65,
				source: 'Terminal-Bench 2.0',
				date: '2026',
			},
			{
				tool: 'Devin 2.0',
				model: 'Cognition proprietary',
				score: 0.58,
				source: 'Terminal-Bench 2.0',
				date: '2026',
			},
			{
				tool: 'Cursor',
				model: 'Claude Opus 4.6',
				score: 0.45,
				source: '3rd party',
				date: '2026',
			},
		]
	},
}

// ─── Helpers ────────────────────────────────────────────────────────

/**
 * Normalize a raw task from the dataset into a TerminalBenchTask.
 * Returns null if required fields are missing.
 */
function normalizeTask(raw: RawTerminalBenchTask): TerminalBenchTask | null {
	const id = raw.task_id ?? raw.id
	if (!id || !raw.task_description || !raw.validation_script) {
		return null
	}

	return {
		id,
		task_description: raw.task_description,
		setup_script: raw.setup_script ?? '',
		validation_script: raw.validation_script,
		hints: raw.hints,
		category: raw.category ?? 'software_engineering',
		language: raw.language,
		difficulty: raw.difficulty,
	}
}
