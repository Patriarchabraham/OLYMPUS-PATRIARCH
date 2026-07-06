import { describe, expect, it } from 'vitest'
import { DEFAULT_MARKETING_CONFIG } from '../../../marketing/marketingEngine.js'
import {
	MARKETING_AGENT_TYPES,
	MARKETING_AGENTS,
	MARKETING_COPYWRITER_AGENT,
	MARKETING_CURATOR_AGENT,
	MARKETING_DESIGNER_AGENT,
	MARKETING_DIRECTOR_AGENT,
	MARKETING_EMAIL_MANAGER_AGENT,
	MARKETING_SOCIAL_MANAGER_AGENT,
} from './marketingAgents.js'

describe('marketing built-in agents — the department employees', () => {
	it('defines one agent per role (9 specialists)', () => {
		expect(MARKETING_AGENTS.length).toBe(9)
		for (const a of MARKETING_AGENTS) {
			expect(a.agentType.startsWith('marketing-')).toBe(true)
			expect(a.source).toBe('built-in')
			expect(a.baseDir).toBe('built-in')
			expect(a.omitClaudeMd).toBe(true)
		}
	})

	it('every agent has a non-empty whenToUse and a substantive system prompt', () => {
		for (const a of MARKETING_AGENTS) {
			expect(a.whenToUse.length).toBeGreaterThan(0)
			const prompt = a.getSystemPrompt({ toolUseContext: { options: {} } as any })
			expect(prompt.length).toBeGreaterThan(200)
			expect(prompt).toContain('Marketing')
			expect(prompt).toContain(DEFAULT_MARKETING_CONFIG.prdVersion)
			// the publish-gate safety bar is in every prompt
			expect(prompt.toLowerCase()).toContain('approval')
		}
	})

	it('MARKETING_AGENT_TYPES covers every role', () => {
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
			expect(MARKETING_AGENT_TYPES.has(expected)).toBe(true)
		}
	})

	it('director is the admin of admins; curator updates the database', () => {
		const dir = MARKETING_DIRECTOR_AGENT.getSystemPrompt({ toolUseContext: { options: {} } as any })
		expect(dir).toContain('admin of admins')
		const cur = MARKETING_CURATOR_AGENT.getSystemPrompt({ toolUseContext: { options: {} } as any })
		expect(cur).toContain('database')
	})

	it('social + email managers carry the publish gate + log discipline', () => {
		const soc = MARKETING_SOCIAL_MANAGER_AGENT.getSystemPrompt({
			toolUseContext: { options: {} } as any,
		})
		expect(soc.toLowerCase()).toContain('approval')
		expect(soc.toLowerCase()).toContain('logged')
		const em = MARKETING_EMAIL_MANAGER_AGENT.getSystemPrompt({
			toolUseContext: { options: {} } as any,
		})
		expect(em.toLowerCase()).toContain('approval')
		expect(em.toLowerCase()).toContain('double opt-in')
	})

	it('copywriter + designer carry brand-voice + on-brand creative discipline', () => {
		const copy = MARKETING_COPYWRITER_AGENT.getSystemPrompt({
			toolUseContext: { options: {} } as any,
		})
		expect(copy.toLowerCase()).toContain('brand voice')
		const des = MARKETING_DESIGNER_AGENT.getSystemPrompt({ toolUseContext: { options: {} } as any })
		expect(des).toContain('ImageGen')
	})
})
