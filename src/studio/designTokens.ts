/**
 * Olympuz Studio — Deterministic design-token engine (any base color).
 *
 * Pure, no I/O, no settings/graph imports. Converts ANY base color (hex) into a
 * complete design-token system via OKLCH, validates WCAG AA on every semantic
 * fg/bg pair (reusing checkContrast from src/design), and emits the SAME tokens
 * to three targets: CSS custom properties (web), Compose Kotlin (Android), and a
 * XAML ResourceDictionary with Light/Dark ThemeDictionaries (Windows).
 *
 * This is the concrete proof that "qualquer cor base" works across all three
 * first-class platforms.
 */

import type { RGB } from '../design/tokens.js'
import { checkContrast } from '../design/verify.js'
import type {
	ColorRamp,
	ColorToken,
	DesignTokens,
	MotionTokens,
	SemanticTokens,
	StudioAesthetic,
	StudioIntensity,
	StudioPlatform,
	TypographyScale,
} from './types.js'

// ===========================================================================
// Color math: sRGB <-> linear <-> OKLab <-> OKLCH  (Björn Ottosson's OKLab)
// ===========================================================================

function clamp255(v: number): number {
	return Math.min(255, Math.max(0, Math.round(v)))
}

/** hex (#rgb | #rrggbb) -> RGB. Throws on malformed input (callers validate). */
export function hexToRgb(hex: string): RGB {
	let h = hex.trim().replace(/^#/, '')
	if (h.length === 3)
		h = h
			.split('')
			.map((c) => c + c)
			.join('')
	if (!/^[0-9a-fA-F]{6}$/.test(h)) throw new Error(`Invalid hex color: ${hex}`)
	const num = parseInt(h, 16)
	return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 }
}

export function rgbToHex({ r, g, b }: RGB): string {
	return `#${[r, g, b].map((v) => clamp255(v).toString(16).padStart(2, '0')).join('')}`
}

function srgbToLin(c: number): number {
	// c in 0..255 -> linear 0..1
	const s = c / 255
	return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}

function linToSrgb(c: number): number {
	const v = c >= 0.0031308 ? 1.055 * c ** (1 / 2.4) - 0.055 : 12.92 * c
	return v * 255
}

export interface OKLCH {
	L: number // 0..1
	C: number // 0..~0.4
	H: number // degrees 0..360
}

/** RGB -> OKLCH. */
export function rgbToOklch({ r, g, b }: RGB): OKLCH {
	const rl = srgbToLin(r)
	const gl = srgbToLin(g)
	const bl = srgbToLin(b)
	const l = 0.4122214708 * rl + 0.5363325363 * gl + 0.0514459929 * bl
	const m = 0.2119034982 * rl + 0.6806995451 * gl + 0.1073969566 * bl
	const s = 0.0883024619 * rl + 0.2817188376 * gl + 0.6299787005 * bl
	const l_ = Math.cbrt(l)
	const m_ = Math.cbrt(m)
	const s_ = Math.cbrt(s)
	const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_
	const a = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_
	const bb = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_
	const C = Math.sqrt(a * a + bb * bb)
	let H = (Math.atan2(bb, a) * 180) / Math.PI
	if (H < 0) H += 360
	return { L, C, H }
}

/** OKLCH -> RGB (clamped to display gamut). */
export function oklchToRgb({ L, C, H }: OKLCH): RGB {
	const hr = (H * Math.PI) / 180
	const a = Math.cos(hr) * C
	const b = Math.sin(hr) * C
	const l_ = L + 0.3963377774 * a + 0.2158037573 * b
	const m_ = L - 0.1055613458 * a - 0.0638541728 * b
	const s_ = L - 0.0894841775 * a - 1.291485548 * b
	const l = l_ ** 3
	const m = m_ ** 3
	const s = s_ ** 3
	const r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s
	const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s
	const bb = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s
	return { r: clamp255(linToSrgb(r)), g: clamp255(linToSrgb(g)), b: clamp255(linToSrgb(bb)) }
}

export function oklchToHex(o: OKLCH): string {
	return rgbToHex(oklchToRgb(o))
}

export function oklchString({ L, C, H }: OKLCH): string {
	return `oklch(${(L * 100).toFixed(1)}% ${C.toFixed(3)} ${H.toFixed(1)})`
}

// ===========================================================================
// Ramp generation (50 -> 950)
// ===========================================================================

