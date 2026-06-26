/**
 * Shared agent invocation logic for all benchmark suites.
 *
 * Provides `invokeAgent()` to run the Olympuz CLI in headless mode,
 * and `runBatch()` for concurrent task execution with progress callbacks.
 */

import { execFile } from 'node:child_process'
import { mkdir, rm } from 'node:fs/promises'
import { availableParallelism } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'
import type { BenchmarkResult, BenchmarkRunConfig, TokenUsage } from './types'

const execAsync = promisify(execFile)

/** Sanitize a task ID for use in file paths (replace slashes, colons, etc.). */
function sanitizeTaskId(taskId: string): string {
	return taskId.replace(/[/\\:]/g, '_')
}

/**
 * Auto-detect provider from model name.
 *
 * Maps model name patterns to Olympuz CLI provider flags so that
 * `--model glm-5.1` automatically routes to the OpenAI provider.
 */
function detectProviderFromModel(model: string): string | null {
	const lower = model.toLowerCase()
	if (
		lower.startsWith('gpt-') ||
		lower.startsWith('o1') ||
		lower.startsWith('o3') ||
		lower.startsWith('o4')
	)
		return 'openai'
	if (lower.startsWith('glm-')) return 'openai'
	if (lower.startsWith('gemini-') || lower.startsWith('gemma')) return 'gemini'
	if (lower.startsWith('mistral') || lower.startsWith('codestral')) return 'mistral'
	if (lower.startsWith('deepseek')) return 'openai'
	if (lower.startsWith('claude')) return 'anthropic'
	if (lower.startsWith('qwen') || lower.startsWith('llama') || lower.startsWith('codellama'))
		return 'openai'
	return null
}

/**
 * Parse the raw stdout from olympuz CLI and extract the agent's text output.
 *
 * When `--output-format json` is used, olympuz returns a JSON object with a
 * `result` field containing the agent's response text. This function extracts
 * that text. Falls back to raw stdout if parsing fails.
 */
function parseAgentOutput(rawStdout: string): string {
	try {
		const data = JSON.parse(rawStdout) as Record<string, unknown>
		if (typeof data.result === 'string') {
			return data.result
		}
	} catch {
		// Not JSON — return raw output
	}
	return rawStdout
}

/** Extracts a unified diff from the agent's response text. */
export function extractPatch(response: string): string {
	const lines = response.split('\n')
	const diffLines: string[] = []
	let inDiff = false

	for (const line of lines) {
		if (line.startsWith('--- a/') || line.startsWith('+++ b/')) {
			inDiff = true
			diffLines.push(line)
		} else if (inDiff) {
			if (
				line.startsWith('@@') ||
				line.startsWith('+') ||
				line.startsWith('-') ||
				line.startsWith(' ') ||
				line === ''
			) {
				diffLines.push(line)
			} else if (diffLines.length > 0) {
				break
			}
		}
	}

	return diffLines.join('\n')
}

/** Parse token usage from Olympuz JSON output. */
function parseTokens(output: string): TokenUsage {
	try {
		const data = JSON.parse(output) as Record<string, unknown>
		const usage = data.usage as Record<string, number> | undefined
		if (usage) {
			return {
				input_tokens: usage.input_tokens ?? 0,
				output_tokens: usage.output_tokens ?? 0,
				total_tokens: usage.total_tokens ?? (usage.input_tokens ?? 0) + (usage.output_tokens ?? 0),
			}
		}
		// Fallback: extract from modelUsage
		const modelUsage = data.modelUsage as Record<string, Record<string, number>> | undefined
		if (modelUsage) {
			const first = Object.values(modelUsage)[0]
			if (first) {
				return {
					input_tokens: first.inputTokens ?? 0,
					output_tokens: first.outputTokens ?? 0,
					total_tokens: (first.inputTokens ?? 0) + (first.outputTokens ?? 0),
				}
			}
		}
		return { input_tokens: 0, output_tokens: 0, total_tokens: 0 }
	} catch {
		return { input_tokens: 0, output_tokens: 0, total_tokens: 0 }
	}
}

