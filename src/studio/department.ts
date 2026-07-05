/**
 * Olympuz Studio — Department (the org chart of agentic "employees").
 *
 * Defines the specialist roles and turns a StudioIntent + governance into a
 * concrete DepartmentPlan: which roles run, in what order (a dependency graph),
 * and the delegation instructions the MAIN agent executes via the EXISTING
 * Agent/swarm runtime. Studio does NOT re-implement spawning — it emits a plan.
 *
 * Pure, no I/O. Tested directly.
 */

import { governanceNotes } from './governance.js'
import type {
	DepartmentPlan,
	DepartmentTask,
	StudioGovernance,
	StudioIntent,
	StudioPlatform,
	StudioRole,
} from './types.js'

const READ_TOOLS = ['Glob', 'Grep', 'Read', 'WebSearch', 'WebFetch']
const BUILD_TOOLS = ['Read', 'Glob', 'Grep', 'FileEdit', 'FileWrite', 'Bash']
const QA_TOOLS = ['Read', 'Glob', 'Grep', 'Bash']

/** The full org chart. `role` matches the agentType of the built-in studio agents. */
export const STUDIO_ROLES: StudioRole[] = [
	{
		role: 'studio-director',
		mission:
			'Admin of admins. Owns scope, the definition of done, and sign-off. Resolves conflicts per the governance hierarchy (Director > domain > default).',
		tools: ['Read', 'Glob', 'Grep', 'Agent'],
		modelTier: 'flagship',
		domain: null,
	},
	{
		role: 'studio-researcher',
		mission:
			'Domain, competitor, and best-practice research. Surfaces references, patterns, and risks before design begins.',
		tools: READ_TOOLS,
		modelTier: 'flagship',
		domain: null,
	},
	{
		role: 'studio-design-system',
		mission:
			'Defines the design-token system for the chosen base color + mood (OKLCH ramp, semantics, type, spacing, motion) and emits CSS / Compose Kotlin / WinUI XAML.',
		tools: BUILD_TOOLS,
		modelTier: 'balanced',
		domain: 'design',
	},
	{
		role: 'studio-ux',
		mission: 'Information architecture, flows, layout, and accessibility plan.',
		tools: BUILD_TOOLS,
		modelTier: 'balanced',
		domain: 'ux',
	},
	{
		role: 'studio-ui',
		mission: 'Component design and visual polish, applying the token system.',
		tools: BUILD_TOOLS,
		modelTier: 'balanced',
		domain: 'design',
	},
	{
		role: 'studio-copy',
		mission: 'Copywriting — hero, microcopy, CTAs — using AIDA/PAS/FAB as appropriate.',
		tools: BUILD_TOOLS,
		modelTier: 'balanced',
		domain: 'copy',
	},
	{
		role: 'studio-effects',
		mission:
			'Effects/animation engineer: layered, artistic, platform-appropriate (GSAP/Motion/Three/Lottie on web; M3 Expressive on Android; Fluent Mica/Acrylic/connected-animations on Windows).',
		tools: BUILD_TOOLS,
		modelTier: 'balanced',
		domain: 'effects',
	},
	{
		role: 'studio-web',
		mission:
			'Web engineer (Next.js 15 + React 19 + Tailwind 4). Produces production-grade web code.',
		tools: BUILD_TOOLS,
		modelTier: 'balanced',
		domain: 'web',
	},
	{
		role: 'studio-android',
		mission:
			'Android engineer (Kotlin + Jetpack Compose + Material 3 Expressive). Produces production-grade Android code.',
		tools: BUILD_TOOLS,
		modelTier: 'balanced',
		domain: 'android',
	},
	{
		role: 'studio-windows',
		mission:
			'Windows engineer (WinUI 3 + Windows App SDK + .NET 8/9 + Fluent + MSIX). Produces production-grade native Windows 10/11 code.',
		tools: BUILD_TOOLS,
		modelTier: 'balanced',
		domain: 'windows',
	},
	{
		role: 'studio-qa',
		mission:
			'Adversarial review against the definition of done (contrast, a11y, build, completeness). Any fail = not done.',
		tools: QA_TOOLS,
		modelTier: 'flagship',
		domain: 'qa',
	},
	{
		role: 'studio-curator',
		mission:
			'The employee that always updates the database. After a run, extracts reusable palettes/tokens/effects/copy and persists them to the knowledge base.',
		tools: ['Read', 'Glob', 'Grep'],
		modelTier: 'fast',
		domain: null,
	},
]

const ROLE_BY_NAME: Record<string, StudioRole> = Object.fromEntries(
	STUDIO_ROLES.map((r) => [r.role, r]),
)

function engineerRole(platform: StudioPlatform | 'unknown'): string {
	if (platform === 'android') return 'studio-android'
	if (platform === 'windows') return 'studio-windows'
	// 'web' and 'unknown' both route to the web engineer (web is the default platform).
	return 'studio-web'
}

/**
 * Build a department plan for an intent under a governance regime.
 * Roles are selected by platform; the dependency graph is fixed and deterministic.
 */
