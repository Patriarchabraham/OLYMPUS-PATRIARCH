/**
 * Olympuz Marketing & Growth — Department (the org chart of "employees").
 *
 * Defines the specialist roles and turns a MarketingIntent + governance into a
 * CampaignPlan: which roles run, in what order (a dependency graph), and the
 * delegation instructions the MAIN agent executes via the EXISTING Agent/swarm
 * runtime. Pure, no I/O. Mirrors src/ops/department.ts.
 */

import { marketingGovernanceNotes } from './governance.js'
import type {
	CampaignPlan,
	MarketingGovernance,
	MarketingIntent,
	MarketingKind,
	MarketingRole,
	MarketingTask,
} from './types.js'

const READ_TOOLS = ['Glob', 'Grep', 'Read', 'WebSearch', 'WebFetch']
const BUILD_TOOLS = ['Read', 'Glob', 'Grep', 'Bash', 'Agent']
const CREATIVE_TOOLS = [
	'Read',
	'Glob',
	'Grep',
	'ImageGen',
	'VideoGen',
	'MarketingBuild',
	'WebSearch',
]
const PUBLISH_TOOLS = ['Read', 'Glob', 'Grep', 'MarketingBuild', 'SocialPost', 'Email', 'WebSearch']

/** The full org chart. `role` matches the agentType of the built-in agents. */
export const MARKETING_ROLES: MarketingRole[] = [
	{
		role: 'marketing-director',
		mission:
			'Admin of admins for marketing. Owns campaign objective, positioning, the brand boundary, sign-off, and the publish gate per the governance hierarchy (Director > domain > default).',
		tools: ['Read', 'Glob', 'Grep', 'Agent'],
		modelTier: 'flagship',
		domain: null,
	},
	{
		role: 'marketing-strategist',
		mission:
			'Sets objective + audience + measurable goal, chooses the funnel stage + channel mix, writes the single-minded message + offer, and sequences the touches.',
		tools: BUILD_TOOLS,
		modelTier: 'flagship',
		domain: 'strategy',
	},
	{
		role: 'marketing-copywriter',
		mission:
			'Writes conversion-grade copy in the brand voice: hero + subhead + body + one CTA per view, platform-native. AIDA/PAS/FAB/hook-story-offer as the job demands. No filler, no lorem.',
		tools: [...READ_TOOLS, 'MarketingBuild'],
		modelTier: 'balanced',
		domain: 'copy',
	},
	{
		role: 'marketing-designer',
		mission:
			'Produces on-brand visual creative (ImageGen) — palette, type, composition, logo use consistent with the brand system. Generates variants, picks the on-brand one. Never misleading imagery.',
		tools: CREATIVE_TOOLS,
		modelTier: 'balanced',
		domain: 'design',
	},
	{
		role: 'marketing-videographer',
		mission:
			'Produces video / shorts (VideoGen): script first (hook <1s, payoff, CTA), 9:16 for shorts, captions burned in, ≤60s, sound-on safe. One idea per video; show the product.',
		tools: CREATIVE_TOOLS,
		modelTier: 'balanced',
		domain: 'video',
	},
	{
		role: 'marketing-social-manager',
		mission:
			'Publishes to social (SocialPost) in native format per platform, consistent identity, confines to the social.channels allowlist. EVERY post asks approval + is logged. Responds within SLA.',
		tools: PUBLISH_TOOLS,
		modelTier: 'balanced',
		domain: 'social',
	},
	{
		role: 'marketing-email-manager',
		mission:
			'Runs the email lifecycle (Email): permission only, double opt-in, clear unsubscribe, segmentation, welcome/nurture/re-engagement. EVERY send asks approval + is logged.',
		tools: PUBLISH_TOOLS,
		modelTier: 'balanced',
		domain: 'email',
	},
	{
		role: 'marketing-analytics',
		mission:
			'Instruments from day one (reach, engagement, CTR, conversion, CAC, retention), attributes, iterates. Kills what does not move the goal; doubles down on what does.',
		tools: [...READ_TOOLS, 'MarketingBuild'],
		modelTier: 'balanced',
		domain: 'analytics',
	},
	{
		role: 'marketing-curator',
		mission:
			'The employee that always updates the database. After a campaign, mines it for reusable assets (winning creative + prompt, copy, audience) and persists them to the knowledge base.',
		tools: READ_TOOLS,
		modelTier: 'fast',
		domain: null,
	},
]

const ROLE_BY_NAME: Record<string, MarketingRole> = Object.fromEntries(
	MARKETING_ROLES.map((r) => [r.role, r]),
)

