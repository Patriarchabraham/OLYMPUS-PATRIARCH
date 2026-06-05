import { describe, it, expect } from 'vitest'
import { topologicalSort, findReadyTasks, prioritizeTasks } from '../taskScheduler.js'
import type { ScheduledTask } from '../types.js'

function makeTask(overrides: Partial<ScheduledTask> & { id: string }): ScheduledTask {
	return {
		title: overrides.id,
		description: '',
		assignedToId: 'agent_1',
		priority: 1,
		status: 'pending',
		dependencies: [],
		qualityScore: 0,
		...overrides,
	}
}

describe('taskScheduler', () => {
	describe('topologicalSort', () => {
		it('sorts tasks respecting dependencies', () => {
			const tasks = [
				makeTask({ id: 'c', dependencies: ['a', 'b'] }),
				makeTask({ id: 'a', dependencies: [] }),
				makeTask({ id: 'b', dependencies: ['a'] }),
			]

			const sorted = topologicalSort(tasks)
			const order = sorted.map((t) => t.id)

			expect(order.indexOf('a')).toBeLessThan(order.indexOf('b'))
			expect(order.indexOf('a')).toBeLessThan(order.indexOf('c'))
			expect(order.indexOf('b')).toBeLessThan(order.indexOf('c'))
		})

		it('handles circular dependencies gracefully', () => {
			const tasks = [
				makeTask({ id: 'a', dependencies: ['b'] }),
				makeTask({ id: 'b', dependencies: ['a'] }),
			]

			const sorted = topologicalSort(tasks)
			expect(sorted.length).toBeGreaterThan(0)
		})
	})

	describe('findReadyTasks', () => {
		it('finds tasks with all dependencies completed', () => {
			const tasks = [
				makeTask({ id: 'a', status: 'completed' }),
				makeTask({ id: 'b', status: 'pending', dependencies: ['a'] }),
				makeTask({ id: 'c', status: 'pending', dependencies: ['a'] }),
			]

			const ready = findReadyTasks(tasks)
			expect(ready.map((t) => t.id)).toEqual(expect.arrayContaining(['b', 'c']))
		})

		it('excludes tasks with incomplete dependencies', () => {
			const tasks = [
				makeTask({ id: 'a', status: 'pending' }),
				makeTask({ id: 'b', status: 'pending', dependencies: ['a'] }),
			]

			const ready = findReadyTasks(tasks)
			expect(ready.map((t) => t.id)).not.toContain('b')
		})
	})

	describe('prioritizeTasks', () => {
		it('sorts ready tasks by priority descending', () => {
			const tasks = [
				makeTask({ id: 'low', priority: 1 }),
				makeTask({ id: 'high', priority: 10 }),
				makeTask({ id: 'med', priority: 5 }),
			]

			const prioritized = prioritizeTasks(tasks)
			expect(prioritized.map((t) => t.id)).toEqual(['high', 'med', 'low'])
		})
	})
})