export function planDepartment(intent: StudioIntent, gov: StudioGovernance): DepartmentPlan {
	const platform: StudioPlatform = (
		intent.platform === 'unknown' ? 'web' : intent.platform
	) as StudioPlatform
	const engineer = engineerRole(platform)

	const roles: StudioRole[] = [
		ROLE_BY_NAME['studio-director']!,
		ROLE_BY_NAME['studio-researcher']!,
		ROLE_BY_NAME['studio-design-system']!,
		ROLE_BY_NAME['studio-ux']!,
		ROLE_BY_NAME['studio-copy']!,
		ROLE_BY_NAME['studio-ui']!,
		ROLE_BY_NAME['studio-effects']!,
		ROLE_BY_NAME[engineer]!,
		ROLE_BY_NAME['studio-qa']!,
		ROLE_BY_NAME['studio-curator']!,
	]

	const tasks: DepartmentTask[] = [
		{
			role: 'studio-researcher',
			objective: `Research domain, competitors, and 2026 best practice for: ${intent.kind}`,
			dependsOn: [],
			output: 'research brief',
		},
		{
			role: 'studio-design-system',
			objective:
				'Define the full design-token system from the chosen base color + mood; emit CSS/Compose/XAML.',
			dependsOn: [],
			output: 'design tokens',
		},
		{
			role: 'studio-ux',
			objective: 'Information architecture, flows, layout, accessibility plan.',
			dependsOn: ['studio-researcher'],
			output: 'ux spec',
		},
		{
			role: 'studio-copy',
			objective: 'Hero, microcopy, CTAs (AIDA/PAS/FAB).',
			dependsOn: ['studio-researcher'],
			output: 'copy',
		},
		{
			role: 'studio-ui',
			objective: 'Components applying the token system + ux spec.',
			dependsOn: ['studio-design-system', 'studio-ux'],
			output: 'components',
		},
		{
			role: 'studio-effects',
			objective: `Layered, artistic motion/material for ${platform}.`,
			dependsOn: ['studio-ui'],
			output: 'effects',
		},
		{
			role: engineer,
			objective: `Implement the production-grade ${platform} build.`,
			dependsOn: ['studio-ui', 'studio-effects', 'studio-copy'],
			output: `${platform} code`,
		},
		{
			role: 'studio-qa',
			objective: 'Audit against the definition of done; any fail = not done.',
			dependsOn: [engineer],
			output: 'qa verdict',
		},
		{
			role: 'studio-curator',
			objective: 'Persist reusable assets to the knowledge base.',
			dependsOn: ['studio-qa'],
			output: 'curated assets',
		},
	]

	const notes = governanceNotes(gov)
	const delegationInstructions = renderDelegation(platform, engineer, intent, notes)

	return { roles, tasks, delegationInstructions }
}

function renderDelegation(
	platform: StudioPlatform,
	engineer: string,
	intent: StudioIntent,
	notes: string[],
): string {
	const lines: string[] = []
	lines.push(`# Studio Department — delegation plan (${platform})`)
	lines.push(`Brief kind: ${intent.kind} | confidence: ${intent.confidence.toFixed(2)}`)
	lines.push('')
	lines.push(
		'Run these specialist agents in dependency order (use the Agent tool with subagent_type):',
	)
	lines.push('  1. studio-director — owns scope + sign-off (admin of admins).')
	lines.push('  2. studio-researcher — domain + 2026 best-practice research.')
	lines.push(
		'  3. studio-design-system — tokens for the chosen base color + mood (emit CSS / Compose Kotlin / WinUI XAML).',
	)
	lines.push('  4. studio-ux → studio-copy (parallel, after research).')
	lines.push('  5. studio-ui (after tokens + ux).')
	lines.push(`  6. studio-effects — layered motion/material for ${platform}.`)
	lines.push(`  7. ${engineer} — implement the ${platform} build.`)
	lines.push('  8. studio-qa — audit vs the definition of done.')
	lines.push('  9. studio-curator — persist reusable assets to the knowledge base.')
	lines.push('')
	lines.push(
		'Definition of done: WCAG-AA contrast, real token system (no magic numbers), responsive + perf budget, real motion + material, real copy/imagery, a11y built in, builds with 0 errors.',
	)
	if (notes.length) {
		lines.push('')
		lines.push('Governance (DIRECTOR > domain > default — honor these):')
		for (const n of notes) lines.push(`  - ${n}`)
	}
	return lines.join('\n')
}

/** Render a plan as a single delegation string for the main agent. */
export function formatPlanForDelegation(plan: DepartmentPlan): string {
	const lines: string[] = [plan.delegationInstructions, '', 'Tasks:']
	for (const t of plan.tasks) {
		const dep = t.dependsOn.length ? ` (after ${t.dependsOn.join(', ')})` : ''
		lines.push(`  - [${t.role}]${dep} → ${t.output}: ${t.objective}`)
	}
	return lines.join('\n')
}