/** Pick the lead specialist for a kind. */
function specialistForKind(kind: MarketingKind): string {
	switch (kind) {
		case 'social':
			return 'marketing-social-manager'
		case 'email':
			return 'marketing-email-manager'
		case 'video':
			return 'marketing-videographer'
		case 'content':
			return 'marketing-copywriter'
		case 'profile':
			return 'marketing-social-manager'
		default:
			return 'marketing-strategist'
	}
}

/** Build a campaign plan for an intent under a governance regime. */
export function planCampaign(intent: MarketingIntent, gov: MarketingGovernance): CampaignPlan {
	const kind: MarketingKind = intent.kind === 'unknown' ? 'campaign' : intent.kind
	const lead = specialistForKind(kind)

	const roles: MarketingRole[] = [
		ROLE_BY_NAME['marketing-director']!,
		ROLE_BY_NAME['marketing-strategist']!,
		ROLE_BY_NAME['marketing-copywriter']!,
		ROLE_BY_NAME['marketing-designer']!,
		ROLE_BY_NAME[lead]!,
		ROLE_BY_NAME['marketing-analytics']!,
		ROLE_BY_NAME['marketing-curator']!,
	]

	const tasks: MarketingTask[] = [
		{
			role: 'marketing-strategist',
			objective: `Define objective + audience + measurable goal for a ${kind} campaign; choose channel mix + funnel stage.`,
			dependsOn: [],
			output: 'campaign strategy',
		},
		{
			role: 'marketing-copywriter',
			objective: 'Write brand-voice copy: hero promise, proof, one CTA; platform-native lengths.',
			dependsOn: ['marketing-strategist'],
			output: 'copy',
		},
		{
			role: 'marketing-designer',
			objective: 'Produce on-brand visual creative (ImageGen) consistent with the brand system.',
			dependsOn: ['marketing-strategist'],
			output: 'visual creative',
		},
		{
			role: lead,
			objective: `Execute on ${kind}: produce/assemble assets (video/shorts if needed) and prepare publish-ready items confined to the channel allowlist.`,
			dependsOn: ['marketing-copywriter', 'marketing-designer'],
			output: `${kind} assets`,
		},
		{
			role: 'marketing-analytics',
			objective: 'Instrument + define KPIs; set up attribution for the goal.',
			dependsOn: ['marketing-strategist'],
			output: 'measurement plan',
		},
		{
			role: 'marketing-curator',
			objective: 'After publish, persist reusable creative/copy/audience to the knowledge base.',
			dependsOn: [lead],
			output: 'curated assets',
		},
	]

	const notes = marketingGovernanceNotes(gov)
	const delegationInstructions = renderDelegation(kind, lead, intent, notes)

	return { roles, tasks, delegationInstructions }
}

function renderDelegation(
	kind: MarketingKind,
	lead: string,
	intent: MarketingIntent,
	notes: string[],
): string {
	const lines: string[] = []
	lines.push(`# Marketing & Growth — campaign plan (kind: ${kind})`)
	lines.push(
		`confidence: ${intent.confidence.toFixed(2)} | triggers: ${intent.triggers.join(', ') || 'none'}`,
	)
	lines.push('')
	lines.push('Run these specialist agents in dependency order (Agent tool, subagent_type):')
	lines.push(
		'  1. marketing-director — owns objective + positioning + the publish gate + sign-off (admin of admins).',
	)
	lines.push(
		'  2. marketing-strategist — objective + audience + goal + channel mix + funnel stage.',
	)
	lines.push('  3. marketing-copywriter — brand-voice copy; hero → proof → one CTA.')
	lines.push('  4. marketing-designer — on-brand visual creative (ImageGen).')
	lines.push(`  5. ${lead} — produce/assemble ${kind} assets; prepare publish-ready items.`)
	lines.push('  6. marketing-analytics — instrument + KPIs + attribution.')
	lines.push('  7. marketing-curator — persist reusable creative/copy/audience.')
	lines.push('')
	lines.push(
		'Publish discipline: EVERY publish / send / post asks a human for approval BEFORE it goes out, and is appended to the reversible published log. Never publish confidential data or unverifiable claims; when unsure, escalate.',
	)
	if (notes.length) {
		lines.push('')
		lines.push('Governance (DIRECTOR > domain > default — honor these):')
		for (const n of notes) lines.push(`  - ${n}`)
	}
	return lines.join('\n')
}

/** Render a plan as a single delegation string for the main agent. */
export function formatCampaignPlanForDelegation(plan: CampaignPlan): string {
	const lines: string[] = [plan.delegationInstructions, '', 'Tasks:']
	for (const t of plan.tasks) {
		const dep = t.dependsOn.length ? ` (after ${t.dependsOn.join(', ')})` : ''
		lines.push(`  - [${t.role}]${dep} → ${t.output}: ${t.objective}`)
	}
	return lines.join('\n')
}