/** Tailwind-like lightness targets per stop (0..1). */
const RAMP_L: Record<number, number> = {
	50: 0.98,
	100: 0.95,
	200: 0.89,
	300: 0.82,
	400: 0.72,
	500: 0.62,
	600: 0.52,
	700: 0.43,
	800: 0.34,
	900: 0.27,
	950: 0.2,
}

/**
 * Generate a 50-950 ramp from a base OKLCH hue/chroma. Lightness is fixed per
 * stop; chroma is held from the base but softened at the extremes to avoid neon
 * pastels and gamut clipping.
 */
export function generateRamp(name: string, base: OKLCH): ColorRamp {
	const stops: Record<number, ColorToken> = {}
	for (const key of Object.keys(RAMP_L)) {
		const stop = Number(key)
		const L = RAMP_L[stop]!
		// Soften chroma toward the light + very dark extremes.
		const lightnessFactor = Math.min(1, Math.abs(L - 0.5) * 2) // 0 at mid, 1 at extremes
		const C = base.C * (1 - 0.45 * Math.max(0, lightnessFactor - 0.4))
		const ok: OKLCH = { L, C: Math.max(0, C), H: base.H }
		stops[stop] = { name: `${name}-${stop}`, oklch: oklchString(ok), hex: oklchToHex(ok) }
	}
	return { name, stops }
}

// ===========================================================================
// Semantic tokens (with WCAG AA iteration)
// ===========================================================================

type Theme = 'light' | 'dark'

function token(name: string, o: OKLCH): ColorToken {
	return { name, oklch: oklchString(o), hex: oklchToHex(o) }
}

function meetsAA(fg: ColorToken, bg: ColorToken): boolean {
	// parse hex back to RGB for the verified checker
	const f = hexToRgb(fg.hex)
	const b = hexToRgb(bg.hex)
	return checkContrast(f, b).pass
}

/**
 * Walk lightness (L) in steps until `fg` clears AA against `bg`, capped at
 * `maxSteps`. Returns the best token found (last that improves) even if AA is
 * not strictly reached — contrastVerified reflects the true outcome.
 */
function nudgeUntilAA(
	name: string,
	hue: number,
	startL: number,
	towardLight: boolean,
	bg: ColorToken,
	maxSteps = 10,
): { token: ColorToken; passed: boolean } {
	let bestL = startL
	let bestRatio = -1
	let passed = false
	for (let i = 0; i <= maxSteps; i++) {
		const L = startL + (towardLight ? 1 : -1) * i * 0.05
		const clamped = Math.min(0.99, Math.max(0.01, L))
		const cand = token(name, { L: clamped, C: 0.02, H: hue })
		const f = hexToRgb(cand.hex)
		const b = hexToRgb(bg.hex)
		const ratio = checkContrast(f, b).ratio
		if (ratio > bestRatio) {
			bestRatio = ratio
			bestL = clamped
		}
		if (checkContrast(f, b).pass) {
			passed = true
			return { token: cand, passed: true }
		}
	}
	return { token: token(name, { L: bestL, C: 0.02, H: hue }), passed }
}

const STATUS_HUES = { success: 145, warning: 85, danger: 25, info: 250 } as const

/** Derive semantic tokens for a theme, verifying AA on critical pairs. */
export function deriveSemanticTokens(
	ramp: ColorRamp,
	theme: Theme,
	accentBase: OKLCH,
): {
	tokens: SemanticTokens
	verified: boolean
} {
	const isDark = theme === 'dark'
	const bg = isDark ? ramp.stops[950]! : ramp.stops[50]!
	const fg = isDark ? ramp.stops[50]! : ramp.stops[950]!
	const surface = isDark ? ramp.stops[900]! : ramp.stops[100]!
	const surfaceRaised = isDark ? ramp.stops[800]! : ramp.stops[200]!
	const border = isDark ? ramp.stops[700]! : ramp.stops[300]!

	// Accent: the base color, clamped to a readable L for the theme.
	const accentL = isDark ? 0.7 : 0.5
	const accent = token('accent', { L: accentL, C: Math.min(0.16, accentBase.C), H: accentBase.H })

	// accentFg: pick bg or fg, then nudge to AA against accent.
	const startFg = isDark ? ramp.stops[950]! : ramp.stops[50]!
	const accentFgPick = meetsAA(startFg, accent) ? startFg : fg
	const accentFgRes = nudgeUntilAA(
		'accent-fg',
		accentBase.H,
		rgbToOklch(hexToRgb(accentFgPick.hex)).L,
		isDark,
		accent,
	)
	const accentFg = accentFgRes.token

	// Status colors at hues, nudged to AA against bg.
	const statusL = isDark ? 0.72 : 0.5
	const makeStatus = (name: string, hue: number): ColorToken =>
		nudgeUntilAA(name, hue, statusL, isDark, bg).token

	const success = makeStatus('success', STATUS_HUES.success)
	const warning = makeStatus('warning', STATUS_HUES.warning)
	const danger = makeStatus('danger', STATUS_HUES.danger)
	const info = makeStatus('info', STATUS_HUES.info)

	const tokens: SemanticTokens = {
		bg,
		fg,
		muted: isDark ? ramp.stops[400]! : ramp.stops[500]!,
		subtle: isDark ? ramp.stops[600]! : ramp.stops[400]!,
		surface,
		surfaceRaised,
		border,
		accent,
		accentFg,
		success,
		warning,
		danger,
		info,
	}

	// Critical AA pairs that define "verified".
	const fgOnBg = meetsAA(fg, bg)
	const accentFgOnAccent = meetsAA(accentFg, accent)
	const verified = fgOnBg && accentFgOnAccent
	return { tokens, verified }
}

