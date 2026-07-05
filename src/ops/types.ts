/**
 * Olympuz Agentic Operations — Department type foundation.
 *
 * The department that lets Olympuz control Windows + any browser, run any task
 * from the prompt on the PC, see (vision), hear (STT), speak (TTS), and form
 * autonomous agent "teams". PURE types + constant arrays — no runtime side
 * effects. Mirrors src/studio/types.ts.
 */

/** The control surface a task targets. */
export type OpsSurface = 'computer' | 'browser' | 'vision' | 'voice' | 'automation' | 'unknown'

export const OPS_SURFACES: readonly OpsSurface[] = [
	'computer',
	'browser',
	'vision',
	'voice',
	'automation',
]

export type OpsIntensity = 'standard' | 'premium' | 'ultra'

/**
 * Ops is OPT-IN by default (enabled: false). Real computer/browser control is
 * dangerous, so unlike Studio the department does not auto-inject its PRD until
 * the user runs `/ops enable` (or sets OLYMPUZ_OPS_ENABLED). Destructive actions
 * additionally require per-action approval.
 */
export interface OpsConfig {
	enabled: boolean
	/** Always false for Ops — explicit opt-in only, never intent auto-trigger. */
	autoActivate: boolean
	intensity: OpsIntensity
	/** Which control surfaces are permitted. Empty = all. */
	surfaces: OpsSurface[]
	/** Default approval policy for destructive computer control. */
	approvalPolicy: 'ask-destructive' | 'ask-always' | 'allow'
	prdVersion: string
}

export type PolicyValue = string | boolean | number | string[]

/**
 * Governance domains — each has its own "admin". Director (admin of admins)
 * overrides any domain.
 */
export type OpsDomain = 'computer' | 'browser' | 'vision' | 'voice' | 'automation' | 'teams'

export const OPS_DOMAINS: readonly OpsDomain[] = [
	'computer',
	'browser',
	'vision',
	'voice',
	'automation',
	'teams',
]

export interface OpsDomainAdmin {
	domain: OpsDomain
	policies: Record<string, PolicyValue>
}

export interface OpsDirectorConfig {
	policies: Record<string, PolicyValue>
}

export interface OpsGovernance {
	director: OpsDirectorConfig
	admins: Partial<Record<OpsDomain, OpsDomainAdmin>>
}

// Intent ------------------------------------------------------------------

export interface OpsIntent {
	isOpsRequest: boolean
	/** 0..1 — rule+keyword score confidence. */
	confidence: number
	surface: OpsSurface
	/** Matched keyword groups that fired, for traceability. */
	triggers: string[]
}

// Department plan (delegation graph for the existing agent/swarm runtime) ----

export type OpsModelTier = 'flagship' | 'balanced' | 'fast'

export interface OpsRole {
	role: string
	mission: string
	tools: string[]
	modelTier: OpsModelTier
	domain: OpsDomain | null
}

export interface OpsTask {
	role: string
	objective: string
	dependsOn: string[]
	output: string
}

export interface OpsPlan {
	roles: OpsRole[]
	tasks: OpsTask[]
	delegationInstructions: string
}

// Curator assets (knowledge-graph entities — the self-updating database) ----

export type OpsAssetType = 'ops-macro' | 'ops-selector' | 'ops-workflow'

export interface OpsAsset {
	type: OpsAssetType
	name: string
	attributes: Record<string, string>
}

/** A completed ops run — the curator mines it for reusable know-how. */
export interface OpsRunResult {
	brief: string
	surface: OpsSurface
	plan?: OpsPlan
	/** Free-form notes / a recorded action sequence the curator can persist. */
	notes?: string
	macros?: Array<{ name: string; steps: string[] }>
	selectors?: Array<{ name: string; selector: string; surface: string }>
}
