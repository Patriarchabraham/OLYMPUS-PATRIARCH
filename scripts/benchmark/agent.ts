/**
 * Agent wrapper that interfaces with the Olympuz CLI for SWE-bench evaluation.
 *
 * Constructs prompts from task descriptions, runs Olympuz in headless mode,
 * and captures the generated diff/patch.
 */

import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";
import type { AgentResult, SWEBenchTask, TokenUsage } from "./types";

const execAsync = promisify(execFile);

/** Extracts a unified diff from the agent's response text. */
function extractPatch(response: string): string {
	// Look for diff blocks: lines starting with ---, +++, @@ and +/-
	const lines = response.split("\n");
	const diffLines: string[] = [];
	let inDiff = false;

	for (const line of lines) {
		if (line.startsWith("--- a/") || line.startsWith("+++ b/")) {
			inDiff = true;
			diffLines.push(line);
		} else if (inDiff) {
			if (line.startsWith("@@") || line.startsWith("+") || line.startsWith("-") || line.startsWith(" ") || line === "") {
				diffLines.push(line);
			} else if (diffLines.length > 0) {
				// End of diff block if we hit non-diff content after having started
				break;
			}
		}
	}

	return diffLines.join("\n");
}

/** Parses token usage from Olympuz JSON output. */
function parseTokens(output: string): TokenUsage {
	try {
		const data = JSON.parse(output) as Record<string, unknown>;
		const usage = data.usage as Record<string, number> | undefined;
		return {
			input_tokens: usage?.input_tokens ?? 0,
			output_tokens: usage?.output_tokens ?? 0,
			total_tokens: usage?.total_tokens ?? 0,
		};
	} catch {
		return { input_tokens: 0, output_tokens: 0, total_tokens: 0 };
	}
}

/** Builds the prompt for a SWE-bench task. */
function buildPrompt(task: SWEBenchTask): string {
	return [
		`Resolve the following GitHub issue in the repository ${task.repo}.`,
		"",
		"## Issue Description",
		task.problem_statement,
		"",
		task.hints_text ? `## Hints\n${task.hints_text}\n` : "",
		"## Instructions",
		"1. Read the relevant source files in the repository.",
		"2. Understand the bug or feature described in the issue.",
		"3. Make the minimal necessary changes to resolve the issue.",
		"4. Ensure existing tests still pass.",
		"5. Output your changes as a unified diff (git diff format).",
		"",
		`Base commit: ${task.base_commit}`,
		`Repository: ${task.repo}`,
		`Instance ID: ${task.instance_id}`,
	].join("\n");
}

/**
 * Run the Olympuz agent on a single SWE-bench task.
 *
 * @param task - The SWE-bench task to evaluate.
 * @param config - Benchmark configuration.
 * @returns Agent result with generated patch and metadata.
 */
export async function runAgent(
	task: SWEBenchTask,
	config: { olympuz_binary: string; model: string; provider: string; task_timeout_ms: number },
): Promise<AgentResult> {
	const startTime = Date.now();
	const prompt = buildPrompt(task);

	// Write prompt to a temp file to avoid shell escaping issues
	const tmpDir = join(process.cwd(), ".benchmark-tmp");
	await mkdir(tmpDir, { recursive: true });
	const promptFile = join(tmpDir, `${task.instance_id}-prompt.txt`);
	const outputFile = join(tmpDir, `${task.instance_id}-output.json`);

	try {
		await writeFile(promptFile, prompt, "utf-8");

		const args = [
			"-p", prompt,
			"--output-format", "json",
			"--model", config.model,
			"--provider", config.provider,
			"--no-input",
		];

		const { stdout, stderr } = await execAsync(config.olympuz_binary, args, {
			timeout: config.task_timeout_ms,
			maxBuffer: 50 * 1024 * 1024, // 50 MB
			env: { ...process.env, OLYMPUZ_OUTPUT_FILE: outputFile },
		});

		const responseText = stdout;
		const patch = extractPatch(responseText);
		const tokens = parseTokens(stdout);

		return {
			instance_id: task.instance_id,
			patch,
			model: config.model,
			provider: config.provider,
			duration_ms: Date.now() - startTime,
			tokens,
			success: true,
		};
	} catch (err: unknown) {
		const error = err instanceof Error ? err.message : String(err);
		const isTimeout = error.includes("ETIMEDOUT") || error.includes("timed out");

		return {
			instance_id: task.instance_id,
			patch: "",
			model: config.model,
			provider: config.provider,
			duration_ms: Date.now() - startTime,
			tokens: { input_tokens: 0, output_tokens: 0, total_tokens: 0 },
			success: false,
			error: isTimeout ? "Agent timed out" : error,
		};
	} finally {
		// Cleanup temp files
		await rm(promptFile, { force: true });
		await rm(outputFile, { force: true });
	}
}

/**
 * Run the Olympuz agent on multiple tasks with bounded concurrency.
 *
 * @param tasks - Tasks to evaluate.
 * @param config - Benchmark configuration.
 * @param onProgress - Optional callback for progress updates.
 * @returns Array of agent results.
 */
export async function runAgentBatch(
	tasks: readonly SWEBenchTask[],
	config: { olympuz_binary: string; model: string; provider: string; task_timeout_ms: number; concurrency: number },
	onProgress?: (completed: number, total: number, instanceId: string) => void,
): Promise<AgentResult[]> {
	const results: AgentResult[] = [];
	let completed = 0;

	// Process in batches of `concurrency`
	for (let i = 0; i < tasks.length; i += config.concurrency) {
		const batch = tasks.slice(i, i + config.concurrency);
		const batchResults = await Promise.all(
			batch.map(async (task) => {
				const result = await runAgent(task, config);
				completed++;
				onProgress?.(completed, tasks.length, task.instance_id);
				return result;
			}),
		);
		results.push(...batchResults);
	}

	return results;
}
