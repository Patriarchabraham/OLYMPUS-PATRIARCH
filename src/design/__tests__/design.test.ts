import { describe, expect, it } from 'vitest'
import {
	contrastRatio,
	wcagLevel,
	checkContrast,
	checkTypeScale,
	checkSpacingGrid,
	designScore,
	tokensToCSSVars,
	SPACING,
	ROYAL_BLUE,
	DARK_BASE,
} from '../index.js'
import type { RGB } from '../tokens.js'

const white: RGB = { r: 255, g: 255, b: 255 }
const black: RGB = { r: 0, g: 0, b: 0 }

describe('WCAG contrast', () => {
	it('black on white = 21:1 (max)', () => {
		expect(contrastRatio(black, white)).toBeCloseTo(21, 0)
	})
	it('same color = 1:1', () => {
		expect(contrastRatio(white, white)).toBeCloseTo(1, 1)
	})
	it('royal blue on dark base passes AA-large (accent/large use, ~3.4:1)', () => {
		const r = contrastRatio(ROYAL_BLUE, DARK_BASE)
		expect(r).toBeGreaterThan(3.0) // AA-large: brand blue is accent/large, not body text
		expect(wcagLevel(r)).not.toBe('fail')
	})
	it('checkContrast returns level + pass', () => {
		const c = checkContrast(black, white)
		expect(c.level).toBe('AAA')
		expect(c.pass).toBe(true)
	})
})

describe('type scale consistency', () => {
	it('a perfect 1.25 ratio scale is consistent', () => {
		const sizes = [16, 20, 25, 31.25, 39]
		const check = checkTypeScale(sizes, 1.25)
		expect(check.consistent).toBe(true)
	})
	it('an irregular scale is inconsistent', () => {
		expect(checkTypeScale([16, 30, 33, 50], 1.25).consistent).toBe(false)
	})
})

describe('spacing grid', () => {
	it('all multiples of 4 are adherent', () => {
		expect(checkSpacingGrid([4, 8, 12, 16, 24, 32]).adherent).toBe(true)
	})
	it('off-grid values are flagged', () => {
		const c = checkSpacingGrid([4, 7, 16, 33], 4)
		expect(c.adherent).toBe(false)
		expect(c.offGrid).toEqual([7, 33])
	})
})

describe('designScore', () => {
	it('100 when all fundamentals pass', () => {
		const s = designScore([{ fg: white, bg: black }], [16, 20, 25], [4, 8, 16])
		expect(s.contrastFailures).toBe(0)
		expect(s.scaleConsistent).toBe(true)
		expect(s.spacingAdherent).toBe(true)
		expect(s.score).toBe(100)
	})
	it('lower score when contrast fails', () => {
		const s = designScore([{ fg: white, bg: white }], [16, 20], [4, 8])
		expect(s.contrastFailures).toBe(1)
		expect(s.score).toBeLessThan(100)
	})
})

describe('tokens export', () => {
	it('tokensToCSSVars produces valid CSS with brand + spacing', () => {
		const css = tokensToCSSVars()
		expect(css).toContain(':root')
		expect(css).toContain(`--space-2: ${SPACING[2]}px`)
		expect(css).toContain('--brand: rgb(65,105,225)')
	})
})
