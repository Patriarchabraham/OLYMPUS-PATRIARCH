import { describe, it, expect } from 'vitest'
import type { DepartmentTemplate } from '../types.js'
import { spawnDepartmentAgents, spawnCompanyWorkforce, spawnVerificationAgents } from '../agentFactory.js'

const mockDepartment: DepartmentTemplate = {
	name: 'Engineering',
	type: 'core',
	agents: [
		{ name: 'Dev Lead', role: 'Lead Developer', agentType: 'manager', capabilities: ['code_review'], expertiseWeight: 1.8 },
		{ name: 'Dev Junior', role: 'Junior Developer', agentType: 'worker', capabilities: ['coding'], expertiseWeight: 1.0 },
	],
}

describe('agentFactory', () => {
	describe('spawnDepartmentAgents', () => {
		it('spawns agents from department template', () => {
			const agents = spawnDepartmentAgents(mockDepartment)
			expect(agents).toHaveLength(2)
			expect(agents[0].role).toBe('Lead Developer')
			expect(agents[0].agentType).toBe('manager')
			expect(agents[0].departmentName).toBe('Engineering')
		})

		it('respects custom count parameter', () => {
			const agents = spawnDepartmentAgents(mockDepartment, 5)
			expect(agents).toHaveLength(5)
		})

		it('merges type capabilities with template capabilities', () => {
			const agents = spawnDepartmentAgents(mockDepartment)
			expect(agents[0].capabilities).toContain('code_review')
			expect(agents[0].capabilities).toContain('task_assignment') // manager capability
		})

		it('generates unique IDs for each agent', () => {
			const agents = spawnDepartmentAgents(mockDepartment, 10)
			const ids = agents.map((a) => a.id)
			expect(new Set(ids).size).toBe(ids.length)
		})
	})

	describe('spawnVerificationAgents', () => {
		it('spawns exactly 3 verifier agents', () => {
			const agents = spawnVerificationAgents()
			expect(agents).toHaveLength(3)
		})

		it('all verifiers have correct type', () => {
			const agents = spawnVerificationAgents()
			for (const agent of agents) {
				expect(agent.agentType).toBe('verifier')
			}
		})

		it('verifiers have high expertise weight', () => {
			const agents = spawnVerificationAgents()
			for (const agent of agents) {
				expect(agent.expertiseWeight).toBe(1.8)
			}
		})
	})

	describe('spawnCompanyWorkforce', () => {
		it('spawns agents for all departments', () => {
			const departments: DepartmentTemplate[] = [
				mockDepartment,
				{ name: 'Sales', type: 'support' as const, agents: [{ name: 'Seller', role: 'Sales Rep', agentType: 'worker' as const, capabilities: ['sales'], expertiseWeight: 1.0 }] },
			]
			const workforce = spawnCompanyWorkforce(departments)
			expect(workforce.size).toBe(2)
			expect(workforce.has('Engineering')).toBe(true)
			expect(workforce.has('Sales')).toBe(true)
		})
	})
})
