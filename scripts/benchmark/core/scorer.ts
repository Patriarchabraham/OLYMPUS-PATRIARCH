/**
 * Shared scoring utilities for all benchmark suites.
 *
 * Provides patch similarity, generic aggregation, and grouping.
 */

import type { AggregateMetrics, BenchmarkResult, BenchmarkScore, TokenUsage } from './types'

/** Detect the Python executable name for the current platform. */
const PYTHON_BIN = process.platform === 'win32' ? 'python' : 'python3'

/**
 * Compute line-level Jaccard similarity between two patches.
 * Returns a value between 0 (completely different) and 1 (identical).
 */
export function patchSimilarity(generated: string, gold: string): number {
	if (gold.length === 0 && generated.length === 0) return 1
	if (gold.length === 0 || generated.length === 0) return 0

	const genLines = new Set(generated.split('\n').filter((l) => l.trim().length > 0))
	const goldLines = new Set(gold.split('\n').filter((l) => l.trim().length > 0))

	const intersection = new Set([...genLines].filter((l) => goldLines.has(l)))
	const union = new Set([...genLines, ...goldLines])

	return intersection.size / union.size
}

/**
 * Compute aggregate metrics from scores and results.
 */
export function computeAggregateGeneric(
	scores: readonly BenchmarkScore[],
	results: readonly BenchmarkResult[],
): AggregateMetrics {
	const total = scores.length
	const resolved = scores.filter((s) => s.resolved).length
	const avgScore = total > 0 ? scores.reduce((sum, s) => sum + s.score, 0) / total : 0
	const totalDuration = scores.reduce((sum, s) => sum + s.duration_s, 0)

	const totalTokens: TokenUsage = {
		input_tokens: results.reduce((sum, r) => sum + r.tokens.input_tokens, 0),
		output_tokens: results.reduce((sum, r) => sum + r.tokens.output_tokens, 0),
		total_tokens: results.reduce((sum, r) => sum + r.tokens.total_tokens, 0),
	}

	return {
		total,
		resolved,
		pass_at_1: total > 0 ? resolved / total : 0,
		avg_score: avgScore,
		total_duration_s: totalDuration,
		avg_duration_s: total > 0 ? totalDuration / total : 0,
		total_tokens: totalTokens,
	}
}

/**
 * Group scores by a key function, computing per-group metrics.
 */
export function groupByGeneric<T>(
	items: readonly T[],
	scores: readonly BenchmarkScore[],
	keyFn: (item: T) => string,
): import('./types').BreakdownGroup[] {
	const groups = new Map<string, { total: number; resolved: number; duration: number }>()

	for (let i = 0; i < items.length; i++) {
		const key = keyFn(items[i]!)
		const score = scores[i]!
		const existing = groups.get(key) ?? { total: 0, resolved: 0, duration: 0 }
		existing.total++
		if (score.resolved) existing.resolved++
		existing.duration += score.duration_s
		groups.set(key, existing)
	}

	return [...groups.entries()]
		.map(([label, data]) => ({
			label,
			count: data.total,
			resolved: data.resolved,
			pass_at_1: data.total > 0 ? data.resolved / data.total : 0,
			avg_duration_s: data.total > 0 ? data.duration / data.total : 0,
		}))
		.sort((a, b) => b.pass_at_1 - a.pass_at_1)
}

/**
 * Run a Python subprocess and check if it succeeds (exit code 0).
 * Used by HumanEval, LiveCodeBench, etc.
 */
export async function runPythonCheck(
	code: string,
	timeout = 30_000,
): Promise<{ passed: boolean; error?: string }> {
	const { execFile } = await import('node:child_process')
	const { promisify } = await import('node:util')
	const { writeFile, rm } = await import('node:fs/promises')
	const { join } = await import('node:path')
	const execAsync = promisify(execFile)

	const tmpFile = join(
		process.cwd(),
		'.benchmark-tmp',
		`check-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.py`,
	)
	const { mkdir } = await import('node:fs/promises')
	await mkdir(join(process.cwd(), '.benchmark-tmp'), { recursive: true })

	try {
		await writeFile(tmpFile, code, 'utf-8')
		await execAsync(PYTHON_BIN, [tmpFile], { timeout, maxBuffer: 10 * 1024 * 1024 })
		return { passed: true }
	} catch (err: unknown) {
		const error = err instanceof Error ? err.message : String(err)
		return { passed: false, error }
	} finally {
		await rm(tmpFile, { force: true })
	}
}
