/**
 * Universal benchmark runner for Olympuz Coder.
 *
 * Orchestrates: load dataset → filter tasks → run agent → score → report.
 *
 * Usage:
 *   bun run scripts/benchmark/core/runner.ts --suite swe-bench-verified --preset claude-opus
 *   bun run scripts/benchmark/core/runner.ts --suite humaneval --model gpt-4o --max-tasks 10
 *   bun run scripts/benchmark/core/runner.ts --list
 */

import { runBatch, runBatchSuperposed } from './agent'
import { buildRunConfig, getSuite, listSuites, resolvePreset } from './config'
import { saveBenchmarkReports } from './report'
// Import config and types first
import type { BenchmarkRunConfig, BenchmarkRunResult } from './types'

// Import all suite registrations (triggers registerSuite() calls)
import '../suites/swe-bench/index.js'
import '../suites/humaneval/index.js'
import '../suites/livecodebench/index.js'
import '../suites/bigcodebench/index.js'
import '../suites/aider-polyglot/index.js'
import '../suites/terminal-bench/index.js'

// ─── CLI Argument Parsing ───────────────────────────────────────────

interface ParsedArgs {
	suite?: string
	model?: string
	provider?: string
	dataset?: string
	preset?: string
	concurrency?: number
	timeout?: number
	maxTasks?: number
	outputDir?: string
	repoFilter?: string[]
	difficultyFilter?: string[]
	languageFilter?: string[]
	docker?: boolean
	olympuzBinary?: string
	superpositionSamples?: number
	list?: boolean
	help?: boolean
}

function parseArgs(): ParsedArgs {
	const args = process.argv.slice(2)
	const parsed: ParsedArgs = {}

	for (let i = 0; i < args.length; i++) {
		const arg = args[i]
		const next = () => args[++i]

		switch (arg) {
			case '--suite':
				parsed.suite = next()
				break
			case '--model':
				parsed.model = next()
				break
			case '--provider':
				parsed.provider = next()
				break
			case '--dataset':
				parsed.dataset = next()
				break
			case '--preset':
				parsed.preset = next()
				break
			case '--concurrency':
				parsed.concurrency = Number(next())
				break
			case '--timeout':
				parsed.timeout = Number(next())
				break
			case '--max-tasks':
				parsed.maxTasks = Number(next())
				break
			case '--output-dir':
				parsed.outputDir = next()
				break
			case '--repo-filter':
				parsed.repoFilter = next()?.split(',')
				break
			case '--difficulty-filter':
				parsed.difficultyFilter = next()?.split(',')
				break
			case '--language-filter':
				parsed.languageFilter = next()?.split(',')
				break
			case '--docker':
				parsed.docker = true
				break
			case '--olympuz-binary':
				parsed.olympuzBinary = next()
				break
			case '--superposition-samples':
				parsed.superpositionSamples = Number(next())
				break
			case '--list':
				parsed.list = true
				break
			case '--help':
				parsed.help = true
				break
		}
	}

	return parsed
}

const _HELP_TEXT = `
Olympuz Coder — Universal Benchmark Runner

Usage: bun run scripts/benchmark/core/runner.ts [options]

Options:
  --suite <name>           Benchmark suite to run (required unless --list)
  --model <model>          Model to evaluate
  --provider <provider>    Provider to use
  --dataset <path|alias>   Dataset source (alias or URL/file)
  --preset <name>          Model preset (claude-opus, gpt4o, gemini-flash, etc.)
  --concurrency <n>        Max concurrent tasks (default: auto-detect)
  --timeout <ms>           Per-task timeout in ms (default: 600000)
  --max-tasks <n>          Limit number of tasks (0 = all)
  --output-dir <path>      Output directory (default: ./benchmark-results)
  --repo-filter <repos>    Comma-separated repo names
  --difficulty-filter <d>  Comma-separated difficulty levels
  --language-filter <l>    Comma-separated languages
  --docker                 Enable Docker-based test validation
  --olympuz-binary <path>  Path to olympuz binary (default: olympuz)
  --superposition-samples <n>  Generate N solutions per task, pick best (default: 1)
  --list                   List available suites
  --help                   Show this help

Examples:
  bun run scripts/benchmark/core/runner.ts --list
  bun run scripts/benchmark/core/runner.ts --suite swe-bench-verified --preset claude-opus --max-tasks 50
  bun run scripts/benchmark/core/runner.ts --suite humaneval --model gpt-4o --max-tasks 10
  bun run scripts/benchmark/core/runner.ts --suite aider-polyglot --preset claude-sonnet --docker
`