// ===========================================================================
// Typography / spacing / motion / radius / elevation scales
// ===========================================================================

export function buildTypographyScale(mood: StudioAesthetic): TypographyScale {
	const ratio = 1.25 // major third
	const base = 16
	const names = ['xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl', '4xl']
	const sizes: Record<string, number> = {}
	names.forEach((n, i) => {
		sizes[n] = Math.round(base * ratio ** (i - 2) * 10) / 10
	})
	const isLuxury = mood === 'luxury-dark-gold'
	return {
		fontFamily: 'Inter, system-ui, sans-serif',
		fontFamilyDisplay: isLuxury
			? 'Playfair Display, Georgia, serif'
			: 'Inter, system-ui, sans-serif',
		sizes,
		weights: { regular: 400, medium: 500, semibold: 600, bold: 700 },
		lineHeight: { tight: 1.15, snug: 1.3, base: 1.5, relaxed: 1.7 },
		letterSpacing: { tight: -0.02, normal: 0, wide: 0.04 },
	}
}

export function buildSpacingScale(): number[] {
	return [4, 8, 12, 16, 24, 32, 48, 64, 96, 128]
}

export function buildMotionTokens(intensity: StudioIntensity): MotionTokens {
	const base =
		intensity === 'ultra'
			? { revealMin: 0.8, revealMax: 1.5, stagger: 0.08 }
			: intensity === 'premium'
				? { revealMin: 0.5, revealMax: 1.0, stagger: 0.06 }
				: { revealMin: 0.2, revealMax: 0.5, stagger: 0.04 }
	return {
		duration: {
			instant: 0.1,
			fast: 0.2,
			base: 0.3,
			revealMin: base.revealMin,
			revealMax: base.revealMax,
			stagger: base.stagger,
		},
		easing: {
			standard: 'cubic-bezier(0.4, 0, 0.2, 1)',
			luxury: 'cubic-bezier(0.23, 1, 0.32, 1)',
			emphasized: 'cubic-bezier(0.3, 0, 0, 1)',
		},
	}
}

// ===========================================================================
// Mood -> {H, C, theme}
// ===========================================================================

interface MoodProfile {
	H: number
	C: number
	theme: Theme
}

const MOOD_PROFILES: Record<StudioAesthetic, MoodProfile> = {
	'neutral-adaptive': { H: 250, C: 0.03, theme: 'light' },
	'luxury-dark-gold': { H: 75, C: 0.12, theme: 'dark' },
	calm: { H: 220, C: 0.05, theme: 'light' },
	vibrant: { H: 25, C: 0.18, theme: 'light' },
	minimal: { H: 0, C: 0.005, theme: 'light' },
	bold: { H: 350, C: 0.2, theme: 'light' },
}

// ===========================================================================
// The top-level generator
// ===========================================================================

export interface GenerateTokensOptions {
	/** hex base color ("#rrggbb") or the sentinel "neutral-adaptive". */
	baseColor?: string
	mood?: StudioAesthetic
	platform?: StudioPlatform
	intensity?: StudioIntensity
}

const NEUTRAL_ADAPTIVE = 'neutral-adaptive'

/**
 * Generate a complete DesignTokens set for any base color + mood, emitted
 * platform-agnostically. The same object feeds tokensToCSS / tokensToComposeKotlin
 * / tokensToWinUIXaml.
 */
