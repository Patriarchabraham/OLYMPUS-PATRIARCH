/**
 * Aider Polyglot benchmark adapter for Olympuz Coder.
 *
 * Tests code editing capability across 6 languages (C++, Go, Java,
 * JavaScript, Python, Rust) using curated Exercism exercises.
 */

import { loadJSONL } from '../../core/agent'
import { computeAggregateGeneric, groupByGeneric } from '../../core/scorer'
import type {
	AggregateMetrics,
	BenchmarkAdapter,
	BenchmarkResult,
	BenchmarkRunConfig,
	BenchmarkScore,
	BenchmarkTask,
	BreakdownGroup,
	CompetitorScore,
} from '../../core/types'
import { scorePolyglotTask } from './scorer'

/** A single Aider Polyglot exercise task. */
export interface AiderPolyglotTask extends BenchmarkTask {
	/** Unique task identifier (e.g., "python/hello-world"). */
	readonly id: string
	/** Programming language: python, javascript, typescript, rust, go, cpp. */
	readonly language: string
	/** Exercism exercise name. */
	readonly exercise_name: string
	/** Natural-language instructions for the exercise. */
	readonly instructions: string
	/** Starting source code to be modified. */
	readonly source_file: string
	/** Test code to validate the solution. */
	readonly test_file: string
	/** Command to run tests (e.g., "python3 -m pytest test.py"). */
	readonly test_command: string
	/** Difficulty level. */
	readonly difficulty?: string
}

/** Aider Polyglot benchmark adapter. */
export const aiderPolyglotAdapter: BenchmarkAdapter<AiderPolyglotTask> = {
	name: 'Aider Polyglot',
	version: '1.0.0',
	key: 'aider-polyglot',
	datasets: {
		default:
			'https://huggingface.co/datasets/aider-ai/polyglot-benchmark/resolve/main/polyglot-benchmark.jsonl',
	},

	async loadTasks(source: string): Promise<AiderPolyglotTask[]> {
		try {
			const tasks = await loadJSONL<AiderPolyglotTask>(source)
			return tasks
		} catch {
			return []
		}
	},

	filterTasks(tasks: AiderPolyglotTask[], config: BenchmarkRunConfig): AiderPolyglotTask[] {
		let filtered = tasks

		if (config.language_filter.length > 0) {
			const langSet = new Set(config.language_filter)
			filtered = filtered.filter((t) => langSet.has(t.language))
		}

		if (config.difficulty_filter.length > 0) {
			const diffSet = new Set(config.difficulty_filter)
			filtered = filtered.filter((t) => t.difficulty !== undefined && diffSet.has(t.difficulty))
		}

		if (config.repo_filter.length > 0) {
			// repo_filter maps to exercise_name for this suite
			const nameSet = new Set(config.repo_filter)
			filtered = filtered.filter((t) => nameSet.has(t.exercise_name))
		}

		if (config.max_tasks > 0) {
			filtered = filtered.slice(0, config.max_tasks)
		}

		return filtered
	},

	buildPrompt(task: AiderPolyglotTask): string {
		return [
			`Modify the following ${task.language} file according to the instructions.`,
			'',
			'## Instructions',
			task.instructions,
			'',
			'## Current Code',
			`\`\`\`${task.language}`,
			task.source_file,
			'```',
			'',
			'Output the complete modified file. Do not include any explanation, only the code.',
		].join('\n')
	},

	async scoreTask(
		task: AiderPolyglotTask,
		result: BenchmarkResult,
		useDocker: boolean,
	): Promise<BenchmarkScore> {
		if (!result.success || result.output.trim().length === 0) {
			return {
				task_id: task.id,
				resolved: false,
				score: 0,
				duration_s: result.duration_ms / 1000,
				details: { language: task.language, error: result.error ?? 'No output' },
			}
		}

		return scorePolyglotTask(task, result.output, useDocker, task.language)
	},

	computeAggregate(
		scores: readonly BenchmarkScore[],
		results: readonly BenchmarkResult[],
	): AggregateMetrics {
		return computeAggregateGeneric(scores, results)
	},

	computeBreakdowns(
		tasks: readonly AiderPolyglotTask[],
		scores: readonly BenchmarkScore[],
	): BreakdownGroup[] {
		return groupByGeneric(tasks, scores, (t) => t.language)
	},

	getCompetitorScores(): CompetitorScore[] {
		return [
			{
				tool: 'Aider + GPT-5',
				model: 'GPT-5',
				score: 0.88,
				source: 'Community reported',
				date: '2026',
			},
			{
				tool: 'Aider + Claude 3.7 Sonnet',
				model: 'Claude 3.7 Sonnet',
				score: 0.842,
				source: 'Anthropic',
				date: '2025',
			},
			{
				tool: 'Aider + Gemini 2.5 Pro',
				model: 'Gemini 2.5 Pro',
				score: 0.783,
				source: 'Google',
				date: '2025',
			},
			{
				tool: 'Aider + DeepSeek-V3',
				model: 'DeepSeek-V3',
				score: 0.76,
				source: 'DeepSeek',
				date: '2025',
			},
			{ tool: 'Aider + GPT-4o', model: 'GPT-4o', score: 0.725, source: 'OpenAI', date: '2025' },
		]
	},
}
