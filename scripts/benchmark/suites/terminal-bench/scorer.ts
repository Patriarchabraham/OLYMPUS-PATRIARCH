/**
 * Scorer for Terminal-Bench tasks.
 *
 * Validates agent output by running setup and validation bash scripts
 * in a temporary directory. A task is resolved if the validation script
 * exits with code 0.
 */

import { execFile } from 'node:child_process'
import { mkdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { promisify } from 'node:util'
import type { BenchmarkScore } from '../../core/types'
import type { TerminalBenchTask } from './adapter'

const execAsync = promisify(execFile)

/**
 * Score a Terminal-Bench task by running its validation script.
 *
 * @param task - The task definition with setup and validation scripts.
 * @param agentOutput - The raw text output from the agent.
 * @param _useDocker - Unused; Terminal-Bench runs natively via bash.
 * @returns BenchmarkScore indicating whether the task was resolved.
 */
export async function scoreTerminalTask(
	task: TerminalBenchTask,
	agentOutput: string,
	_useDocker: boolean,
): Promise<BenchmarkScore> {
	const tmpDir = join(process.cwd(), '.benchmark-tmp', `tb-${task.id}-${Date.now()}`)

	try {
		await mkdir(tmpDir, { recursive: true })

		// Write agent output as a shell script for execution context
		const solutionFile = join(tmpDir, 'solution.sh')
		await writeFile(solutionFile, agentOutput, 'utf-8')

		// Run setup script (best-effort — some tasks may not have one)
		if (task.setup_script.trim().length > 0) {
			try {
				await execAsync('bash', ['-c', task.setup_script], {
					cwd: tmpDir,
					timeout: 60_000,
					maxBuffer: 10 * 1024 * 1024,
				})
			} catch (setupErr: unknown) {
				const msg = setupErr instanceof Error ? setupErr.message : String(setupErr)
				return {
					task_id: task.id,
					resolved: false,
					score: 0,
					duration_s: 0,
					details: { phase: 'setup', error: msg },
				}
			}
		}

		// Write the validation script to disk
		const validationFile = join(tmpDir, 'validate.sh')
		await writeFile(validationFile, task.validation_script, 'utf-8')

		// Run validation
		try {
			await execAsync('bash', [validationFile], {
				cwd: tmpDir,
				timeout: 120_000,
				maxBuffer: 10 * 1024 * 1024,
			})

			// Exit code 0 → resolved
			return {
				task_id: task.id,
				resolved: true,
				score: 1,
				duration_s: 0,
				details: { phase: 'validation', result: 'passed' },
			}
		} catch (validationErr: unknown) {
			const msg = validationErr instanceof Error ? validationErr.message : String(validationErr)
			return {
				task_id: task.id,
				resolved: false,
				score: 0,
				duration_s: 0,
				details: { phase: 'validation', error: msg },
			}
		}
	} finally {
		// Cleanup temp directory
		await rm(tmpDir, { recursive: true, force: true })
	}
}