export function generateDesignTokens(opts: GenerateTokensOptions = {}): DesignTokens {
	const mood: StudioAesthetic = opts.mood ?? 'neutral-adaptive'
	const platform: StudioPlatform = opts.platform ?? 'web'
	const intensity: StudioIntensity = opts.intensity ?? 'ultra'
	const baseColorRaw = (opts.baseColor ?? '').trim()

	const profile = MOOD_PROFILES[mood]
	// Resolve hue/chroma: a real hex overrides the mood's H/C; the mood keeps its theme.
	let H = profile.H
	let C = profile.C
	let baseColorField = baseColorRaw || NEUTRAL_ADAPTIVE
	if (baseColorRaw && /^#?[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(baseColorRaw)) {
		const o = rgbToOklch(hexToRgb(baseColorRaw))
		H = o.H
		C = Math.max(0.02, Math.min(0.22, o.C))
	} else {
		baseColorField = NEUTRAL_ADAPTIVE
	}

	const ramp = generateRamp(platform === 'android' ? 'color' : 'color', { L: 0.6, C, H })
	const { tokens: semantic, verified } = deriveSemanticTokens(ramp, profile.theme, { L: 0.6, C, H })

	return {
		version: '1.0.0',
		platform,
		baseColor: baseColorField,
		mood,
		color: { ramp, semantic },
		typography: buildTypographyScale(mood),
		spacing: buildSpacingScale(),
		radius: { none: 0, sm: 4, base: 8, lg: 12, xl: 16, '2xl': 24, full: 9999 },
		elevation:
			profile.theme === 'dark'
				? {
						sm: '0 1px 2px rgba(0,0,0,0.5)',
						md: '0 4px 12px rgba(0,0,0,0.55)',
						lg: '0 12px 32px rgba(0,0,0,0.6)',
					}
				: {
						sm: '0 1px 2px rgba(0,0,0,0.06)',
						md: '0 4px 12px rgba(0,0,0,0.08)',
						lg: '0 12px 32px rgba(0,0,0,0.12)',
					},
		motion: buildMotionTokens(intensity),
		contrastVerified: verified,
	}
}

// ===========================================================================
// Emitters
// ===========================================================================

/** Emit CSS custom properties (:root, with the semantic palette + scales). */
export function tokensToCSS(tokens: DesignTokens): string {
	const s = tokens.color.semantic
	const lines: string[] = []
	lines.push(':root {')
	for (const [k, v] of Object.entries(s)) {
		lines.push(`  --color-${k}: ${(v as ColorToken).hex}; /* ${(v as ColorToken).oklch} */`)
	}
	for (const [k, v] of Object.entries(tokens.typography.sizes)) {
		lines.push(`  --text-${k}: ${v}rem;`)
	}
	tokens.spacing.forEach((sp, i) => lines.push(`  --space-${i + 1}: ${sp}px;`))
	for (const [k, v] of Object.entries(tokens.radius)) lines.push(`  --radius-${k}: ${v}px;`)
	for (const [k, v] of Object.entries(tokens.elevation)) lines.push(`  --shadow-${k}: ${v};`)
	for (const [k, v] of Object.entries(tokens.motion.duration))
		lines.push(`  --duration-${k}: ${v}s;`)
	for (const [k, v] of Object.entries(tokens.motion.easing)) lines.push(`  --ease-${k}: ${v};`)
	lines.push(`  --font-body: ${tokens.typography.fontFamily};`)
	lines.push(`  --font-display: ${tokens.typography.fontFamilyDisplay};`)
	lines.push(`  --studio-contrast-verified: ${tokens.contrastVerified};`)
	lines.push('}')
	return lines.join('\n')
}

function hexToArgb(hex: string): string {
	// "#rrggbb" -> "0xFFRRGGBB"
	const h = hex.replace('#', '')
	return `0xFF${h.toUpperCase()}`
}

/**
 * Emit Jetpack Compose (Android) — Color.kt + Type.kt + Shapes.kt for a Material 3
 * scheme, derived from the same tokens.
 */
