/**
 * Scoring module for BigCodeBench tasks.
 *
 * Supports Docker-based pytest validation and a no-Docker fallback
 * using code similarity against the canonical solution.
 */

import { execFile } from 'node:child_process'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { promisify } from 'node:util'
import { patchSimilarity, runPythonCheck } from '../../core/scorer'
import type { BenchmarkResult, BenchmarkScore } from '../../core/types'
import type { BigCodeBenchTask } from './adapter'

const execAsync = promisify(execFile)

/**
 * Extract the code completion from the agent's response.
 *
 * Strips markdown fences and leading/trailing whitespace.
 */
function extractCompletion(output: string): string {
	// Strip markdown code fences
	const fenceMatch = output.match(/```(?:python)?\s*\n([\s\S]*?)```/)
	if (fenceMatch?.[1]) {
		return fenceMatch[1].trim()
	}
	// Fallback: return trimmed output
	return output.trim()
}

/**
 * Run pytest validation inside a Docker container.
 *
 * @returns pass rate (0–1) or 0 on failure.
 */
async function runDockerPytest(task: BigCodeBenchTask, completion: string): Promise<number> {
	// Check Docker availability
	try {
		await execAsync('docker', ['--version'], { timeout: 5_000 })
	} catch {
		return 0
	}

	const tmpDir = join(process.cwd(), '.benchmark-tmp', `bigcodebench-${task.task_id}`)
	await mkdir(tmpDir, { recursive: true })

	try {
		// Build the full Python file: imports + prompt (with completion) + test
		const solutionFile = join(tmpDir, 'solution.py')
		const promptLines = task.prompt.split('\n')
		// Replace the function body placeholder with the completion
		const fullCode = [
			task.imports ?? '',
			'',
			...promptLines.slice(0, -1), // everything except the last line (pass/...)
			completion,
			'',
			task.test,
		].join('\n')

		await writeFile(solutionFile, fullCode, 'utf-8')

		const args = [
			'run',
			'--rm',
			'-v',
			`${tmpDir}:/eval`,
			'bigcodebench/bigcodebench-eval:latest',
			'python',
			'-m',
			'pytest',
			'/eval/solution.py',
			'-v',
		]

		const { stdout } = await execAsync('docker', args, {
			timeout: 120_000,
			maxBuffer: 10 * 1024 * 1024,
		})

		// Count passed/failed from pytest output
		const passedMatch = stdout.match(/(\d+) passed/)
		const failedMatch = stdout.match(/(\d+) failed/)
		const passed = passedMatch ? parseInt(passedMatch[1]!, 10) : 0
		const failed = failedMatch ? parseInt(failedMatch[1]!, 10) : 0
		const total = passed + failed

		return total > 0 ? passed / total : 0
	} catch {
		return 0
	} finally {
		await rm(tmpDir, { recursive: true, force: true })
	}
}

/**
 * Score a BigCodeBench task using no-Docker fallback.
 *
 * Writes a temp Python file combining prompt + completion + test,
 * then runs python3 to check if it passes.
 */
async function scoreNoDocker(
	task: BigCodeBenchTask,
	completion: string,
): Promise<{ passed: boolean; similarity: number }> {
	// Similarity against canonical solution
	const similarity = patchSimilarity(completion, task.canonical_solution)

	// Try running the code with Python
	const promptLines = task.prompt.split('\n')
	const fullCode = [
		task.imports ?? '',
		'',
		...promptLines.slice(0, -1),
		completion,
		'',
		task.test,
	].join('\n')

	const { passed } = await runPythonCheck(fullCode, 30_000)

	// Resolve: pass if python check passes or similarity is very high
	return {
		passed: passed || similarity > 0.8,
		similarity,
	}
}

/**
 * Score a single BigCodeBench task result.
 *
 * @param task - The original task with canonical solution and tests.
 * @param result - The agent's output.
 * @param useDocker - Whether to use Docker-based pytest validation.
 * @returns Benchmark score.
 */
export async function scoreBigCodeBench(
	task: BigCodeBenchTask,
	result: BenchmarkResult,
	useDocker: boolean,
): Promise<BenchmarkScore> {
	const duration_s = result.duration_ms / 1000

	if (!result.success || result.output.length === 0) {
		return {
			task_id: task.task_id,
			resolved: false,
			score: 0,
			duration_s,
			details: { error: result.error ?? 'No output' },
		}
	}

	const completion = extractCompletion(result.output)

	if (useDocker) {
		const passRate = await runDockerPytest(task, completion)
		return {
			task_id: task.task_id,
			resolved: passRate >= 1,
			score: passRate,
			duration_s,
			details: { pass_rate: passRate, method: 'docker-pytest' },
		}
	}

	const { passed, similarity } = await scoreNoDocker(task, completion)
	return {
		task_id: task.task_id,
		resolved: passed,
		score: similarity,
		duration_s,
		details: { similarity, method: 'similarity-fallback' },
	}
}