// ─── Main ────────────────────────────────────────────────────────────

async function main(): Promise<void> {
	const parsed = parseArgs()

	if (parsed.help) {
		process.exit(0)
	}

	// List mode
	if (parsed.list) {
		const suites = listSuites()
		for (const _s of suites) {
		}
		process.exit(0)
	}

	// Validate suite
	if (!parsed.suite) {
		process.exit(1)
	}

	const suite = getSuite(parsed.suite)
	if (!suite) {
		process.exit(1)
	}

	const adapter = suite.adapter

	// Resolve preset and build config
	const preset = parsed.preset ? resolvePreset(parsed.preset) : null
	const datasetSource = parsed.dataset
		? (adapter.datasets[parsed.dataset] ?? parsed.dataset)
		: suite.defaultDataset

	const overrides: {
		-readonly [K in keyof BenchmarkRunConfig]?: BenchmarkRunConfig[K]
	} = {
		dataset: datasetSource,
		max_tasks: parsed.maxTasks ?? 0,
		output_dir: parsed.outputDir ?? './benchmark-results',
		use_docker: parsed.docker ?? false,
		olympuz_binary: parsed.olympuzBinary ?? 'olympuz',
		repo_filter: parsed.repoFilter ?? [],
		difficulty_filter: parsed.difficultyFilter ?? [],
		language_filter: parsed.languageFilter ?? [],
	}

	if (preset?.model ?? parsed.model) overrides.model = preset?.model ?? parsed.model
	if (preset?.provider ?? parsed.provider) overrides.provider = preset?.provider ?? parsed.provider
	if (parsed.concurrency !== undefined) overrides.concurrency = parsed.concurrency
	if (parsed.timeout !== undefined) overrides.task_timeout_ms = parsed.timeout
	if (parsed.superpositionSamples !== undefined)
		overrides.superposition_samples = parsed.superpositionSamples

	const config = buildRunConfig(overrides)
	const allTasks = await adapter.loadTasks(config.dataset)

	// Filter
	const tasks = adapter.filterTasks(allTasks, config)

	if (tasks.length === 0) {
		process.exit(1)
	}
	const prompts = tasks.map((t) => ({ id: t.id, prompt: adapter.buildPrompt(t) }))

	let results

	if (config.superposition_samples > 1) {
		results = await runBatchSuperposed(
			prompts,
			config,
			async (taskId: string, result) => {
				const task = tasks.find((t) => t.id === taskId)
				if (!task) return 0
				const score = await adapter.scoreTask(task, result, config.use_docker)
				return score.resolved ? 1 : score.score
			},
			(_completed, _total, _taskId) => {},
		)
	} else {
		results = await runBatch(prompts, config, (_completed, _total, _taskId) => {})
	}
	const scores = []
	for (let i = 0; i < tasks.length; i++) {
		const score = await adapter.scoreTask(tasks[i]!, results[i]!, config.use_docker)
		scores.push(score)
	}

	// Aggregate
	const aggregate = adapter.computeAggregate(scores, results)
	const breakdowns = adapter.computeBreakdowns(tasks, scores)
	const comparison = adapter.getCompetitorScores()

	// Build final result
	const runResult: BenchmarkRunResult = {
		suite_name: adapter.name,
		version: adapter.version,
		timestamp: new Date().toISOString(),
		config,
		scores,
		aggregate,
		breakdowns,
		comparison,
	}

	// Save reports
	await saveBenchmarkReports(runResult, config.output_dir)
}

main().catch((_err) => {
	process.exit(1)
})
