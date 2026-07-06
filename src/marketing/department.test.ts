import { describe, expect, it } from 'vitest'
import { formatCampaignPlanForDelegation, MARKETING_ROLES, planCampaign } from './department.js'
import { loadMarketingGovernance, setMarketingPolicyFromDirective } from './governance.js'
import { detectMarketingIntent } from './intent.js'

describe('marketing department — the org chart + campaign planner', () => {
	it('defines the full specialist org chart', () => {
		const roles = MARKETING_ROLES.map((r) => r.role)
		expect(roles).toHaveLength(9)
		for (const expected of [
			'marketing-director',
			'marketing-strategist',
			'marketing-copywriter',
			'marketing-designer',
			'marketing-videographer',
			'marketing-social-manager',
			'marketing-email-manager',
			'marketing-analytics',
			'marketing-curator',
		]) {
			expect(roles).toContain(expected)
		}
		for (const r of MARKETING_ROLES) {
			expect(r.mission.length).toBeGreaterThan(0)
			expect(r.tools.length).toBeGreaterThan(0)
		}
	})

	it('plans a campaign ending with the curator', () => {
		const intent = detectMarketingIntent('launch campaign for Olympuz on x and linkedin')
		const plan = planCampaign(intent, loadMarketingGovernance())
		expect(plan.tasks.length).toBeGreaterThanOrEqual(5)
		expect(plan.tasks.at(-1)!.role).toBe('marketing-curator')
		const roleNames = plan.roles.map((r) => r.role)
		expect(roleNames).toContain('marketing-director')
		expect(roleNames).toContain('marketing-strategist')
		expect(roleNames).toContain('marketing-curator')
	})

	it('routes the lead specialist by kind (video → videographer, email → email-manager)', () => {
		const video = planCampaign(detectMarketingIntent('generate a video'), loadMarketingGovernance())
		expect(video.tasks.some((t) => t.role === 'marketing-videographer')).toBe(true)
		const email = planCampaign(
			detectMarketingIntent('send an email blast'),
			loadMarketingGovernance(),
		)
		expect(email.tasks.some((t) => t.role === 'marketing-email-manager')).toBe(true)
	})

	it('formatCampaignPlanForDelegation renders tasks + delegation instructions', () => {
		const plan = planCampaign(detectMarketingIntent('launch campaign'), loadMarketingGovernance())
		const text = formatCampaignPlanForDelegation(plan)
		expect(text.toLowerCase()).toContain('campaign plan')
		expect(text).toContain('Tasks:')
		expect(text).toContain('marketing-director')
	})

	it('injects governance notes into the delegation instructions', () => {
		const gov = setMarketingPolicyFromDirective(
			loadMarketingGovernance(),
			'director.publish.approvalPolicy=ask-always',
		)
		const plan = planCampaign(detectMarketingIntent('launch campaign'), gov)
		expect(plan.delegationInstructions).toContain('[director] publish.approvalPolicy = ask-always')
	})
})
