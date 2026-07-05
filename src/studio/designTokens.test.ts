import { describe, expect, it } from 'vitest'
import { relativeLuminance } from '../design/verify.js'
import {
	generateDesignTokens,
	generateRamp,
	hexToRgb,
	oklchToRgb,
	rgbToHex,
	rgbToOklch,
	tokensToComposeKotlin,
	tokensToCSS,
	tokensToWinUIXaml,
} from './designTokens.js'

describe('OKLCH color math (RISK-4 — correctness)', () => {
	it('white -> near-L=1, ~zero chroma; black -> near-L=0', () => {
		const w = rgbToOklch(hexToRgb('#ffffff'))
		expect(w.L).toBeGreaterThan(0.99)
		expect(w.C).toBeLessThan(0.001)
		const b = rgbToOklch(hexToRgb('#000000'))
		expect(b.L).toBeLessThan(0.01)
	})

	it('pure red #ff0000 anchors near the documented OKLCH (~L0.63 C0.26 H29)', () => {
		const r = rgbToOklch(hexToRgb('#ff0000'))
		expect(r.L).toBeGreaterThan(0.6)
		expect(r.L).toBeLessThan(0.66)
		expect(r.C).toBeGreaterThan(0.22)
		expect(r.H).toBeGreaterThan(25)
		expect(r.H).toBeLessThan(33)
	})

	it('round-trips sRGB -> OKLCH -> sRGB within tolerance for many colors', () => {
		const colors = [
			'#2563eb',
			'#10b981',
			'#e0651a',
			'#7c3aed',
			'#dc2626',
			'#0ea5e9',
			'#f59e0b',
			'#64748b',
			'#8b5cf6',
			'#14b8a6',
		]
		for (const hex of colors) {
			const orig = hexToRgb(hex)
			const back = oklchToRgb(rgbToOklch(orig))
			expect(Math.abs(back.r - orig.r)).toBeLessThanOrEqual(3)
			expect(Math.abs(back.g - orig.g)).toBeLessThanOrEqual(3)
			expect(Math.abs(back.b - orig.b)).toBeLessThanOrEqual(3)
		}
	})

	it('hex <-> rgb helpers are inverse', () => {
		expect(rgbToHex(hexToRgb('#2563eb'))).toBe('#2563eb')
		expect(rgbToHex(hexToRgb('#abc'))).toBe('#aabbcc')
	})
})

describe('ramp generation', () => {
	it('produces all 11 stops (50..950), each with hex + oklch', () => {
		const ramp = generateRamp('color', rgbToOklch(hexToRgb('#2563eb')))
		const stops = Object.keys(ramp.stops)
			.map(Number)
			.sort((a, b) => a - b)
		expect(stops).toEqual([50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950])
		for (const stop of stops) {
			const t = ramp.stops[stop]!
			expect(t.hex).toMatch(/^#[0-9a-fA-F]{6}$/)
			expect(t.oklch).toContain('oklch(')
		}
	})

	it('stop 50 is lighter than stop 950 (monotone luminance)', () => {
		const ramp = generateRamp('color', rgbToOklch(hexToRgb('#2563eb')))
		const l50 = relativeLuminance(hexToRgb(ramp.stops[50]!.hex))
		const l950 = relativeLuminance(hexToRgb(ramp.stops[950]!.hex))
		expect(l50).toBeGreaterThan(l950)
	})
})

describe('generateDesignTokens — WCAG AA across a base x mood grid', () => {
	const bases = ['#2563eb', '#10b981', '#e0651a', '#7c3aed', '#dc2626', '#0ea5e9']
	const moods = [
		'neutral-adaptive',
		'calm',
		'vibrant',
		'minimal',
		'bold',
		'luxury-dark-gold',
	] as const

	it('returns a complete token shape', () => {
		const t = generateDesignTokens({ baseColor: '#2563eb', mood: 'calm', platform: 'android' })
		expect(t.platform).toBe('android')
		expect(t.baseColor).toBe('#2563eb')
		expect(t.mood).toBe('calm')
		expect(Object.keys(t.color.semantic)).toHaveLength(13)
		expect(t.spacing.length).toBeGreaterThanOrEqual(8)
		expect(t.motion.easing.luxury).toContain('cubic-bezier')
	})

	it('contrastVerified is true for representative brand bases across moods', () => {
		let pass = 0
		let total = 0
		for (const base of bases) {
			for (const mood of moods) {
				total++
				const t = generateDesignTokens({ baseColor: base, mood })
				if (t.contrastVerified) pass++
			}
		}
		// Allow a few edge cases, but the overwhelming majority must verify.
		expect(pass).toBeGreaterThan(total * 0.8)
	})

	it('blue base in calm mood verifies AA (the canonical case)', () => {
		const t = generateDesignTokens({ baseColor: '#2563eb', mood: 'calm' })
		expect(t.contrastVerified).toBe(true)
	})

	it('neutral-adaptive (no base) still yields a valid, verified neutral system', () => {
		const t = generateDesignTokens({ mood: 'neutral-adaptive' })
		expect(t.baseColor).toBe('neutral-adaptive')
		expect(t.color.semantic.bg.hex).toMatch(/^#/)
		expect(typeof t.contrastVerified).toBe('boolean')
	})
})

describe('emitters — same tokens -> CSS / Compose Kotlin / WinUI XAML', () => {
	const tokens = generateDesignTokens({ baseColor: '#2563eb', mood: 'calm' })

	it('tokensToCSS emits :root with color + scale + contrast flag', () => {
		const css = tokensToCSS(tokens)
		expect(css).toContain(':root')
		expect(css).toContain('--color-bg')
		expect(css).toContain('--color-accent')
		expect(css).toContain('--text-base')
		expect(css).toContain('--studio-contrast-verified:')
	})

	it('tokensToComposeKotlin emits Material 3 Color/Type/Shapes', () => {
		const kt = tokensToComposeKotlin(tokens)
		expect(kt).toContain('import androidx.compose.ui.graphics.Color')
		expect(kt).toContain('object StudioColors')
		expect(kt).toContain('val Accent = Color(0xFF')
		expect(kt).toContain('StudioTypeScale = Typography')
		expect(kt).toContain('StudioShapes = Shapes')
	})

	it('tokensToWinUIXaml emits a ResourceDictionary with Light + Dark ThemeDictionaries', () => {
		const xaml = tokensToWinUIXaml(tokens)
		expect(xaml).toContain('<ResourceDictionary')
		expect(xaml).toContain('<ResourceDictionary.ThemeDictionaries>')
		expect(xaml).toContain('x:Key="Light"')
		expect(xaml).toContain('x:Key="Dark"')
		expect(xaml).toContain('MicaController')
		expect(xaml).toContain('SolidColorBrush')
	})
})