/**
 * Invoke the Olympuz agent on a single task with the given prompt.
 *
 * @param taskId - Task identifier for the result.
 * @param prompt - The full prompt to send.
 * @param config - Benchmark run configuration.
 * @returns Benchmark result with output and metadata.
 */
export async function invokeAgent(
	taskId: string,
	prompt: string,
	config: BenchmarkRunConfig,
): Promise<BenchmarkResult> {
	const startTime = Date.now()
	const tmpDir = join(process.cwd(), '.benchmark-tmp')
	await mkdir(tmpDir, { recursive: true })
	const safeId = sanitizeTaskId(taskId)
	const outputFile = join(tmpDir, `${safeId}-output.json`)

	try {
		// Write prompt to temp file to avoid shell escaping issues
		const promptFile = join(tmpDir, `${safeId}-prompt.txt`)
		await import('node:fs/promises').then((fs) => fs.writeFile(promptFile, prompt, 'utf-8'))

		const binary = config.olympuz_binary
		const binaryParts = binary.split(/\s+/)
		const cmd = binaryParts[0]!
		const preArgs = binaryParts.slice(1)

		// Resolve provider: explicit config > auto-detect from model name
		const provider = config.provider || detectProviderFromModel(config.model) || 'anthropic'

		const args = [
			...preArgs,
			'-p',
			prompt,
			'--output-format',
			'json',
			'--model',
			config.model,
			'--provider',
			provider,
			'--dangerously-skip-permissions',
		]

		const { stdout } = await execAsync(cmd, args, {
			timeout: config.task_timeout_ms,
			maxBuffer: 50 * 1024 * 1024,
			env: { ...process.env },
		})

		// Cleanup prompt file
		await import('node:fs/promises').then((fs) => fs.rm(promptFile, { force: true }))

		// Parse JSON output from olympuz CLI — extract the actual result text
		const agentOutput = parseAgentOutput(stdout)
		const patch = extractPatch(agentOutput)
		const tokens = parseTokens(stdout)

		return {
			task_id: taskId,
			success: true,
			output: agentOutput,
			patch,
			duration_ms: Date.now() - startTime,
			tokens,
		}
	} catch (err: unknown) {
		const error = err instanceof Error ? err.message : String(err)
		const isTimeout = error.includes('ETIMEDOUT') || error.includes('timed out')

		return {
			task_id: taskId,
			success: false,
			output: '',
			patch: '',
			duration_ms: Date.now() - startTime,
			tokens: { input_tokens: 0, output_tokens: 0, total_tokens: 0 },
			error: isTimeout ? 'Agent timed out' : error,
		}
	} finally {
		await rm(outputFile, { force: true })
	}
}

/**
 * Run the agent on multiple tasks with bounded concurrency.
 *
 * @param tasks - Array of {id, prompt} pairs.
 * @param config - Benchmark run configuration.
 * @param onProgress - Optional callback(completed, total, taskId).
 * @returns Array of benchmark results.
 */
export async function runBatch(
	tasks: readonly { id: string; prompt: string }[],
	config: BenchmarkRunConfig,
	onProgress?: (completed: number, total: number, taskId: string) => void,
): Promise<BenchmarkResult[]> {
	const results: BenchmarkResult[] = []
	let completed = 0
	const cpus = typeof availableParallelism === 'function' ? availableParallelism() : 2
	const effectiveConcurrency = Math.min(config.concurrency, cpus)

	for (let i = 0; i < tasks.length; i += effectiveConcurrency) {
		const batch = tasks.slice(i, i + effectiveConcurrency)
		const batchResults = await Promise.all(
			batch.map(async (task) => {
				const result = await invokeAgent(task.id, task.prompt, config)
				completed++
				onProgress?.(completed, tasks.length, task.id)
				return result
			}),
		)
		results.push(...batchResults)
	}

	return results
}

