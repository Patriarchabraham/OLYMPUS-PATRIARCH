/**
 * Report generator for SWE-bench evaluation results.
 *
 * Produces both JSON and Markdown reports with per-task details,
 * aggregate metrics, and comparison tables.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type {
	AggregateScore,
	BenchmarkConfig,
	EvaluationResult,
	GroupedResults,
	TaskScore,
} from "./types";

// ─── Markdown Report ────────────────────────────────────────────────

/**
 * Generate a human-readable Markdown report from evaluation results.
 */
export function generateMarkdown(result: EvaluationResult): string {
	const { aggregate, by_repo, by_difficulty, task_scores, config } = result;
	const lines: string[] = [];

	lines.push("# SWE-bench Evaluation Report");
	lines.push("");
	lines.push(`**Date:** ${result.timestamp}`);
	lines.push(`**Model:** ${config.model} (${config.provider})`);
	lines.push(`**Dataset:** ${config.dataset}`);
	lines.push(`**Concurrency:** ${config.concurrency}`);
	lines.push("");

	// Summary table
	lines.push("## Summary");
	lines.push("");
	lines.push("| Metric | Value |");
	lines.push("|--------|-------|");
	lines.push(`| Total tasks | ${aggregate.total} |`);
	lines.push(`| Resolved | ${aggregate.resolved} |`);
	lines.push(`| **pass@1** | **${(aggregate.pass_at_1 * 100).toFixed(1)}%** |`);
	lines.push(`| Avg FAIL→PASS rate | ${(aggregate.avg_fail_to_pass * 100).toFixed(1)}% |`);
	lines.push(`| Avg PASS→PASS rate | ${(aggregate.avg_pass_to_pass * 100).toFixed(1)}% |`);
	lines.push(`| Avg patch similarity | ${(aggregate.avg_patch_similarity * 100).toFixed(1)}% |`);
	lines.push(`| Total duration | ${formatDuration(aggregate.total_duration_s)} |`);
	lines.push(`| Avg duration/task | ${formatDuration(aggregate.avg_duration_s)} |`);
	lines.push(`| Total tokens | ${aggregate.total_tokens.total_tokens.toLocaleString()} |`);
	lines.push("");

	// Comparison with other tools
	lines.push("## Comparison with Other Tools");
	lines.push("");
	lines.push("| Tool | pass@1 | Source |");
	lines.push("|------|--------|--------|");
	lines.push(`| **Mythos (${config.model})** | **${(aggregate.pass_at_1 * 100).toFixed(1)}%** | This run |`);
	lines.push("| Claude Code (Opus 4.7) | 87.6% | SWE-bench official |");
	lines.push("| Grok Build (code-fast-1) | 70.8% | xAI internal |");
	lines.push("| Gemini 3 Flash | 75.8% | SWE-bench official |");
	lines.push("");

	// Per-repository breakdown
	if (by_repo.length > 0) {
		lines.push("## Results by Repository");
		lines.push("");
		lines.push("| Repository | Tasks | Resolved | pass@1 | Avg Time |");
		lines.push("|------------|-------|----------|--------|----------|");
		for (const g of by_repo) {
			lines.push(
				`| ${g.label} | ${g.count} | ${g.resolved} | ${(g.pass_at_1 * 100).toFixed(1)}% | ${formatDuration(g.avg_duration_s)} |`,
			);
		}
		lines.push("");
	}

	// Per-difficulty breakdown
	if (by_difficulty.length > 0) {
		lines.push("## Results by Difficulty");
		lines.push("");
		lines.push("| Difficulty | Tasks | Resolved | pass@1 | Avg Time |");
		lines.push("|------------|-------|----------|--------|----------|");
		for (const g of by_difficulty) {
			lines.push(
				`| ${g.label} | ${g.count} | ${g.resolved} | ${(g.pass_at_1 * 100).toFixed(1)}% | ${formatDuration(g.avg_duration_s)} |`,
			);
		}
		lines.push("");
	}

	// Failed tasks detail (limit to 20)
	const failed = task_scores.filter((s) => !s.resolved);
	if (failed.length > 0) {
		lines.push("## Failed Tasks");
		lines.push("");
		for (const f of failed.slice(0, 20)) {
			lines.push(`- \`${f.instance_id}\` — similarity: ${(f.patch_similarity * 100).toFixed(0)}%, time: ${formatDuration(f.duration_s)}`);
		}
		if (failed.length > 20) {
			lines.push(`- ... and ${failed.length - 20} more`);
		}
		lines.push("");
	}

	return lines.join("\n");
}

// ─── JSON Report ────────────────────────────────────────────────────

/**
 * Persist evaluation results to JSON and Markdown files.
 */
export async function saveReports(result: EvaluationResult, outputDir: string): Promise<void> {
	await mkdir(outputDir, { recursive: true });

	const jsonPath = join(outputDir, `results-${Date.now()}.json`);
	const mdPath = join(outputDir, `report-${Date.now()}.md`);

	await writeFile(jsonPath, JSON.stringify(result, null, 2), "utf-8");
	await writeFile(mdPath, generateMarkdown(result), "utf-8");
}

// ─── Helpers ────────────────────────────────────────────────────────

/** Format seconds into human-readable duration. */
function formatDuration(seconds: number): string {
	if (seconds < 60) return `${seconds.toFixed(1)}s`;
	const mins = Math.floor(seconds / 60);
	const secs = seconds % 60;
	if (mins < 60) return `${mins}m ${secs.toFixed(0)}s`;
	const hours = Math.floor(mins / 60);
	const remainMins = mins % 60;
	return `${hours}h ${remainMins}m`;
}
