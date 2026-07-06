/**
 * Olympuz Marketing & Growth — Department type foundation.
 *
 * The department that builds complete campaigns, generates images / videos /
 * shorts, creates emails + official profiles, posts to social media, and sends
 * email — with a pre-publish human-approval gate on every outward action and a
 * reviewable, reversible published log. PURE types + constant arrays — no
 * runtime side effects. Mirrors src/studio/types.ts + src/ops/types.ts.
 */

/** The kind of marketing request. */
export type MarketingKind =
	| 'campaign'
	| 'content'
	| 'social'
	| 'email'
	| 'video'
	| 'profile'
	| 'unknown'

export const MARKETING_KINDS: readonly MarketingKind[] = [
	'campaign',
	'content',
	'social',
	'email',
	'video',
	'profile',
]

export type MarketingIntensity = 'standard' | 'premium' | 'ultra'

/**
 * Marketing is ENABLED by default (mirrors Studio) — its PRD is appended to the
 * system prompt and it auto-activates on detected marketing intent. Safety is
 * enforced at the publish layer: every publish/send/post asks approval BEFORE it
 * goes out and is appended to the reversible published log. Dormant under vitest.
 */
export interface MarketingConfig {
	enabled: boolean
	autoActivate: boolean
	intensity: MarketingIntensity
	/** Channels permitted for social/email publishing. Empty = all configured. */
	channels: string[]
	/** Default publish gate. 'ask-always' = approve every publish before it goes out. */
	publish: {
		approvalPolicy: 'ask-always' | 'ask-destructive' | 'allow'
		logging: boolean
	}
	prdVersion: string
}

export type PolicyValue = string | boolean | number | string[]

/**
 * Governance domains — each has its own "admin". Director (admin of admins)
 * overrides any domain.
 */
export type MarketingDomain =
	| 'strategy'
	| 'copy'
	| 'design'
	| 'video'
	| 'social'
	| 'email'
	| 'analytics'
	| 'publish'

export const MARKETING_DOMAINS: readonly MarketingDomain[] = [
	'strategy',
	'copy',
	'design',
	'video',
	'social',
	'email',
	'analytics',
	'publish',
]

export interface MarketingDomainAdmin {
	domain: MarketingDomain
	policies: Record<string, PolicyValue>
}

export interface MarketingDirectorConfig {
	policies: Record<string, PolicyValue>
}

export interface MarketingGovernance {
	director: MarketingDirectorConfig
	admins: Partial<Record<MarketingDomain, MarketingDomainAdmin>>
}

// Intent ------------------------------------------------------------------

export interface MarketingIntent {
	isMarketingRequest: boolean
	/** 0..1 — rule+keyword score confidence. */
	confidence: number
	kind: MarketingKind
	/** Matched keyword groups that fired, for traceability. */
	triggers: string[]
}

// Department plan (delegation graph for the existing agent/swarm runtime) ----

export type MarketingModelTier = 'flagship' | 'balanced' | 'fast'

export interface MarketingRole {
	role: string
	mission: string
	tools: string[]
	modelTier: MarketingModelTier
	domain: MarketingDomain | null
}

export interface MarketingTask {
	role: string
	objective: string
	dependsOn: string[]
	output: string
}

export interface CampaignPlan {
	roles: MarketingRole[]
	tasks: MarketingTask[]
	delegationInstructions: string
}

// Curator assets (knowledge-graph entities — the self-updating database) ----

export type MarketingAssetType =
	| 'marketing-campaign'
	| 'marketing-creative'
	| 'marketing-audience'
	| 'marketing-copy'

export interface MarketingAsset {
	type: MarketingAssetType
	name: string
	attributes: Record<string, string>
}

/** A completed marketing run — the curator mines it for reusable assets. */
export interface MarketingRunResult {
	brief: string
	kind: MarketingKind
	plan?: CampaignPlan
	/** Free-form notes the curator can persist. */
	notes?: string
	/** Winning creatives (image/video) + the prompt that made them. */
	creatives?: Array<{ name: string; medium: 'image' | 'video'; prompt: string; path?: string }>
	/** Winning copy (headline/CTA/etc.) worth reusing. */
	copy?: Array<{ name: string; text: string }>
	/** Audience/persona descriptor. */
	audience?: string
}
