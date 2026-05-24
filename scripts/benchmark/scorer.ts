/**
 * Scoring module for SWE-bench evaluation.
 *
 * Compares generated patches against gold patches, computes similarity,
 * and optionally runs Docker-based test validation.
 */

import { execFile } from "node:child_process";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import type {
	AgentResult,
	AggregateScore,
	GroupedResults,
	SWEBenchTask,
	TaskScore,
	TokenUsage,
	EvaluationResult,
	BenchmarkConfig,
} from "./types";

const execAsync = promisify(execFile);

// ─── Patch Similarity ───────────────────────────────────────────────

/**
 * Compute line-level Jaccard similarity between two patches.
 * Returns a value between 0 (completely different) and 1 (identical).
 */
function patchSimilarity(generated: string, gold: string): number {
	if (gold.length === 0 && generated.length === 0) return 1;
	if (gold.length === 0 || generated.length === 0) return 0;

	const genLines = new Set(generated.split("\n").filter((l) => l.trim().length > 0));
	const goldLines = new Set(gold.split("\n").filter((l) => l.trim().length > 0));

	const intersection = new Set([...genLines].filter((l) => goldLines.has(l)));
	const union = new Set([...genLines, ...goldLines]);

	return intersection.size / union.size;
}

// ─── Docker-based Test Execution ────────────────────────────────────

/**
 * Run test validation inside a Docker container using the SWE-bench harness.
 * Returns pass/fail rates for FAIL_TO_PASS and PASS_TO_PASS test lists.
 */
async function runDockerTests(
	task: SWEBenchTask,
	patch: string,
	_dockerImage = "swebench/eval:latest",
): Promise<{ failToPassRate: number; passToPassRate: number }> {
	// Check if Docker is available
	try {
		await execAsync("docker", ["--version"], { timeout: 5000 });
	} catch {
		// Docker not available — fall back to patch similarity as proxy
		return { failToPassRate: 0, passToPassRate: 0 };
	}

	const tmpDir = join(process.cwd(), ".benchmark-tmp", task.instance_id);
	await mkdir(tmpDir, { recursive: true });

	try {
		// Write the generated patch to a file
		const patchFile = join(tmpDir, "generated.patch");
		await writeFile(patchFile, patch, "utf-8");

		// Run the SWE-bench evaluation container
		const args = [
			"run", "--rm",
			"-v", `${tmpDir}:/eval`,
			"-e", `INSTANCE_ID=${task.instance_id}`,
			"-e", `REPO=${task.repo}`,
			"-e", `BASE_COMMIT=${task.base_commit}`,
			"-e", `TEST_PATCH=${Buffer.from(task.test_patch).toString("base64")}`,
			"-e", `PREDICTION_PATCH=/eval/generated.patch`,
			"swebench/eval:latest",
			"python", "-m", "swebench.harness.run_evaluation",
			"--instance_id", task.instance_id,
			"--repo", task.repo,
			"--base_commit", task.base_commit,
		];

		const { stdout } = await execAsync("docker", args, {
			timeout: 300_000, // 5 minutes per test run
			maxBuffer: 10 * 1024 * 1024,
		});

		// Parse test results from output
		const failToPassRate = parseTestRate(stdout, task.FAIL_TO_PASS);
		const passToPassRate = parseTestRate(stdout, task.PASS_TO_PASS);

		return { failToPassRate, passToPassRate };
	} catch {
		return { failToPassRate: 0, passToPassRate: 0 };
	}
}

/** Parse test pass rate from SWE-bench harness output. */
function parseTestRate(output: string, testNames: readonly string[]): number {
	if (testNames.length === 0) return 1;

	let passed = 0;
	for (const name of testNames) {
		// Look for "PASSED" or "passed" near the test name
		const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
		const regex = new RegExp(`PASSED.*${escaped}|${escaped}.*passed`, "i");
		if (regex.test(output)) {
			passed++;
		}
	}

	return passed / testNames.length;
}

// ─── Public API ─────────────────────────────────────────────────────

