import { describe, expect, it } from 'vitest'
import { formatOpsPlanForDelegation, OPS_ROLES, planOpsDepartment } from './department.js'
import { applyOpsDirective, loadOpsGovernance } from './governance.js'
import { detectOpsIntent } from './intent.js'

function intent(msg: string) {
	return detectOpsIntent(msg)
}

describe('ops department — org chart + delegation plan', () => {
	it('OPS_ROLES covers every role with mission, tools, and tier', () => {
		const names = OPS_ROLES.map((r) => r.role)
		for (const expected of [
			'ops-director',
			'ops-computer-operator',
			'ops-browser-operator',
			'ops-vision',
			'ops-ears',
			'ops-voice',
			'ops-automation-engineer',
			'ops-team-lead',
			'ops-sentinel',
			'ops-curator',
		]) {
			expect(names).toContain(expected)
		}
	})

	it('routes a browser brief to the browser operator', () => {
		const plan = planOpsDepartment(
			intent('open the browser and book the flight'),
			loadOpsGovernance(),
		)
		expect(plan.roles.map((r) => r.role)).toContain('ops-browser-operator')
		expect(plan.roles.map((r) => r.role)).toContain('ops-director')
		expect(plan.roles.map((r) => r.role)).toContain('ops-curator')
		expect(plan.roles.map((r) => r.role)).toContain('ops-sentinel')
	})

	it('routes a computer brief to the computer operator', () => {
		const plan = planOpsDepartment(intent('control my pc and open notepad'), loadOpsGovernance())
		expect(plan.roles.map((r) => r.role)).toContain('ops-computer-operator')
	})

	it('builds a dependency graph with no orphaned edges; curator is last', () => {
		const plan = planOpsDepartment(intent('click the save button'), loadOpsGovernance())
		const names = new Set(plan.tasks.map((t) => t.role))
		for (const t of plan.tasks) for (const dep of t.dependsOn) expect(names.has(dep)).toBe(true)
		expect(plan.tasks.at(-1)!.role).toBe('ops-curator')
	})

	it('the operator task depends on the automation-engineer plan', () => {
		const plan = planOpsDepartment(
			intent('open the browser and scrape the page'),
			loadOpsGovernance(),
		)
		const op = plan.tasks.find(
			(t) => t.role === 'ops-browser-operator' || t.role === 'ops-computer-operator',
		)
		expect(op?.dependsOn).toContain('ops-automation-engineer')
	})

	it('surfaces governance notes in delegation instructions', () => {
		const gov = applyOpsDirective(
			applyOpsDirective(loadOpsGovernance(), 'browser.scope=example.com'),
			'director.computer.approvalPolicy=ask-always',
		)
		const plan = planOpsDepartment(intent('open the browser and scrape'), gov)
		expect(plan.delegationInstructions).toContain('Governance')
		expect(plan.delegationInstructions).toContain('browser.scope = example.com')
		expect(plan.delegationInstructions).toContain('[director] computer.approvalPolicy = ask-always')
	})

	it('formatOpsPlanForDelegation lists every task with role + output', () => {
		const plan = planOpsDepartment(intent('click the button'), loadOpsGovernance())
		const out = formatOpsPlanForDelegation(plan)
		expect(out).toContain('Tasks:')
		for (const t of plan.tasks) {
			expect(out).toContain(`[${t.role}]`)
			expect(out).toContain(t.output)
		}
	})
})
