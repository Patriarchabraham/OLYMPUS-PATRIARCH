import { describe, expect, it } from 'vitest'
import { formatPlanForDelegation, planDepartment, STUDIO_ROLES } from './department.js'
import { applyAdminDirective, loadGovernance } from './governance.js'
import { detectStudioIntent } from './intent.js'
import type { StudioIntent, StudioRole } from './types.js'

function intent(msg: string): StudioIntent {
	return detectStudioIntent(msg)
}

describe('studio department — org chart + delegation plan', () => {
	it('STUDIO_ROLES covers every role with mission, tools, and tier', () => {
		const names = STUDIO_ROLES.map((r) => r.role)
		for (const expected of [
			'studio-director',
			'studio-researcher',
			'studio-design-system',
			'studio-ux',
			'studio-ui',
			'studio-copy',
			'studio-effects',
			'studio-web',
			'studio-android',
			'studio-windows',
			'studio-qa',
			'studio-curator',
		]) {
			expect(names).toContain(expected)
		}
		const role = STUDIO_ROLES.find((r) => r.role === 'studio-director') as StudioRole
		expect(role.mission.length).toBeGreaterThan(0)
		expect(role.tools.length).toBeGreaterThan(0)
		expect(['flagship', 'balanced', 'fast']).toContain(role.modelTier)
	})

	it('routes a web brief to the web engineer and excludes native engineers', () => {
		const plan = planDepartment(intent('build a landing page for a fintech'), loadGovernance())
		const roles = plan.roles.map((r) => r.role)
		expect(roles).toContain('studio-web')
		expect(roles).not.toContain('studio-android')
		expect(roles).not.toContain('studio-windows')
		expect(roles).toContain('studio-director')
		expect(roles).toContain('studio-curator')
	})

	it('routes an Android brief to the Android engineer', () => {
		const plan = planDepartment(intent('create an android app in Kotlin'), loadGovernance())
		expect(plan.roles.map((r) => r.role)).toContain('studio-android')
		expect(plan.roles.map((r) => r.role)).not.toContain('studio-windows')
		expect(plan.roles.map((r) => r.role)).not.toContain('studio-web')
	})

	it('routes a Windows brief to the Windows engineer', () => {
		const plan = planDepartment(
			intent('generate a Windows 11 desktop app with WinUI'),
			loadGovernance(),
		)
		expect(plan.roles.map((r) => r.role)).toContain('studio-windows')
		expect(plan.roles.map((r) => r.role)).not.toContain('studio-android')
	})

	it('default-routes an unknown platform to the web engineer', () => {
		const plan = planDepartment(intent('build an app for managing tasks'), loadGovernance())
		expect(plan.roles.map((r) => r.role)).toContain('studio-web')
	})

	it('builds a dependency graph with no orphaned edges', () => {
		const plan = planDepartment(intent('build a website'), loadGovernance())
		const names = new Set(plan.tasks.map((t) => t.role))
		for (const t of plan.tasks) {
			for (const dep of t.dependsOn) expect(names.has(dep)).toBe(true)
		}
		expect(plan.tasks[0]!.dependsOn).toEqual([]) // research has no deps
		expect(plan.tasks.at(-1)!.role).toBe('studio-curator') // curator is last
	})

	it('the build task depends on ui, effects, and copy', () => {
		const plan = planDepartment(intent('build a landing page'), loadGovernance())
		const build = plan.tasks.find((t) => t.role === 'studio-web')
		expect(build?.dependsOn.sort()).toEqual(['studio-copy', 'studio-effects', 'studio-ui'])
	})

	it('surfaces governance notes in the delegation instructions', () => {
		const gov = applyAdminDirective(
			applyAdminDirective(loadGovernance(), 'effects.requiredLibs=gsap'),
			'director.windows.stack=winui3',
		)
		const plan = planDepartment(intent('build a windows desktop app'), gov)
		expect(plan.delegationInstructions).toContain('Governance')
		expect(plan.delegationInstructions).toContain('effects.requiredLibs = gsap')
		expect(plan.delegationInstructions).toContain('[director] windows.stack = winui3')
	})

	it('references the definition of done', () => {
		const plan = planDepartment(intent('build an app'), loadGovernance())
		expect(plan.delegationInstructions.toLowerCase()).toContain('definition of done')
		expect(plan.delegationInstructions).toContain('WCAG-AA')
	})

	it('formatPlanForDelegation lists every task with role + output', () => {
		const plan = planDepartment(intent('build a website'), loadGovernance())
		const out = formatPlanForDelegation(plan)
		expect(out).toContain('Tasks:')
		for (const t of plan.tasks) {
			expect(out).toContain(`[${t.role}]`)
			expect(out).toContain(t.output)
		}
	})

	it('delegation names the engineer role matching the platform', () => {
		const android = planDepartment(intent('create an android app'), loadGovernance())
		expect(android.delegationInstructions).toContain('studio-android')
		const windows = planDepartment(intent('generate a windows 11 desktop app'), loadGovernance())
		expect(windows.delegationInstructions).toContain('studio-windows')
	})
})
