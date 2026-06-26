/**
 * Scorer for LiveCodeBench tasks.
 *
 * Runs generated Python solutions against test cases via subprocess,
 * comparing stdout against expected output.
 */

import { spawn } from 'node:child_process'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

/** Detect the Python executable name for the current platform. */
const PYTHON_BIN = process.platform === 'win32' ? 'python' : 'python3'

/** Result of scoring a single LiveCodeBench submission. */
export interface LiveCodeBenchScoreResult {
	/** Number of test cases that passed. */
	readonly passed: number
	/** Total number of test cases. */
	readonly total: number
	/** Fraction of test cases passed (0–1). */
	readonly passRate: number
	/** Details per test case. */
	readonly details: ReadonlyArray<{ index: number; passed: boolean; error?: string }>
}

/**
 * Extract Python code from the agent's response.
 *
 * Looks for code blocks delimited by triple backticks, or falls back
 * to using the entire response if no blocks are found.
 */
export function extractPythonCode(output: string): string {
	// Try ```python ... ``` blocks first
	const pythonBlockRegex = /```(?:python|py)\s*\n([\s\S]*?)```/g
	const matches = [...output.matchAll(pythonBlockRegex)]
	if (matches.length > 0) {
		// Use the last (usually the complete) code block
		return matches[matches.length - 1]![1]!.trim()
	}

	// Try any ``` ... ``` block
	const genericBlockRegex = /```\s*\n([\s\S]*?)```/g
	const genericMatches = [...output.matchAll(genericBlockRegex)]
	if (genericMatches.length > 0) {
		return genericMatches[genericMatches.length - 1]![1]!.trim()
	}

	// Fallback: use entire output
	return output.trim()
}

/**
 * Run a Python file with stdin input and capture stdout.
 * Uses spawn instead of execFile to support stdin piping.
 */
function runPythonWithInput(
	file: string,
	stdinInput: string,
	timeoutMs: number,
): Promise<{ stdout: string; stderr: string }> {
	return new Promise((resolve, reject) => {
		const child = spawn(PYTHON_BIN, [file], { stdio: ['pipe', 'pipe', 'pipe'] })
		let stdout = ''
		let stderr = ''

		child.stdout.on('data', (chunk: Buffer) => {
			stdout += chunk.toString()
		})
		child.stderr.on('data', (chunk: Buffer) => {
			stderr += chunk.toString()
		})

		const timer = setTimeout(() => {
			child.kill('SIGKILL')
			reject(new Error(`Timed out after ${timeoutMs}ms`))
		}, timeoutMs)

		child.on('close', (code) => {
			clearTimeout(timer)
			if (code === 0) {
				resolve({ stdout, stderr })
			} else {
				reject(new Error(stderr || `Exit code ${code}`))
			}
		})

		child.on('error', (err) => {
			clearTimeout(timer)
			reject(err)
		})

		child.stdin.write(stdinInput)
		child.stdin.end()
	})
}

/**
 * Score a generated solution against test cases.
 *
 * Writes the solution to a temporary Python file, then runs it
 * once per test case, piping input to stdin and comparing stdout
 * against the expected output.
 *
 * @param code - The generated Python code to evaluate.
 * @param testCases - Array of {input, output} test cases.
 * @param timeout - Per-test-case timeout in milliseconds (default: 10s).
 * @returns Score result with per-case details.
 */
export async function scoreLiveCodeBench(
	code: string,
	testCases: ReadonlyArray<{ input: string; output: string }>,
	timeout = 10_000,
): Promise<LiveCodeBenchScoreResult> {
	if (testCases.length === 0) {
		return { passed: 0, total: 0, passRate: 1, details: [] }
	}

	const tmpDir = join(process.cwd(), '.benchmark-tmp', 'livecodebench')
	await mkdir(tmpDir, { recursive: true })
	const solutionFile = join(
		tmpDir,
		`solution-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.py`,
	)

	try {
		await writeFile(solutionFile, code, 'utf-8')

		let passed = 0
		const details: Array<{ index: number; passed: boolean; error?: string }> = []

		for (let i = 0; i < testCases.length; i++) {
			const tc = testCases[i]!
			try {
				const { stdout } = await runPythonWithInput(solutionFile, tc.input, timeout)

				const actual = stdout.trimEnd()
				const expected = tc.output.trimEnd()
				const casePassed = actual === expected
				if (casePassed) passed++
				details.push({
					index: i,
					passed: casePassed,
					error: casePassed ? undefined : `Expected:\n${expected}\nGot:\n${actual}`,
				})
			} catch (err: unknown) {
				const error = err instanceof Error ? err.message : String(err)
				details.push({ index: i, passed: false, error: error.slice(0, 200) })
			}
		}

		return {
			passed,
			total: testCases.length,
			passRate: passed / testCases.length,
			details,
		}
	} finally {
		await rm(solutionFile, { force: true })
	}
}
