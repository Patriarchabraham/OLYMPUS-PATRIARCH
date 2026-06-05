/**
 * Task Scheduler — dependency-aware task scheduling for agent workflows.
 * Topological sort with parallel execution of independent tasks.
 */

import type { ScheduledTask } from './types.js'

/**
 * Topological sort of tasks respecting dependencies.
 * Returns tasks in valid execution order. Circular dependencies are broken.
 */
export function topologicalSort(tasks: ScheduledTask[]): ScheduledTask[] {
	const taskMap = new Map(tasks.map((t) => [t.id, t]))
	const visited = new Set<string>()
	const visiting = new Set<string>()
	const sorted: ScheduledTask[] = []

	function visit(taskId: string): void {
		if (visited.has(taskId)) return
		if (visiting.has(taskId)) {
			// Circular dependency — break it
			return
		}

		visiting.add(taskId)
		const task = taskMap.get(taskId)
		if (task) {
			for (const depId of task.dependencies) {
				visit(depId)
			}
			visited.add(taskId)
			sorted.push(task)
		}
		visiting.delete(taskId)
	}

	for (const task of tasks) {
		visit(task.id)
	}

	return sorted
}

/**
 * Find tasks that are ready to execute (all dependencies completed).
 */
export function findReadyTasks(tasks: ScheduledTask[]): ScheduledTask[] {
	const completedIds = new Set(
		tasks.filter((t) => t.status === 'completed').map((t) => t.id),
	)

	return tasks.filter(
		(task) =>
			task.status === 'pending' && task.dependencies.every((depId) => completedIds.has(depId)),
	)
}

/**
 * Prioritize ready tasks by priority level (highest first).
 */
export function prioritizeTasks(tasks: ScheduledTask[]): ScheduledTask[] {
	const ready = findReadyTasks(tasks)
	return ready.sort((a, b) => b.priority - a.priority)
}

/**
 * Execute a batch of tasks in parallel with dependency resolution.
 * @param tasks - All tasks to schedule
 * @param executor - Function to execute each task
 * @param maxParallel - Maximum concurrent executions (default: 3)
 */
export async function executeBatch(
	tasks: ScheduledTask[],
	executor: (task: ScheduledTask) => Promise<{ success: boolean; result?: string }>,
	maxParallel = 3,
): Promise<Map<string, { success: boolean; result?: string }>> {
	const results = new Map<string, { success: boolean; result?: string }>()
	const sorted = topologicalSort(tasks)

	let index = 0

	async function runNext(): Promise<void> {
		while (index < sorted.length) {
			const task = sorted[index++]
			if (!task) break

			// Check dependencies
			const depsMet = task.dependencies.every((depId) => {
				const depResult = results.get(depId)
				return depResult?.success
			})

			if (!depsMet) {
				// Re-queue at end
				sorted.push(task)
				continue
			}

			try {
				const result = await executor(task)
				results.set(task.id, result)
			} catch {
				results.set(task.id, { success: false })
			}
		}
	}

	const workers = Array.from({ length: Math.min(maxParallel, sorted.length) }, () => runNext())

	await Promise.all(workers)
	return results
}