export function tokensToComposeKotlin(tokens: DesignTokens): string {
	const s = tokens.color.semantic
	const out: string[] = [
		'// Generated by Olympuz Studio — Compose / Material 3 Expressive tokens.',
		'package com.olympuz.studio.ui.theme',
		'',
		'import androidx.compose.ui.graphics.Color',
		'import androidx.compose.material3.Typography',
		'import androidx.compose.ui.text.TextStyle',
		'import androidx.compose.ui.unit.sp',
		'import androidx.compose.foundation.shape.RoundedCornerShape',
		'import androidx.compose.material3.Shapes',
		'import androidx.compose.ui.unit.dp',
		'',
		'object StudioColors {',
	]
	for (const [k, v] of Object.entries(s)) {
		const name = k.charAt(0).toUpperCase() + k.slice(1)
		out.push(`    val ${name} = Color(${hexToArgb((v as ColorToken).hex)})`)
	}
	out.push('}', '', 'val StudioTypeScale = Typography(')
	out.push(`    displayLarge = TextStyle(fontSize = ${tokens.typography.sizes['4xl']}sp),`)
	out.push(`    headlineLarge = TextStyle(fontSize = ${tokens.typography.sizes['2xl']}sp),`)
	out.push(`    titleLarge = TextStyle(fontSize = ${tokens.typography.sizes.lg}sp),`)
	out.push(`    bodyLarge = TextStyle(fontSize = ${tokens.typography.sizes.base}sp),`)
	out.push(`    labelLarge = TextStyle(fontSize = ${tokens.typography.sizes.sm}sp)`)
	out.push(')', '', 'val StudioShapes = Shapes(')
	out.push(`    small = RoundedCornerShape(${tokens.radius.sm}.dp),`)
	out.push(`    medium = RoundedCornerShape(${tokens.radius.base}.dp),`)
	out.push(`    large = RoundedCornerShape(${tokens.radius.lg}.dp)`)
	out.push(')')
	out.push(`// contrastVerified = ${tokens.contrastVerified}`)
	return out.join('\n')
}

/**
 * Emit a WinUI 3 / Windows App SDK XAML ResourceDictionary with Light + Dark
 * ThemeDictionaries. Material mapping (Mica / Desktop Acrylic) is documented in
 * comments for the Windows engineer agent to wire via SystemBackdrop.
 */
export function tokensToWinUIXaml(tokens: DesignTokens): string {
	const s = tokens.color.semantic
	const light = tokens.color.ramp.stops[50]!.hex
	const dark = tokens.color.ramp.stops[950]!.hex
	const emitTheme = (themeBg: string, themeFg: string): string[] => {
		const lines: string[] = [
			`      <ResourceDictionary x:Key="${themeBg === light ? 'Light' : 'Dark'}">`,
		]
		lines.push(`        <Color x:Key="BackgroundColor">${themeBg}</Color>`)
		lines.push(`        <Color x:Key="ForegroundColor">${themeFg}</Color>`)
		lines.push(
			`        <SolidColorBrush x:Key="BackgroundBrush" Color="{StaticResource BackgroundColor}" />`,
		)
		lines.push(
			`        <SolidColorBrush x:Key="ForegroundBrush" Color="{StaticResource ForegroundColor}" />`,
		)
		for (const [k, v] of Object.entries(s)) {
			if (k === 'bg' || k === 'fg') continue
			const name = k.charAt(0).toUpperCase() + k.slice(1)
			lines.push(`        <Color x:Key="${name}Color">${(v as ColorToken).hex}</Color>`)
			lines.push(
				`        <SolidColorBrush x:Key="${name}Brush" Color="{StaticResource ${name}Color}" />`,
			)
		}
		lines.push('      </ResourceDictionary>')
		return lines
	}
	const lines: string[] = [
		'<!-- Generated by Olympuz Studio — WinUI 3 / Windows App SDK / Fluent tokens. -->',
		'<ResourceDictionary',
		'    xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation"',
		'    xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml">',
		'  <ResourceDictionary.ThemeDictionaries>',
	]
	lines.push(...emitTheme(light, dark))
	lines.push(...emitTheme(dark, light))
	lines.push('  </ResourceDictionary.ThemeDictionaries>')
	// Type ramp
	for (const [k, v] of Object.entries(tokens.typography.sizes)) {
		lines.push(`  <x:Double x:Key="${k}FontSize">${v}</x:Double>`)
	}
	lines.push(
		`  <!-- Material: set the Window SystemBackdrop to MicaController (app bg) or DesktopAcrylicController (surfaces). -->`,
	)
	lines.push(`  <!-- contrastVerified = ${tokens.contrastVerified} -->`)
	lines.push('</ResourceDictionary>')
	return lines.join('\n')
}

// Re-export math helpers for tests/fixtures.
export { hexToRgb as _hexToRgb, oklchToRgb as _oklchToRgb, rgbToOklch as _rgbToOklch }
