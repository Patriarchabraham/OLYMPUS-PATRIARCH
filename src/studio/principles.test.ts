import { describe, expect, it } from 'vitest'
import {
	STUDIO_PRD,
	STUDIO_PRD_COMPRESSED,
	STUDIO_PRD_SECTIONS,
	STUDIO_PRD_VERSION,
} from './principles.js'

describe('studio principles (PRD)', () => {
	it('exports a versioned, date-like PRD version', () => {
		expect(STUDIO_PRD_VERSION).toMatch(/^\d{4}\.\d{2}\.\d{2}$/)
	})

	it('STUDIO_PRD is a substantial, structured document', () => {
		expect(typeof STUDIO_PRD).toBe('string')
		expect(STUDIO_PRD.length).toBeGreaterThan(4000)
		// Mission + definition of done + the three platforms + governance all present.
		for (const needle of [
			'Olympuz Studio',
			'Definition of Done',
			'OKLCH',
			'WCAG',
			'Jetpack Compose',
			'WinUI 3',
			'GSAP',
			'admin of admins',
		]) {
			expect(STUDIO_PRD).toContain(needle)
		}
	})

	it('STUDIO_PRD covers web + Android + Windows first-class', () => {
		expect(STUDIO_PRD.toLowerCase()).toContain('android')
		expect(STUDIO_PRD.toLowerCase()).toContain('windows')
		expect(STUDIO_PRD.toLowerCase()).toContain('web')
	})

	it('STUDIO_PRD_COMPRESSED is a tight, non-empty digest shorter than the full PRD', () => {
		expect(typeof STUDIO_PRD_COMPRESSED).toBe('string')
		expect(STUDIO_PRD_COMPRESSED.length).toBeGreaterThan(800)
		// Injection budget guard: compressed must be materially smaller than full.
		expect(STUDIO_PRD_COMPRESSED.length).toBeLessThan(STUDIO_PRD.length * 0.6)
		expect(STUDIO_PRD_COMPRESSED).toContain(STUDIO_PRD_VERSION)
		// Carries the essentials so the LLM is "dressed" every turn.
		for (const needle of ['Definition of done', 'OKLCH', 'WinUI 3', 'admin of admins']) {
			expect(STUDIO_PRD_COMPRESSED.toLowerCase()).toContain(needle.toLowerCase())
		}
	})

	it('STUDIO_PRD_SECTIONS has every named section, each non-empty', () => {
		const keys = Object.keys(STUDIO_PRD_SECTIONS)
		expect(keys).toContain('mission')
		expect(keys).toContain('definitionOfDone')
		expect(keys).toContain('colorSystems')
		expect(keys).toContain('effectsWeb')
		expect(keys).toContain('effectsAndroid')
		expect(keys).toContain('effectsWindows')
		expect(keys).toContain('platformWindows')
		expect(keys).toContain('governance')
		for (const [, value] of Object.entries(STUDIO_PRD_SECTIONS)) {
			expect(typeof value).toBe('string')
			expect(value!.length).toBeGreaterThan(0)
		}
		// Section bodies are disjoint enough that the full PRD contains each.
		for (const [, value] of Object.entries(STUDIO_PRD_SECTIONS)) {
			expect(STUDIO_PRD).toContain(value as string)
		}
	})
})
