/**
 * Generic report generator for all benchmark suites.
 *
 * Produces Markdown reports with summary, comparison, and breakdown tables.
 */

import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { BenchmarkRunResult } from './types'

/** Format seconds into human-readable duration. */
export function formatDuration(seconds: number): string {
	if (seconds < 60) return `${seconds.toFixed(1)}s`
	const mins = Math.floor(seconds / 60)
	const secs = seconds % 60
	if (mins < 60) return `${mins}m ${secs.toFixed(0)}s`
	const hours = Math.floor(mins / 60)
	const remainMins = mins % 60
	return `${hours}h ${remainMins}m`
}

/**
 * Generate a Markdown report from a benchmark run result.
 */
export function generateMarkdownReport(result: BenchmarkRunResult): string {
	const { suite_name, aggregate, breakdowns, comparison, scores, config } = result
	const lines: string[] = []

	// Header
	lines.push(`# ${suite_name} Benchmark Report`)
	lines.push('')
	lines.push(`**Date:** ${result.timestamp}`)
	lines.push(`**Model:** ${config.model} (${config.provider})`)
	lines.push(`**Dataset:** ${config.dataset}`)
	lines.push(`**Docker validation:** ${config.use_docker ? 'Yes' : 'No'}`)
	lines.push('')

	// Summary table
	lines.push('## Summary')
	lines.push('')
	lines.push('| Metric | Value |')
	lines.push('|--------|-------|')
	lines.push(`| Total tasks | ${aggregate.total} |`)
	lines.push(`| Resolved | ${aggregate.resolved} |`)
	lines.push(`| **pass@1** | **${(aggregate.pass_at_1 * 100).toFixed(1)}%** |`)
	lines.push(`| Avg score | ${(aggregate.avg_score * 100).toFixed(1)}% |`)
	lines.push(`| Total duration | ${formatDuration(aggregate.total_duration_s)} |`)
	lines.push(`| Avg duration/task | ${formatDuration(aggregate.avg_duration_s)} |`)
	lines.push(`| Total tokens | ${aggregate.total_tokens.total_tokens.toLocaleString()} |`)
	lines.push('')

	// Comparison table
	if (comparison.length > 0) {
		lines.push('## Comparison with Other Tools')
		lines.push('')
		lines.push('| Tool | Model | pass@1 | Source |')
		lines.push('|------|-------|--------|--------|')
		lines.push(
			`| **Olympuz Coder** | **${config.model}** | **${(aggregate.pass_at_1 * 100).toFixed(1)}%** | This run |`,
		)
		for (const c of comparison) {
			lines.push(`| ${c.tool} | ${c.model} | ${(c.score * 100).toFixed(1)}% | ${c.source} |`)
		}
		lines.push('')
	}

	// Breakdown tables
	for (const group of breakdowns) {
		if (group.count === 0) continue
		// Grouped by the label prefix
	}

	// Write breakdown sections if there are any
	const hasBreakdowns = breakdowns.length > 0
	if (hasBreakdowns) {
		lines.push('## Breakdown')
		lines.push('')
		lines.push('| Group | Tasks | Resolved | pass@1 | Avg Time |')
		lines.push('|-------|-------|----------|--------|----------|')
		for (const g of breakdowns) {
			lines.push(
				`| ${g.label} | ${g.count} | ${g.resolved} | ${(g.pass_at_1 * 100).toFixed(1)}% | ${formatDuration(g.avg_duration_s)} |`,
			)
		}
		lines.push('')
	}

	// Failed tasks
	const failed = scores.filter((s) => !s.resolved)
	if (failed.length > 0) {
		lines.push('## Failed Tasks')
		lines.push('')
		for (const f of failed.slice(0, 30)) {
			lines.push(
				`- \`${f.task_id}\` — score: ${(f.score * 100).toFixed(0)}%, time: ${formatDuration(f.duration_s)}`,
			)
		}
		if (failed.length > 30) {
			lines.push(`- ... and ${failed.length - 30} more`)
		}
		lines.push('')
	}

	return lines.join('\n')
}

/**
 * Save benchmark results to JSON and Markdown files.
 */
export async function saveBenchmarkReports(
	result: BenchmarkRunResult,
	outputDir: string,
): Promise<void> {
	await mkdir(outputDir, { recursive: true })

	const timestamp = new Date(result.timestamp).toISOString().replace(/[:.]/g, '-').slice(0, 19)
	const jsonPath = join(outputDir, `${result.suite_name}-${timestamp}.json`)
	const mdPath = join(outputDir, `${result.suite_name}-${timestamp}.md`)

	await writeFile(jsonPath, JSON.stringify(result, null, 2), 'utf-8')
	await writeFile(mdPath, generateMarkdownReport(result), 'utf-8')
}