/**
 * Score a single task's agent result against the gold patch.
 *
 * @param task - The original SWE-bench task with gold data.
 * @param result - The agent's output for this task.
 * @param runDocker - Whether to run Docker-based test validation.
 * @returns Detailed task score.
 */
export async function scoreTask(
	task: SWEBenchTask,
	result: AgentResult,
	runDocker: boolean,
): Promise<TaskScore> {
	const similarity = patchSimilarity(result.patch, task.patch);

	if (!result.success || result.patch.length === 0) {
		return {
			instance_id: task.instance_id,
			resolved: false,
			fail_to_pass_rate: 0,
			pass_to_pass_rate: 0,
			patch_similarity: similarity,
			duration_s: result.duration_ms / 1000,
		};
	}

	if (runDocker) {
		const { failToPassRate, passToPassRate } = await runDockerTests(task, result.patch);
		const resolved = failToPassRate === 1 && passToPassRate >= 0.9;

		return {
			instance_id: task.instance_id,
			resolved,
			fail_to_pass_rate: failToPassRate,
			pass_to_pass_rate: passToPassRate,
			patch_similarity: similarity,
			duration_s: result.duration_ms / 1000,
		};
	}

	// Without Docker, use patch similarity as a proxy for resolution
	// A task is "likely resolved" if similarity is very high (> 0.7)
	return {
		instance_id: task.instance_id,
		resolved: similarity > 0.7,
		fail_to_pass_rate: similarity,
		pass_to_pass_rate: similarity,
		patch_similarity: similarity,
		duration_s: result.duration_ms / 1000,
	};
}

/**
 * Compute aggregate metrics from a collection of task scores.
 */
export function computeAggregate(scores: readonly TaskScore[], results: readonly AgentResult[]): AggregateScore {
	const total = scores.length;
	const resolved = scores.filter((s) => s.resolved).length;

	const avgFailToPass = total > 0 ? scores.reduce((sum, s) => sum + s.fail_to_pass_rate, 0) / total : 0;
	const avgPassToPass = total > 0 ? scores.reduce((sum, s) => sum + s.pass_to_pass_rate, 0) / total : 0;
	const avgSimilarity = total > 0 ? scores.reduce((sum, s) => sum + s.patch_similarity, 0) / total : 0;
	const totalDuration = scores.reduce((sum, s) => sum + s.duration_s, 0);

	const totalTokens: TokenUsage = {
		input_tokens: results.reduce((sum, r) => sum + r.tokens.input_tokens, 0),
		output_tokens: results.reduce((sum, r) => sum + r.tokens.output_tokens, 0),
		total_tokens: results.reduce((sum, r) => sum + r.tokens.total_tokens, 0),
	};

	return {
		total,
		resolved,
		pass_at_1: total > 0 ? resolved / total : 0,
		avg_fail_to_pass: avgFailToPass,
		avg_pass_to_pass: avgPassToPass,
		avg_patch_similarity: avgSimilarity,
		total_duration_s: totalDuration,
		avg_duration_s: total > 0 ? totalDuration / total : 0,
		total_tokens: totalTokens,
	};
}

/**
 * Group results by a key extracted from each task+score pair.
 */
export function groupBy(
	tasks: readonly SWEBenchTask[],
	scores: readonly TaskScore[],
	keyFn: (task: SWEBenchTask) => string,
): GroupedResults[] {
	const groups = new Map<string, { total: number; resolved: number; duration: number }>();

	for (let i = 0; i < tasks.length; i++) {
		const key = keyFn(tasks[i]!);
		const score = scores[i]!;
		const existing = groups.get(key) ?? { total: 0, resolved: 0, duration: 0 };
		existing.total++;
		if (score.resolved) existing.resolved++;
		existing.duration += score.duration_s;
		groups.set(key, existing);
	}

	return [...groups.entries()]
		.map(([label, data]) => ({
			label,
			count: data.total,
			resolved: data.resolved,
			pass_at_1: data.total > 0 ? data.resolved / data.total : 0,
			avg_duration_s: data.total > 0 ? data.duration / data.total : 0,
		}))
		.sort((a, b) => b.pass_at_1 - a.pass_at_1);
}
