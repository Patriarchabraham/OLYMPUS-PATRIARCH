import { describe, expect, it } from 'vitest'
import { DEFAULT_OPS_CONFIG } from '../../../ops/opsEngine.js'
import {
	OPS_AGENT_TYPES,
	OPS_AGENTS,
	OPS_AUTOMATION_ENGINEER_AGENT,
	OPS_BROWSER_OPERATOR_AGENT,
	OPS_COMPUTER_OPERATOR_AGENT,
	OPS_CURATOR_AGENT,
	OPS_DIRECTOR_AGENT,
	OPS_SENTINEL_AGENT,
} from './opsAgents.js'

describe('ops built-in agents — the department employees', () => {
	it('defines one agent per role (10 specialists)', () => {
		expect(OPS_AGENTS.length).toBe(10)
		for (const a of OPS_AGENTS) {
			expect(a.agentType.startsWith('ops-')).toBe(true)
			expect(a.source).toBe('built-in')
			expect(a.baseDir).toBe('built-in')
			expect(a.omitClaudeMd).toBe(true)
		}
	})

	it('every agent has a non-empty whenToUse and a substantive system prompt', () => {
		for (const a of OPS_AGENTS) {
			expect(a.whenToUse.length).toBeGreaterThan(0)
			const prompt = a.getSystemPrompt({ toolUseContext: { options: {} } as any })
			expect(prompt.length).toBeGreaterThan(200)
			expect(prompt).toContain('Ops')
			expect(prompt).toContain(DEFAULT_OPS_CONFIG.prdVersion)
			// safety bar is in every prompt
			expect(prompt.toLowerCase()).toContain('approval gate')
		}
	})

	it('OPS_AGENT_TYPES covers every role', () => {
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
			expect(OPS_AGENT_TYPES.has(expected)).toBe(true)
		}
	})

	it('operators carry an allowlist of control tools', () => {
		for (const op of [OPS_COMPUTER_OPERATOR_AGENT, OPS_BROWSER_OPERATOR_AGENT]) {
			expect(op.tools).toBeDefined()
			expect(op.tools!.length).toBeGreaterThan(0)
		}
	})

	it('computer operator prompt is grounded in Windows + look-before-act', () => {
		const p = OPS_COMPUTER_OPERATOR_AGENT.getSystemPrompt({
			toolUseContext: { options: {} } as any,
		})
		expect(p).toContain('Windows')
		expect(p.toLowerCase()).toContain('look before you act')
	})

	it('browser operator prompt honors the scope allowlist', () => {
		const p = OPS_BROWSER_OPERATOR_AGENT.getSystemPrompt({ toolUseContext: { options: {} } as any })
		expect(p).toContain('browser.scope')
	})

	it('automation engineer authors the deterministic plan', () => {
		const p = OPS_AUTOMATION_ENGINEER_AGENT.getSystemPrompt({
			toolUseContext: { options: {} } as any,
		})
		expect(p.toLowerCase()).toContain('deterministic plan')
	})

	it('director is the admin of admins; sentinel guards; curator updates the database', () => {
		const dir = OPS_DIRECTOR_AGENT.getSystemPrompt({ toolUseContext: { options: {} } as any })
		expect(dir).toContain('admin of admins')
		const sen = OPS_SENTINEL_AGENT.getSystemPrompt({ toolUseContext: { options: {} } as any })
		expect(sen.toLowerCase()).toContain('safety officer')
		const cur = OPS_CURATOR_AGENT.getSystemPrompt({ toolUseContext: { options: {} } as any })
		expect(cur).toContain('database')
	})
})
