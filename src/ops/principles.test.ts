import { describe, expect, it } from 'vitest'
import { OPS_PRD, OPS_PRD_COMPRESSED, OPS_PRD_SECTIONS, OPS_PRD_VERSION } from './principles.js'

describe('ops principles — the knowledge that dresses the LLM', () => {
	it('has a version + non-empty PRD + compressed digest', () => {
		expect(OPS_PRD_VERSION).toMatch(/^\d{4}\./)
		expect(OPS_PRD.length).toBeGreaterThan(500)
		expect(OPS_PRD_COMPRESSED.length).toBeGreaterThan(300)
		expect(OPS_PRD_COMPRESSED.length).toBeLessThan(OPS_PRD.length)
	})

	it('compressed carries the mission, safety bar, surfaces, and governance', () => {
		const c = OPS_PRD_COMPRESSED.toLowerCase()
		for (const needle of [
			'agentic operations',
			'opt-in',
			'approval',
			'computer use',
			'browser',
			'vision',
			'teams',
			'governance',
		]) {
			expect(c).toContain(needle)
		}
	})

	it('safety section is non-negotiable and mentions destructive + look-before-act', () => {
		const s = OPS_PRD_SECTIONS.safety.toLowerCase()
		expect(s).toContain('destructive')
		expect(s).toContain('look before you act')
		expect(s).toContain('least privilege')
	})

	it('references 2026 SOTA grounding', () => {
		const sources = OPS_PRD_SECTIONS.sources.toLowerCase()
		expect(sources).toContain('computer use')
		expect(sources).toContain('playwright')
		expect(sources).toContain('whisper')
	})
})
