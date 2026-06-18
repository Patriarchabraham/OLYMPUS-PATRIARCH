/**
 * Design Verification — REAL, measured checks (not a "premium checklist").
 *
 * WCAG contrast (the actual relative-luminance formula), type-scale ratio
 * consistency, and spacing-grid adherence. These are the OBJECTIVE signals of
 * craft: a UI passes them before any "luxury" claim. Luxury that fails contrast
 * or grid is just clutter.
 */
import { SPACING, TYPE_SCALE, type RGB } from './tokens.js'

/** Relative luminance per WCAG 2.1 (sRGB). */
function channel(c: number): number {
	const s = c / 255
	return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}
export function relativeLuminance({ r, g, b }: RGB): number {
	return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

/** WCAG contrast ratio between two colors (1-21). */
export function contrastRatio(fg: RGB, bg: RGB): number {
	const l1 = relativeLuminance(fg)
	const l2 = relativeLuminance(bg)
	const light = Math.max(l1, l2)
	const dark = Math.min(l1, l2)
	return (light + 0.05) / (dark + 0.05)
}

export type WCAGLevel = 'fail' | 'AA-large' | 'AA' | 'AAA'
/** Classify a contrast ratio against WCAG thresholds. */
export function wcagLevel(ratio: number): WCAGLevel {
	if (ratio >= 7) return 'AAA'
	if (ratio >= 4.5) return 'AA'
	if (ratio >= 3) return 'AA-large'
	return 'fail'
}

export interface ContrastCheck {
	fg: RGB
	bg: RGB
	ratio: number
	level: WCAGLevel
	pass: boolean
}
/** Check a foreground/background pair (AA = pass for body text). */
export function checkContrast(fg: RGB, bg: RGB, requireAAA = false): ContrastCheck {
	const ratio = contrastRatio(fg, bg)
	const level = wcagLevel(ratio)
	const pass = requireAAA ? level === 'AAA' : level === 'AA' || level === 'AAA'
	return { fg, bg, ratio, level, pass }
}

export interface ScaleCheck {
	ratio: number
	expected: number
	consistent: boolean
}
/** Verify a type scale follows a consistent ratio between steps. */
export function checkTypeScale(sizes: number[], expected = TYPE_SCALE.ratio): ScaleCheck {
	if (sizes.length < 2) return { ratio: 0, expected, consistent: false }
	const ratios: number[] = []
	for (let i = 1; i < sizes.length; i++) ratios.push(sizes[i]! / sizes[i - 1]!)
	const avg = ratios.reduce((s, r) => s + r, 0) / ratios.length
	// Consistent if every step is within 5% of the expected ratio.
	const consistent = ratios.every((r) => Math.abs(r - expected) <= expected * 0.05)
	return { ratio: avg, expected, consistent }
}

export interface SpacingCheck {
	base: number
	values: number[]
	offGrid: number[]
	adherent: boolean
}
/** Verify every spacing value is a multiple of the base grid. */
export function checkSpacingGrid(values: number[], base = SPACING.base): SpacingCheck {
	const offGrid = values.filter((v) => v % base !== 0)
	return { base, values, offGrid, adherent: offGrid.length === 0 }
}

export interface DesignScore {
	contrastMin: number
	contrastFailures: number
	scaleConsistent: boolean
	spacingAdherent: boolean
	/** 0-100 aggregate of the objective fundamentals. */
	score: number
}
/**
 * Aggregate objective design score from a set of contrast pairs + the scale +
 * spacing checks. This is the honest "luxury bar": high only if contrast,
 * scale, and grid all hold.
 */
export function designScore(
	contrastPairs: Array<{ fg: RGB; bg: RGB }>,
	sizes: number[],
	spacing: number[],
): DesignScore {
	const checks = contrastPairs.map((p) => checkContrast(p.fg, p.bg))
	const ratios = checks.map((c) => c.ratio)
	const contrastMin = ratios.length > 0 ? Math.min(...ratios) : 0
	const contrastFailures = checks.filter((c) => !c.pass).length
	const scaleConsistent = checkTypeScale(sizes).consistent
	const spacingAdherent = checkSpacingGrid(spacing).adherent

	let score = 0
	// Contrast: 50% (the non-negotiable fundamental)
	score += contrastFailures === 0 ? 50 : Math.max(0, 50 - contrastFailures * 12)
	// Scale consistency: 25%
	score += scaleConsistent ? 25 : 10
	// Spacing grid: 25%
	score += spacingAdherent ? 25 : 10
	return { contrastMin, contrastFailures, scaleConsistent, spacingAdherent, score: Math.round(score) }
}
