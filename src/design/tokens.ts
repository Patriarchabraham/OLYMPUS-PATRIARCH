/**
 * Luxury Design Tokens — the typed foundation, applied by default.
 *
 * Luxury = disciplined fundamentals + restraint, not effect-stacking. These
 * tokens encode the OBJECTIVE bases of award-winning work: a spacing grid, a
 * ratio-based type scale, multi-level elevation, purposeful motion curves, and
 * a WCAG-checked palette (royal-blue brand + luxury neutrals + gold accent).
 * Exportable to CSS variables / JSON so generated UI applies them directly.
 */

export interface RGB {
	r: number
	g: number
	b: number
}

/** Brand: royal blue (the Olympuz system color). */
export const ROYAL_BLUE: RGB = { r: 65, g: 105, b: 225 }
/** Luxury accent: muted imperial gold. */
export const GOLD: RGB = { r: 201, g: 168, b: 76 }
/** Deep dark base stack for luxury dark themes (0 = deepest). */
export const DARK_BASE: RGB = { r: 10, g: 10, b: 15 }
export const DARK_ELEVATED: RGB = { r: 18, g: 18, b: 26 }
export const DARK_SURFACE: RGB = { r: 26, g: 26, b: 38 }
export const DARK_OVERLAY: RGB = { r: 34, g: 34, b: 58 }
/** Luxury neutrals (warm-cool gray ramp). */
export const NEUTRAL_50 = '#f6f7f9'
export const NEUTRAL_100 = '#eceef2'
export const NEUTRAL_300 = '#c4c9d4'
export const NEUTRAL_500 = '#8b91a3'
export const NEUTRAL_700 = '#3f4452'
export const NEUTRAL_900 = '#0c0e14'

/** Spacing — 4px base, geometric-ish human scale (8 is the workhorse). */
export const SPACING = {
	base: 4,
	px: 4,
	1: 4,
	2: 8,
	3: 12,
	4: 16,
	5: 24,
	6: 32,
	7: 48,
	8: 64,
	9: 96,
	10: 128,
} as const

/** Type scale — major third (1.250), fluid via clamp(). Display + body pairings. */
export const TYPE_SCALE = {
	ratio: 1.25,
	display: { min: 48, max: 96, weight: 600, tracking: '-0.02em' },
	h1: { min: 36, max: 60, weight: 600, tracking: '-0.02em' },
	h2: { min: 28, max: 44, weight: 600, tracking: '-0.01em' },
	h3: { min: 22, max: 32, weight: 600, tracking: '-0.01em' },
	body: { min: 16, max: 18, weight: 400, tracking: '0' },
	small: { min: 14, max: 14, weight: 400, tracking: '0' },
	caption: { min: 12, max: 12, weight: 500, tracking: '0.04em' },
} as const

/** Build a fluid clamp() for a scale step. */
export function fluidSize(step: { min: number; max: number }): string {
	// Linear interpolation between min (375px viewport) and max (1200px viewport).
	const vw = ((step.max - step.min) / (1200 - 375)) * 100
	return `clamp(${step.min}px, ${step.min}px + ${vw.toFixed(3)}vw, ${step.max}px)`
}

/** Elevation — multi-level depth (luxury dark theme reads in layers). */
export interface Elevation {
	boxShadow: string
}
export const ELEVATION = {
	0: { boxShadow: 'none' },
	1: { boxShadow: '0 1px 2px rgba(0,0,0,0.30)' },
	2: { boxShadow: '0 4px 12px rgba(0,0,0,0.35)' },
	3: { boxShadow: '0 12px 32px rgba(0,0,0,0.40)' },
	4: { boxShadow: '0 24px 64px rgba(0,0,0,0.50), 0 0 0 1px rgba(65,105,225,0.08)' },
} as const

/** Motion — purposeful curves + durations. Restraint: short, not flashy. */
export const MOTION = {
	curves: {
		standard: 'cubic-bezier(0.2, 0, 0, 1)',
		emphasized: 'cubic-bezier(0.3, 0, 0, 1)',
		exit: 'cubic-bezier(0.4, 0, 1, 1)',
	},
	duration: { fast: 120, base: 200, slow: 360 },
	stagger: 50, // ms between staggered entries
} as const

/** Border radius — soft but not bubbly. */
export const RADIUS = { none: 0, sm: 4, md: 8, lg: 16, xl: 24, pill: 9999 } as const

/** Z-index scale (avoids magic numbers). */
export const Z = { base: 0, dropdown: 100, sticky: 200, overlay: 1000, toast: 1100 } as const

/** The full luxury palette with WCAG-checked pairs (see verify.ts). */
export const PALETTE = {
	brand: ROYAL_BLUE,
	accent: GOLD,
	dark: { base: DARK_BASE, elevated: DARK_ELEVATED, surface: DARK_SURFACE, overlay: DARK_OVERLAY },
	neutral: {
		50: NEUTRAL_50,
		100: NEUTRAL_100,
		300: NEUTRAL_300,
		500: NEUTRAL_500,
		700: NEUTRAL_700,
		900: NEUTRAL_900,
	},
	semantic: {
		success: { r: 78, g: 186, b: 101 },
		warning: { r: 255, g: 193, b: 7 },
		error: { r: 255, g: 107, b: 128 },
	},
} as const

/** Serialize the whole token system to CSS custom properties for generated UI. */
export function tokensToCSSVars(): string {
	const lines: string[] = []
	for (const [k, v] of Object.entries(SPACING)) lines.push(`  --space-${k}: ${v}px;`)
	for (const [k, s] of Object.entries(TYPE_SCALE)) {
		if (typeof s === 'number') continue
		lines.push(`  --type-${k}: ${fluidSize(s)};`)
	}
	lines.push(`  --brand: rgb(${ROYAL_BLUE.r},${ROYAL_BLUE.g},${ROYAL_BLUE.b});`)
	lines.push(`  --accent: rgb(${GOLD.r},${GOLD.g},${GOLD.b});`)
	lines.push(`  --bg-base: rgb(${DARK_BASE.r},${DARK_BASE.g},${DARK_BASE.b});`)
	lines.push(`  --bg-elevated: rgb(${DARK_ELEVATED.r},${DARK_ELEVATED.g},${DARK_ELEVATED.b});`)
	lines.push(`  --bg-surface: rgb(${DARK_SURFACE.r},${DARK_SURFACE.g},${DARK_SURFACE.b});`)
	lines.push(`  --bg-overlay: rgb(${DARK_OVERLAY.r},${DARK_OVERLAY.g},${DARK_OVERLAY.b});`)
	for (const [k, r] of Object.entries(RADIUS)) lines.push(`  --radius-${k}: ${r}px;`)
	return `:root {\n${lines.join('\n')}\n}`
}
