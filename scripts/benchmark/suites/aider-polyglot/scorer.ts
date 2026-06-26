/**
 * Multi-language test scorer for the Aider Polyglot benchmark.
 *
 * Validates generated code by writing it to a temp workspace and running
 * the appropriate language-specific test runner.
 */

import { execFile } from 'node:child_process'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { promisify } from 'node:util'
import type { BenchmarkScore } from '../../core/types'
import type { AiderPolyglotTask } from './adapter'

const execAsync = promisify(execFile)

/** Language-specific test configuration. */
interface LanguageConfig {
	/** File extension (e.g., ".py"). */
	readonly ext: string
	/** Test command builder. Returns [executable, ...args]. */
	readonly testCmd: (workspace: string, task: AiderPolyglotTask) => string[]
}

/** Language dispatch map. */
/** Resolve python binary for current platform. */
const PYTHON_BIN = process.platform === 'win32' ? 'python' : 'python3'

const LANGUAGE_CONFIGS: Record<string, LanguageConfig> = {
	python: {
		ext: '.py',
		testCmd: (ws) => [PYTHON_BIN, '-m', 'pytest', join(ws, 'test.py'), '-v'],
	},
	javascript: {
		ext: '.js',
		testCmd: (ws) => ['node', join(ws, 'test.js')],
	},
	typescript: {
		ext: '.ts',
		testCmd: (ws) => ['npx', 'ts-node', join(ws, 'test.ts')],
	},
	rust: {
		ext: '.rs',
		testCmd: (ws) => ['cargo', 'test', '--manifest-path', join(ws, 'Cargo.toml')],
	},
	go: {
		ext: '.go',
		testCmd: (ws) => ['go', 'test', join(ws, '...')],
	},
	cpp: {
		ext: '.cpp',
		testCmd: (ws) => [
			'bash',
			'-c',
			`cd ${ws} && g++ -o solution solution.cpp test.cpp && ./solution`,
		],
	},
}

/**
 * Check whether a language toolchain is available locally.
 */
async function isToolchainAvailable(language: string): Promise<boolean> {
	const checks: Record<string, [string, string[]]> = {
		python: [PYTHON_BIN, ['--version']],
		javascript: ['node', ['--version']],
		typescript: ['npx', ['--version']],
		rust: ['cargo', ['--version']],
		go: ['go', ['version']],
		cpp: ['g++', ['--version']],
	}

	const check = checks[language]
	if (!check) return false

	try {
		await execAsync(check[0], check[1], { timeout: 5000 })
		return true
	} catch {
		return false
	}
}

/**
 * Extract code from the agent output.
 * Strips markdown fences and explanatory text.
 */
function extractCode(output: string, language: string): string {
	// Try to extract from code fences first
	const fencePattern = new RegExp(`\`\`\`${language}\\s*\\n([\\s\\S]*?)\`\`\``, 'i')
	const fenceMatch = output.match(fencePattern)
	if (fenceMatch?.[1]) {
		return fenceMatch[1].trim()
	}

	// Try generic code fence
	const genericFence = output.match(/```\s*\n([\s\S]*?)```/)
	if (genericFence?.[1]) {
		return genericFence[1].trim()
	}

	// Return raw output as-is (might be pure code)
	return output.trim()
}

/**
 * Score a single polyglot task by running the language-specific test.
 *
 * @param task - The exercise task.
 * @param output - The agent's generated output.
 * @param useDocker - Whether Docker is available for sandboxed execution.
 * @param language - The programming language.
 * @returns Benchmark score with resolution status.
 */
export async function scorePolyglotTask(
	task: AiderPolyglotTask,
	output: string,
	useDocker: boolean,
	language: string,
): Promise<BenchmarkScore> {
	const langConfig = LANGUAGE_CONFIGS[language]
	if (!langConfig) {
		return {
			task_id: task.id,
			resolved: false,
			score: 0,
			duration_s: 0,
			details: { language, error: `Unsupported language: ${language}` },
		}
	}

	// Check toolchain availability
	if (!useDocker && !(await isToolchainAvailable(language))) {
		return {
			task_id: task.id,
			resolved: false,
			score: 0,
			duration_s: 0,
			details: {
				language,
				error: `No ${language} toolchain available. Use --docker for sandboxed execution.`,
			},
		}
	}

	// Create temp workspace
	const workspace = join(
		process.cwd(),
		'.benchmark-tmp',
		'polyglot',
		`${language}-${task.exercise_name}-${Date.now()}`,
	)
	await mkdir(workspace, { recursive: true })

	try {
		const code = extractCode(output, language)

		// Write generated solution
		const solutionFile = join(workspace, `solution${langConfig.ext}`)
		await writeFile(solutionFile, code, 'utf-8')

		// Write test file
		const testFile = join(workspace, `test${langConfig.ext}`)
		await writeFile(testFile, task.test_file, 'utf-8')

		// For Rust, create minimal Cargo.toml
		if (language === 'rust') {
			const cargoToml = [
				'[package]',
				'name = "solution"',
				'edition = "2021"',
				'',
				'[[bin]]',
				'name = "solution"',
				`path = "solution.rs"`,
			].join('\n')
			await writeFile(join(workspace, 'Cargo.toml'), cargoToml, 'utf-8')
			// Move solution.rs to src/
			const srcDir = join(workspace, 'src')
			await mkdir(srcDir, { recursive: true })
			const { rename } = await import('node:fs/promises')
			await rename(solutionFile, join(srcDir, 'main.rs'))
		}

		// Run tests
		const [exe, ...args] = langConfig.testCmd(workspace, task)
		const startTime = Date.now()

		let testOutput = ''
		let passed = false
		try {
			const result = await execAsync(exe, args, {
				timeout: 60_000,
				maxBuffer: 10 * 1024 * 1024,
				cwd: workspace,
			})
			testOutput = result.stdout
			passed = true
		} catch (err: unknown) {
			const error = err as { stdout?: string; stderr?: string }
			testOutput = `${error.stdout ?? ''}\n${error.stderr ?? ''}`
			passed = false
		}

		const duration_s = (Date.now() - startTime) / 1000

		return {
			task_id: task.id,
			resolved: passed,
			score: passed ? 1 : 0,
			duration_s,
			details: { language, testOutput: testOutput.slice(0, 2000) },
		}
	} finally {
		await rm(workspace, { recursive: true, force: true })
	}
}
