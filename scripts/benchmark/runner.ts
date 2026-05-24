/**
 * SWE-bench evaluation runner for Mythos Patriarch.
 *
 * Orchestrates the full evaluation pipeline:
 * dataset loading → task filtering → agent execution → scoring → reporting.
 *
 * Usage:
 *   bun run scripts/benchmark/runner.ts --model claude-opus-4-7 --dataset lite
 */

import { readFile } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { join } from "node:path";
import type { SWEBenchTask, AgentResult, EvaluationResult, BenchmarkConfig } from "./types";
import { DEFAULT_CONFIG, DATASETS, resolvePreset, buildConfig } from "./config";
import { runAgentBatch } from "./agent";
import { scoreTask, computeAggregate, groupBy } from "./scorer";
import { saveReports, generateMarkdown } from "./report";

// ─── Dataset Loading ────────────────────────────────────────────────

/**
 * Load a SWE-bench JSONL dataset from a local file path.
 * Each line is a JSON object representing one task.
 */
async function loadDatasetFromFile(filePath: string): Promise<SWEBenchTask[]> {
	const fileStream = createReadStream(filePath, "utf-8");
	const rl = createInterface({ input: fileStream, crlfDelay: Infinity });
	const tasks: SWEBenchTask[] = [];

	for await (const line of rl) {
		const trimmed = line.trim();
		if (trimmed.length === 0) continue;
		try {
			tasks.push(JSON.parse(trimmed) as SWEBenchTask);
		} catch {
			console.warn(`Skipping malformed line: ${trimmed.slice(0, 80)}...`);
		}
	}

	return tasks;
}

/**
 * Load a SWE-bench dataset from a URL.
 * Fetches the JSONL file and parses it.
 */
async function loadDatasetFromURL(url: string): Promise<SWEBenchTask[]> {
	const response = await fetch(url);
	if (!response.ok) {
		throw new Error(`Failed to fetch dataset: ${response.status} ${response.statusText}`);
	}
	const text = await response.text();
	const tasks: SWEBenchTask[] = [];

	for (const line of text.split("\n")) {
		const trimmed = line.trim();
		if (trimmed.length === 0) continue;
		try {
			tasks.push(JSON.parse(trimmed) as SWEBenchTask);
		} catch {
			console.warn(`Skipping malformed line: ${trimmed.slice(0, 80)}...`);
		}
	}

	return tasks;
}

/**
 * Load a SWE-bench dataset, detecting URL vs file path automatically.
 */
async function loadDataset(source: string): Promise<SWEBenchTask[]> {
	if (source.startsWith("http://") || source.startsWith("https://")) {
		console.log(`Fetching dataset from URL: ${source}`);
		return loadDatasetFromURL(source);
	}
	console.log(`Loading dataset from file: ${source}`);
	return loadDatasetFromFile(source);
}

// ─── Task Filtering ─────────────────────────────────────────────────

/**
 * Filter tasks based on configuration criteria.
 */
function filterTasks(tasks: SWEBenchTask[], config: BenchmarkConfig): SWEBenchTask[] {
	let filtered = tasks;

	if (config.repo_filter.length > 0) {
		const repoSet = new Set(config.repo_filter);
		filtered = filtered.filter((t) => repoSet.has(t.repo));
	}

	if (config.difficulty_filter.length > 0) {
		const diffSet = new Set(config.difficulty_filter);
		filtered = filtered.filter((t) => t.difficulty && diffSet.has(t.difficulty));
	}

	if (config.language_filter.length > 0) {
		const langSet = new Set(config.language_filter);
		filtered = filtered.filter((t) => t.language && langSet.has(t.language));
	}

	if (config.max_tasks > 0) {
		filtered = filtered.slice(0, config.max_tasks);
	}

	return filtered;
}

// ─── CLI Argument Parsing ───────────────────────────────────────────

interface ParsedArgs {
	model?: string;
	provider?: string;
	dataset?: string;
	preset?: string;
	concurrency?: number;
	timeout?: number;
	maxTasks?: number;
	outputDir?: string;
	repoFilter?: string[];
	difficultyFilter?: string[];
	languageFilter?: string[];
	noDocker?: boolean;
	mythosBinary?: string;
}

/** Parse CLI arguments from process.argv. */
function parseArgs(): ParsedArgs {
	const args = process.argv.slice(2);
	const parsed: ParsedArgs = {};

	for (let i = 0; i < args.length; i++) {
		const arg = args[i];
		const next = () => args[++i];

		switch (arg) {
			case "--model": parsed.model = next(); break;
			case "--provider": parsed.provider = next(); break;
			case "--dataset": parsed.dataset = next(); break;
			case "--preset": parsed.preset = next(); break;
			case "--concurrency": parsed.concurrency = Number(next()); break;
			case "--timeout": parsed.timeout = Number(next()); break;
			case "--max-tasks": parsed.maxTasks = Number(next()); break;
			case "--output-dir": parsed.outputDir = next(); break;
			case "--repo-filter": parsed.repoFilter = next()?.split(","); break;
			case "--difficulty-filter": parsed.difficultyFilter = next()?.split(","); break;
			case "--language-filter": parsed.languageFilter = next()?.split(","); break;
			case "--no-docker": parsed.noDocker = true; break;
			case "--mythos-binary": parsed.mythosBinary = next(); break;
			case "--help":
				console.log(HELP_TEXT);
				process.exit(0);
		}
	}

	return parsed;
}

