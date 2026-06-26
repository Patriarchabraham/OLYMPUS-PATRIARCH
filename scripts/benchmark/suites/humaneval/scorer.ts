/**
 * HumanEval scoring via Python subprocess execution.
 */

import { runPythonCheck } from '../../core/scorer'
import type { HumanEvalTask } from './types'

/**
 * Score a HumanEval task by executing prompt + completion + test in Python.
 *
 * @param task - The HumanEval task with prompt and test.
 * @param completion - The generated function body.
 * @returns Whether the code passed all tests.
 */
export async function scoreHumanEval(
	task: HumanEvalTask,
	completion: string,
): Promise<{ passed: boolean; error?: string }> {
	const code = `${task.prompt + completion}\n\n${task.test}`
	return runPythonCheck(code, 30_000)
}
