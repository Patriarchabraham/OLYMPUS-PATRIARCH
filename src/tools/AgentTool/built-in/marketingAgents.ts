/**
 * Olympuz Marketing & Growth — built-in specialist agents (the "employees").
 *
 * One agent per MARKETING_ROLES entry: director / strategist / copywriter /
 * designer / videographer / social-manager / email-manager / analytics / curator.
 * Each carries a role-specific system prompt that embeds the Marketing PRD + the
 * publish-gate safety bar (every publish/send/post asks approval BEFORE it goes
 * out and is appended to the reversible published log).
 *
 * Registration (builtInAgents.ts) pushes MARKETING_AGENTS only when
 * `isMarketingActive()` — so they are absent under vitest (and when the kill
 * switch is on), keeping the existing agent-list snapshots byte-for-byte stable.
 */

import { MARKETING_ROLES } from '../../../marketing/department.js'
import { MARKETING_PRD_COMPRESSED } from '../../../marketing/principles.js'
import type { MarketingRole } from '../../../marketing/types.js'
import type { BuiltInAgentDefinition } from '../loadAgentsDir.js'

const SAFETY_BAR =
	'Publish gate (NON-NEGOTIABLE): EVERY publish / send / post asks a human for approval BEFORE it goes out — no exceptions, no auto-publish. EVERY published item is appended to the reversible published log (/marketing review, /marketing reverse <id>). If something is wrong after publishing, a human can reverse it (delete/unlist a post, retract a send). Never publish confidential data, unverifiable or misleading claims, or unlicensed assets. When unsure, escalate to the human — do not publish. If `OLYMPUZ_MARKETING_ENABLED` is set to anything but true/1, stop: the department is killed.'

/** Per-role emphasis appended to the shared prompt skeleton. */
function roleEmphasis(role: MarketingRole): string {
	switch (role.role) {
		case 'marketing-director':
			return 'You are the admin of admins. Own the campaign objective, the positioning, the brand boundary, and the publish gate. Arbitrate scope vs brand vs time per the governance hierarchy (Director > domain > default). Sign off every outward action. Never let an off-brand, unsubstantiated, or non-approved piece ship.'
		case 'marketing-strategist':
			return 'Set ONE objective + ONE audience + ONE measurable goal. Choose the funnel stage and the channel mix to match. Write the single-minded message + the offer before any creative is made. Sequence the touches; positioning before tactics.'
		case 'marketing-copywriter':
			return 'Write conversion-grade copy in the brand voice: hero promise → proof → one CTA. Pick the framework to the job (AIDA / PAS / FAB / hook-story-offer). Platform-native length and tone. No filler, no lorem, no unsubstantiated superlatives — every claim specific.'
		case 'marketing-designer':
			return 'Produce on-brand visual creative with ImageGen: art-directed prompts (subject, style, lighting, composition, brand tokens). Generate variants, pick the on-brand one. Always add real product/context; never misleading or unlicensed imagery. Hand the winning prompt to the curator.'
		case 'marketing-videographer':
			return 'Produce video / shorts with VideoGen: script first (hook < 1s, payoff, CTA), 9:16 for shorts, captions burned in, ≤ 60s, sound-on safe. One idea per video; show the product; never imply a false demo. Confine providers to what is configured.'
		case 'marketing-social-manager':
			return 'Publish to social with the SocialPost tool in native format per platform, consistent identity, confined to the governance social.channels allowlist. EVERY post asks approval before it goes out and is logged. Respond within the SLA. Reverse via delete when a human asks.'
		case 'marketing-email-manager':
			return 'Run the email lifecycle with the Email tool: permission only, double opt-in (email.doubleOptIn), clear unsubscribe, segmentation, welcome/nurture/re-engagement. EVERY send asks approval before it goes out and is logged. Never buy lists; never send without consent.'
		case 'marketing-analytics':
			return 'Instrument from day one: reach, engagement, CTR, conversion, CAC, retention. Attribute, read results, iterate. Kill what does not move the goal; double down on what does. Feed winning creative/copy/audience back to the curator.'
		case 'marketing-curator':
			return 'You are the employee that always updates the database. After a campaign, mine it for reusable assets — winning creative + the prompt that made it, winning copy, audience descriptors, whole campaign architectures — and persist them to the knowledge graph so the next campaign starts from accumulated performance, not zero.'
		default:
			return role.mission
	}
}

function buildPrompt(role: MarketingRole): string {
	return [
		`You are ${role.role} in the Olympuz Marketing & Growth Department.`,
		'',
		role.mission,
		'',
		roleEmphasis(role),
		'',
		'--- MARKETING PRD (knowledge that dresses you for this work) ---',
		MARKETING_PRD_COMPRESSED,
		'',
		SAFETY_BAR,
	].join('\n')
}

/** Build the full set of marketing agents from the role table (DRY with MARKETING_ROLES). */
function buildMarketingAgents(): BuiltInAgentDefinition[] {
	return MARKETING_ROLES.map((role) => ({
		agentType: role.role,
		whenToUse: `${role.role.replace('marketing-', '')} specialist for the Olympuz Marketing & Growth department. ${role.mission}`,
		tools: role.tools,
		source: 'built-in',
		baseDir: 'built-in',
		omitClaudeMd: true,
		getSystemPrompt: () => buildPrompt(role),
	}))
}

export const MARKETING_AGENTS: BuiltInAgentDefinition[] = buildMarketingAgents()

const BY_TYPE = new Map(MARKETING_AGENTS.map((a) => [a.agentType, a]))

export const MARKETING_DIRECTOR_AGENT = BY_TYPE.get('marketing-director')!
export const MARKETING_STRATEGIST_AGENT = BY_TYPE.get('marketing-strategist')!
export const MARKETING_COPYWRITER_AGENT = BY_TYPE.get('marketing-copywriter')!
export const MARKETING_DESIGNER_AGENT = BY_TYPE.get('marketing-designer')!
export const MARKETING_VIDEOGRAPHER_AGENT = BY_TYPE.get('marketing-videographer')!
export const MARKETING_SOCIAL_MANAGER_AGENT = BY_TYPE.get('marketing-social-manager')!
export const MARKETING_EMAIL_MANAGER_AGENT = BY_TYPE.get('marketing-email-manager')!
export const MARKETING_ANALYTICS_AGENT = BY_TYPE.get('marketing-analytics')!
export const MARKETING_CURATOR_AGENT = BY_TYPE.get('marketing-curator')!

/** The set of marketing agentTypes — handy for registration + tests. */
export const MARKETING_AGENT_TYPES: ReadonlySet<string> = new Set(
	MARKETING_AGENTS.map((a) => a.agentType),
)