const HELP_TEXT = `
SWE-bench Evaluation Runner for Mythos Patriarch

Usage: bun run scripts/benchmark/runner.ts [options]

Options:
  --model <model>           Model to evaluate (default: claude-sonnet-4-5-20250514)
  --provider <provider>     Provider to use (default: anthropic)
  --dataset <path|url>      Dataset source: 'lite', 'verified', 'full', or URL/file
  --preset <name>           Use a model preset (claude-opus, gpt4o, gemini-flash, etc.)
  --concurrency <n>         Max concurrent tasks (default: 4)
  --timeout <ms>            Per-task timeout in ms (default: 600000)
  --max-tasks <n>           Limit number of tasks (0 = all)
  --output-dir <path>       Output directory (default: ./benchmark-results)
  --repo-filter <repos>     Comma-separated repo names
  --difficulty-filter <d>   Comma-separated difficulty levels
  --language-filter <l>     Comma-separated languages
  --no-docker               Skip Docker-based test validation
  --mythos-binary <path>    Path to mythos binary (default: mythos)
  --help                    Show this help
`;

// ─── Main Runner ────────────────────────────────────────────────────

/**
 * Run the full SWE-bench evaluation pipeline.
 */
async function main(): Promise<void> {
	const parsed = parseArgs();

	// Resolve preset
	const preset = parsed.preset ? resolvePreset(parsed.preset) : null;

	// Resolve dataset alias
	const datasetSource = parsed.dataset
		? (DATASETS[parsed.dataset] ?? parsed.dataset)
		: DEFAULT_CONFIG.dataset;

	// Build config
	const config = buildConfig({
		model: preset?.model ?? parsed.model ?? DEFAULT_CONFIG.model,
		provider: preset?.provider ?? parsed.provider ?? DEFAULT_CONFIG.provider,
		dataset: datasetSource,
		concurrency: parsed.concurrency ?? DEFAULT_CONFIG.concurrency,
		task_timeout_ms: parsed.timeout ?? DEFAULT_CONFIG.task_timeout_ms,
		repo_filter: parsed.repoFilter ?? DEFAULT_CONFIG.repo_filter,
		difficulty_filter: parsed.difficultyFilter ?? DEFAULT_CONFIG.difficulty_filter,
		language_filter: parsed.languageFilter ?? DEFAULT_CONFIG.language_filter,
		max_tasks: parsed.maxTasks ?? DEFAULT_CONFIG.max_tasks,
		output_dir: parsed.outputDir ?? DEFAULT_CONFIG.output_dir,
		run_docker_tests: parsed.noDocker ? false : DEFAULT_CONFIG.run_docker_tests,
		mythos_binary: parsed.mythosBinary ?? DEFAULT_CONFIG.mythos_binary,
	});

	console.log("=== Mythos Patriarch SWE-bench Evaluation ===");
	console.log(`Model: ${config.model} (${config.provider})`);
	console.log(`Dataset: ${config.dataset}`);
	console.log(`Concurrency: ${config.concurrency}`);
	console.log(`Docker tests: ${config.run_docker_tests}`);
	console.log("");

	// Load and filter tasks
	const allTasks = await loadDataset(config.dataset);
	console.log(`Loaded ${allTasks.length} tasks`);

	const tasks = filterTasks(allTasks, config);
	console.log(`After filtering: ${tasks.length} tasks`);
	console.log("");

	if (tasks.length === 0) {
		console.error("No tasks to evaluate after filtering. Check your filter settings.");
		process.exit(1);
	}

	// Run agent on all tasks
	console.log("Starting evaluation...");
	const results = await runAgentBatch(tasks, config, (completed, total, instanceId) => {
		console.log(`  [${completed}/${total}] ${instanceId}`);
	});

	// Score each task
	console.log("\nScoring results...");
	const taskScores: import("./types").TaskScore[] = [];
	for (let i = 0; i < tasks.length; i++) {
		const task = tasks[i]!;
		const result = results[i]!;
		const score = await scoreTask(task, result, config.run_docker_tests);
		taskScores.push(score);
	}

	// Compute aggregates
	const aggregate = computeAggregate(taskScores, results);
	const byRepo = groupBy(tasks, taskScores, (t) => t.repo);
	const difficultyTasks = tasks.filter((t) => t.difficulty !== undefined);
	const difficultyScores = taskScores.filter((_, i) => tasks[i]?.difficulty !== undefined);
	const byDifficulty = groupBy(
		difficultyTasks,
		difficultyScores,
		(t) => t.difficulty ?? "unknown",
	);

	// Build final result
	const evaluationResult: EvaluationResult = {
		timestamp: new Date().toISOString(),
		config,
		task_scores: taskScores,
		aggregate,
		by_repo: byRepo,
		by_difficulty: byDifficulty,
	};

	// Save reports
	await saveReports(evaluationResult, config.output_dir);

	// Print summary
	console.log("\n=== Results ===");
	console.log(`pass@1: ${(aggregate.pass_at_1 * 100).toFixed(1)}% (${aggregate.resolved}/${aggregate.total})`);
	console.log(`Avg duration: ${aggregate.avg_duration_s.toFixed(1)}s`);
	console.log(`Total tokens: ${aggregate.total_tokens.total_tokens.toLocaleString()}`);
	console.log(`Reports saved to: ${config.output_dir}`);
}

main().catch((err) => {
	console.error("Fatal error:", err);
	process.exit(1);
});
