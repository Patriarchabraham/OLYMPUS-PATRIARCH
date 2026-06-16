import { describe, expect, it } from 'vitest'
import { executeMilestone } from '../taskRunner.js'
import type { Milestone } from '../types.js'
import { DEFAULT_CONFIG } from '../types.js'

function makeMilestone(): Milestone {
	return { id: 'm1', title: 'T', description: 'do something useful', status: 'pending' }
}

describe('executeMilestone', () => {
	it('runs the provided executeStep and records its result', async () => {
		const milestone = makeMilestone()
		await executeMilestone(
			milestone,
			DEFAULT_CONFIG,
			{ executeStep: async () => ({ result: 'done', notes: 'shipped' }) },
			'goal-1',
		)
		expect(milestone.status).toBe('in_progress')
		expect(milestone.result).toContain('done')
		expect(milestone.result).toContain('shipped')
	})

	it('records an honest sentinel when no executor is wired', async () => {
		const milestone = makeMilestone()
		await executeMilestone(milestone, DEFAULT_CONFIG, undefined, 'goal-1')
		expect(milestone.result).toBe('Skipped: no step executor wired')
	})

	it('records the sentinel when goalId is missing even if executeStep is present', async () => {
		const milestone = makeMilestone()
		await executeMilestone(
			milestone,
			DEFAULT_CONFIG,
			{ executeStep: async () => ({ result: 'x' }) },
			undefined,
		)
		expect(milestone.result).toBe('Skipped: no step executor wired')
	})
})
