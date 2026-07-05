/**
 * Olympuz Studio — Design & Generation Department.
 *
 * Type foundation for the auto-activating, knowledge-driven, multi-agent
 * department that produces elite web / Android / Windows UI from any color base.
 *
 * This module is PURE types + a couple of validation constant arrays — no
 * runtime side effects, no imports beyond type-only. It is the shared contract
 * every other studio module builds on.
 */

// ---------------------------------------------------------------------------
// Platform & aesthetic dimensions
// ---------------------------------------------------------------------------

/** First-class generation targets. Windows = WinUI 3 / Windows App SDK (native). */
export type StudioPlatform = 'web' | 'android' | 'windows'

export const STUDIO_PLATFORMS: readonly StudioPlatform[] = ['web', 'android', 'windows']

/**
 * Aesthetic "moods". `neutral-adaptive` is the default — clean, neutral tokens
 * that adapt to whatever base color is supplied. `luxury-dark-gold` composes the
 * existing ALIVE_ELEGANCE_DIRECTIVE (Aman/Bugatti) as one named mood among many.
 */
export type StudioAesthetic =
	| 'neutral-adaptive'
	| 'luxury-dark-gold'
	| 'calm'
	| 'vibrant'
	| 'minimal'
	| 'bold'

export type StudioIntensity = 'standard' | 'premium' | 'ultra'

// ---------------------------------------------------------------------------
// Configuration & governance (the admin hierarchy)
// ---------------------------------------------------------------------------

export interface StudioConfig {
	/** When true the PRD is injected into every real (non-test) session. */
	enabled: boolean
	/** When true the department auto-activates on detected build intent. */
	autoActivate: boolean
	intensity: StudioIntensity
	defaultPlatform: StudioPlatform
	aesthetic: StudioAesthetic
	/** PRD knowledge version (bumped when principles.ts content materially changes). */
	prdVersion: string
}

/** A policy value can be a flag, a count, a single choice, or an allowed-set. */
export type PolicyValue = string | boolean | number | string[]

/**
 * Governance domains — each has its own "admin". The union of domains + the
 * director below form the admin hierarchy the user asked for
 * ("admin over everything incl. effects, general admin, admin of admins").
 */
export type StudioDomain =
	| 'design'
	| 'effects'
	| 'copy'
	| 'ux'
	| 'web'
	| 'android'
	| 'windows'
	| 'qa'

export const STUDIO_DOMAINS: readonly StudioDomain[] = [
	'design',
	'effects',
	'copy',
	'ux',
	'web',
	'android',
	'windows',
	'qa',
]

export interface DomainAdmin {
	domain: StudioDomain
	policies: Record<string, PolicyValue>
}

/** The director is the "admin of admins" — its policies override any domain. */
export interface DirectorConfig {
	policies: Record<string, PolicyValue>
}

export interface StudioGovernance {
	director: DirectorConfig
	admins: Partial<Record<StudioDomain, DomainAdmin>>
}

// ---------------------------------------------------------------------------
// Intent detection (drives auto-activation)
// ---------------------------------------------------------------------------

export type StudioKind =
	| 'website'
	| 'landing'
	| 'app'
	| 'dashboard'
	| 'system'
	| 'component'
	| 'unknown'

export interface StudioIntent {
	isBuildRequest: boolean
	/** 0..1 — rule+keyword score confidence. */
	confidence: number
	platform: StudioPlatform | 'unknown'
	kind: StudioKind
	/** Matched keyword groups that fired, for traceability. */
	triggers: string[]
}

// ---------------------------------------------------------------------------
// Design tokens (platform-agnostic core; emitted to CSS / Kotlin / XAML)
// ---------------------------------------------------------------------------

export interface ColorToken {
	name: string
	/** OKLCH string, e.g. "oklch(62% 0.19 25)". */
	oklch: string
	/** sRGB hex, e.g. "#e0651a". */
	hex: string
}

/** A 50→950 ramp (Material/Tailwind-style) anchored on a base hue. */
export interface ColorRamp {
	name: string
	/** keyed by stop number: 50,100,200,...,900,950. */
	stops: Record<number, ColorToken>
}

export interface SemanticTokens {
	bg: ColorToken
	fg: ColorToken
	muted: ColorToken
	subtle: ColorToken
	surface: ColorToken
	surfaceRaised: ColorToken
	border: ColorToken
	accent: ColorToken
	accentFg: ColorToken
	success: ColorToken
	warning: ColorToken
	danger: ColorToken
	info: ColorToken
}

export interface TypographyScale {
	fontFamily: string
	fontFamilyDisplay: string
	/** keyed by size name: xs, sm, base, lg, xl, 2xl, 3xl, 4xl. */
	sizes: Record<string, number>
	weights: Record<string, number>
	lineHeight: Record<string, number>
	letterSpacing: Record<string, number>
}

export interface MotionTokens {
	duration: Record<string, number>
	easing: Record<string, string>
}

export interface DesignTokens {
	version: string
	platform: StudioPlatform
	/** Hex base color supplied by the user, or the sentinel 'neutral-adaptive'. */
	baseColor: string
	mood: StudioAesthetic
	color: { ramp: ColorRamp; semantic: SemanticTokens }
	typography: TypographyScale
	spacing: number[]
	radius: Record<string, number>
	elevation: Record<string, string>
	motion: MotionTokens
	/** True only after every semantic fg/bg pair passed WCAG AA. */
	contrastVerified: boolean
}

// ---------------------------------------------------------------------------
// Department plan (delegation graph for the existing agent runtime)
// ---------------------------------------------------------------------------

export type StudioModelTier = 'flagship' | 'balanced' | 'fast'

export interface StudioRole {
	role: string
	mission: string
	tools: string[]
	modelTier: StudioModelTier
	domain: StudioDomain | null
}

export interface DepartmentTask {
	role: string
	objective: string
	dependsOn: string[]
	output: string
}

export interface DepartmentPlan {
	roles: StudioRole[]
	tasks: DepartmentTask[]
	/** Rendered instructions the main agent executes via existing Agent/swarm. */
	delegationInstructions: string
}

// ---------------------------------------------------------------------------
// Curator assets (knowledge-graph entities — the self-updating database)
// ---------------------------------------------------------------------------

export type StudioAssetType =
	| 'studio-palette'
	| 'studio-tokens'
	| 'studio-effect'
	| 'studio-copy'
	| 'studio-component'

export interface StudioAsset {
	type: StudioAssetType
	name: string
	attributes: Record<string, string>
}

/** A completed department run — the curator mines it for reusable assets. */
export interface StudioRunResult {
	brief: string
	platform: StudioPlatform
	tokens?: DesignTokens
	plan?: DepartmentPlan
	notes?: string
}