/**
 * Superposition sampling: invoke the agent N times for the same task,
 * score each result, and return the best one.
 *
 * This implements "best-of-N" selection — the single most effective technique
 * for improving pass@1. With N=5, a model that scores 50% single-shot can
 * reach ~70-80% by picking the first solution that passes tests.
 *
 * @param taskId - Task identifier.
 * @param prompt - The full prompt to send.
 * @param config - Benchmark run configuration.
 * @param scorer - Optional async function that returns 0-1 score for a result.
 *                 If provided, the result with the highest score wins.
 *                 If not provided, returns the first successful result.
 * @returns The best BenchmarkResult from N attempts.
 */
export async function invokeAgentSuperposed(
	taskId: string,
	prompt: string,
	config: BenchmarkRunConfig,
	scorer?: (result: BenchmarkResult) => Promise<number>,
): Promise<BenchmarkResult> {
	const n = config.superposition_samples || 1

	if (n <= 1) {
		return invokeAgent(taskId, prompt, config)
	}

	// Launch N parallel attempts
	const attempts = await Promise.all(
		Array.from({ length: n }, (_, i) => invokeAgent(`${taskId}#${i}`, prompt, config)),
	)

	// If no scorer, return first successful result (or last failure)
	if (!scorer) {
		const success = attempts.find((r) => r.success)
		return success ?? attempts[attempts.length - 1]!
	}

	// Score all results and pick the best
	let bestResult = attempts[0]!
	let bestScore = -1

	for (const result of attempts) {
		if (!result.success) continue
		const score = await scorer(result)
		if (score > bestScore) {
			bestScore = score
			bestResult = result
		}
	}

	// Fix task_id back to original (without #N suffix)
	return { ...bestResult, task_id: taskId }
}

/**
 * Run batch with superposition sampling.
 *
 * Each task is attempted N times concurrently. A scorer callback is used
 * to pick the best result per task. Falls back to standard runBatch when
 * superposition_samples <= 1.
 */
export async function runBatchSuperposed(
	tasks: readonly { id: string; prompt: string }[],
	config: BenchmarkRunConfig,
	scorer?: (taskId: string, result: BenchmarkResult) => Promise<number>,
	onProgress?: (completed: number, total: number, taskId: string) => void,
): Promise<BenchmarkResult[]> {
	const n = config.superposition_samples || 1

	if (n <= 1) {
		return runBatch(tasks, config, onProgress)
	}

	const results: BenchmarkResult[] = []
	let completed = 0
	const cpus = typeof availableParallelism === 'function' ? availableParallelism() : 2
	// With superposition, each task uses N parallel calls, so reduce batch size
	const effectiveConcurrency = Math.max(1, Math.floor(Math.min(config.concurrency, cpus) / n))

	for (let i = 0; i < tasks.length; i += effectiveConcurrency) {
		const batch = tasks.slice(i, i + effectiveConcurrency)
		const batchResults = await Promise.all(
			batch.map(async (task) => {
				const taskScorer = scorer ? (result: BenchmarkResult) => scorer(task.id, result) : undefined
				const result = await invokeAgentSuperposed(task.id, task.prompt, config, taskScorer)
				completed++
				onProgress?.(completed, tasks.length, task.id)
				return result
			}),
		)
		results.push(...batchResults)
	}

	return results
}

/**
 * Load a JSONL dataset from a URL or file path.
 * Each line is parsed as a JSON object.
 */
export async function loadJSONL<T>(source: string): Promise<T[]> {
	if (source.startsWith('http://') || source.startsWith('https://')) {
		const response = await fetch(source)
		if (!response.ok) {
			throw new Error(`Failed to fetch dataset: ${response.status} ${response.statusText}`)
		}
		const text = await response.text()
		return parseJSONL(text)
	}

	const { readFile } = await import('node:fs/promises')
	const text = await readFile(source, 'utf-8')
	return parseJSONL(text)
}

/** Parse JSONL text into an array of objects. */
function parseJSONL<T>(text: string): T[] {
	const items: T[] = []
	for (const line of text.split('\n')) {
		const trimmed = line.trim()
		if (trimmed.length === 0) continue
		try {
			items.push(JSON.parse(trimmed) as T)
		} catch {
			// Skip malformed lines
		}
	}
	return items
}
