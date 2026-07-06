import { describe, expect, it } from 'vitest'
import {
	MARKETING_PRD,
	MARKETING_PRD_COMPRESSED,
	MARKETING_PRD_INJECTION,
	MARKETING_PRD_SECTIONS,
	MARKETING_PRD_VERSION,
} from './principles.js'

describe('marketing principles — the PRD that dresses the LLM', () => {
	it('pins the PRD version (bump on a material change)', () => {
		expect(MARKETING_PRD_VERSION).toBe('2026.07.06')
	})

	it('MARKETING_PRD carries every section', () => {
		expect(MARKETING_PRD.toLowerCase()).toContain('mission')
		expect(MARKETING_PRD.toLowerCase()).toContain('campaign architecture')
		expect(MARKETING_PRD.toLowerCase()).toContain('brand voice')
		expect(MARKETING_PRD.toLowerCase()).toContain('publish gate')
		expect(MARKETING_PRD.toLowerCase()).toContain('analytics')
	})

	it('MARKETING_PRD_SECTIONS exposes the named blocks', () => {
		for (const key of ['mission', 'strategy', 'copy', 'publish', 'analytics'] as const) {
			expect(MARKETING_PRD_SECTIONS[key].length).toBeGreaterThan(0)
		}
	})

	it('the compressed digest carries the version + the non-negotiable publish gate', () => {
		expect(MARKETING_PRD_COMPRESSED).toContain(MARKETING_PRD_VERSION)
		expect(MARKETING_PRD_COMPRESSED.toLowerCase()).toContain('marketing')
		expect(MARKETING_PRD_COMPRESSED.toLowerCase()).toContain('approval')
		expect(MARKETING_PRD_COMPRESSED.toLowerCase()).toContain('published log')
	})

	it('MARKETING_PRD_INJECTION aliases the compressed digest', () => {
		expect(MARKETING_PRD_INJECTION).toBe(MARKETING_PRD_COMPRESSED)
	})
})
