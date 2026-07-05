import { describe, expect, it } from 'vitest'
import { DEFAULT_STUDIO_CONFIG } from '../../../studio/studioEngine.js'
import {
	STUDIO_AGENT_TYPES,
	STUDIO_AGENTS,
	STUDIO_ANDROID_AGENT,
	STUDIO_CURATOR_AGENT,
	STUDIO_DIRECTOR_AGENT,
	STUDIO_EFFECTS_AGENT,
	STUDIO_QA_AGENT,
	STUDIO_WEB_AGENT,
	STUDIO_WINDOWS_AGENT,
} from './studioAgents.js'

describe('studio built-in agents — the department employees', () => {
	it('defines one agent per role (12 specialists)', () => {
		expect(STUDIO_AGENTS.length).toBe(12)
		for (const a of STUDIO_AGENTS) {
			expect(a.agentType.startsWith('studio-')).toBe(true)
			expect(a.source).toBe('built-in')
			expect(a.baseDir).toBe('built-in')
			expect(a.omitClaudeMd).toBe(true)
		}
	})

	it('every agent has a non-empty whenToUse and a substantive system prompt', () => {
		for (const a of STUDIO_AGENTS) {
			expect(a.whenToUse.length).toBeGreaterThan(0)
			const prompt = a.getSystemPrompt({ toolUseContext: { options: {} } as any })
			expect(prompt.length).toBeGreaterThan(200)
			expect(prompt).toContain('Studio')
			expect(prompt).toContain(DEFAULT_STUDIO_CONFIG.prdVersion)
		}
	})

	it('STUDIO_AGENT_TYPES covers every role', () => {
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
			expect(STUDIO_AGENT_TYPES.has(expected)).toBe(true)
		}
	})

	it('engineers carry an allowlist of build tools', () => {
		for (const engineer of [STUDIO_WEB_AGENT, STUDIO_ANDROID_AGENT, STUDIO_WINDOWS_AGENT]) {
			expect(engineer.tools).toBeDefined()
			expect(engineer.tools!.length).toBeGreaterThan(0)
			expect(engineer.tools).toContain('FileEdit')
		}
	})

	it('windows agent prompt is grounded in Fluent + WinUI', () => {
		const p = STUDIO_WINDOWS_AGENT.getSystemPrompt({ toolUseContext: { options: {} } as any })
		expect(p).toContain('Fluent')
		expect(p).toContain('WinUI')
		expect(p).toContain('Mica')
	})

	it('android agent prompt references Compose', () => {
		const p = STUDIO_ANDROID_AGENT.getSystemPrompt({ toolUseContext: { options: {} } as any })
		expect(p).toContain('Compose')
	})

	it('effects agent prompt names the web motion stack', () => {
		const p = STUDIO_EFFECTS_AGENT.getSystemPrompt({ toolUseContext: { options: {} } as any })
		expect(p).toContain('GSAP')
	})

	it('director is the admin of admins; qa enforces the definition of done; curator updates the database', () => {
		const dir = STUDIO_DIRECTOR_AGENT.getSystemPrompt({ toolUseContext: { options: {} } as any })
		expect(dir).toContain('admin of admins')
		const qa = STUDIO_QA_AGENT.getSystemPrompt({ toolUseContext: { options: {} } as any })
		expect(qa.toLowerCase()).toContain('definition of done')
		const cur = STUDIO_CURATOR_AGENT.getSystemPrompt({ toolUseContext: { options: {} } as any })
		expect(cur).toContain('database')
	})
})
