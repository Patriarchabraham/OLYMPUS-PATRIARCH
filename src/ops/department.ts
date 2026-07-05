/**
 * Olympuz Agentic Operations — Department (the org chart of agentic "employees").
 *
 * Defines the specialist roles and turns an OpsIntent + governance into a
 * concrete OpsPlan: which roles run, in what order (a dependency graph), and the
 * delegation instructions the MAIN agent executes via the EXISTING Agent/swarm
 * runtime (spawnInProcessTeammate / team board). Ops emits a plan — it does not
 * re-implement spawning. Pure, no I/O.
 */

import { opsGovernanceNotes } from './governance.js'
import type { OpsGovernance, OpsIntent, OpsPlan, OpsRole, OpsSurface, OpsTask } from './types.js'

const _READ_TOOLS = ['Glob', 'Grep', 'Read', 'WebSearch', 'WebFetch']
const OPS_BUILD_TOOLS = ['Read', 'Glob', 'Grep', 'Bash', 'Agent']
const CONTROL_TOOLS = [
	'Read',
	'Glob',
	'Grep',
	'Bash',
	'OpsBuild',
	'BrowserControl',
	'Vision',
	'ComputerControl',
	'DeviceBridge',
]
const SENTINEL_TOOLS = ['Read', 'Glob', 'Grep']

/** The full org chart. `role` matches the agentType of the built-in ops agents. */
export const OPS_ROLES: OpsRole[] = [
	{
		role: 'ops-director',
		mission:
			'Admin of admins for operations. Owns task scope, the safety boundary, sign-off, and conflict resolution per the governance hierarchy (Director > domain > default).',
		tools: ['Read', 'Glob', 'Grep', 'Agent'],
		modelTier: 'flagship',
		domain: null,
	},
	{
		role: 'ops-computer-operator',
		mission:
			'Desktop control via the computer-use loop (screenshot/a11y → reason → one action → re-screenshot). Windows backend = PowerShell + .NET. Routes destructive actions through the approval gate.',
		tools: CONTROL_TOOLS,
		modelTier: 'flagship',
		domain: 'computer',
	},
	{
		role: 'ops-browser-operator',
		mission:
			'Browser automation — deterministic Playwright when selectors are known, vision-driven otherwise. Confines navigation to the governance allowlist; routes submit/payment through approval.',
		tools: [...CONTROL_TOOLS, 'WebFetch'],
		modelTier: 'flagship',
		domain: 'browser',
	},
	{
		role: 'ops-vision',
		mission:
			'Eyes. Deterministic screenshot metrics (analyzeScreenshot) + multimodal LLM judgment (describe/OCR/compare). Compresses before sending.',
		tools: ['Read', 'Vision', 'Glob', 'Grep'],
		modelTier: 'balanced',
		domain: 'vision',
	},
	{
		role: 'ops-ears',
		mission:
			'STT. Streaming transcription (voiceStreamSTT) or batch record+transcribe; boosts project keyterms so brand/tech words resolve correctly.',
		tools: ['Read', 'Listen'],
		modelTier: 'balanced',
		domain: 'voice',
	},
	{
		role: 'ops-voice',
		mission:
			'TTS. speak() (Windows SAPI / say / espeak / provider) — concise, never narrates secrets; honors the detected language.',
		tools: ['Read', 'Speak'],
		modelTier: 'fast',
		domain: 'voice',
	},
	{
		role: 'ops-automation-engineer',
		mission:
			'Designs the multi-step automation plan: step graph, idempotency, fail-safe, step budget (governance automation.maxSteps). Records reusable macros/selectors for the curator.',
		tools: OPS_BUILD_TOOLS,
		modelTier: 'balanced',
		domain: 'automation',
	},
	{
		role: 'ops-team-lead',
		mission:
			'Forms + coordinates autonomous agent teammates (native swarm: spawnInProcessTeammate / team board). Bounded objectives + tool allowlists per teammate. teams.requireApproval gates creation.',
		tools: ['Read', 'Glob', 'Grep', 'Agent'],
		modelTier: 'flagship',
		domain: 'teams',
	},
	{
		role: 'ops-sentinel',
		mission:
			'Safety reviewer. Adversarially checks every plan for approval-gate coverage, allowlist confinement, secret leakage, and fail-safe behavior. Any gap = plan rejected.',
		tools: SENTINEL_TOOLS,
		modelTier: 'flagship',
		domain: null,
	},
	{
		role: 'ops-curator',
		mission:
			'The employee that always updates the database. After a run, extracts reusable macros/selectors/workflows and persists them to the knowledge base.',
		tools: ['Read', 'Glob', 'Grep'],
		modelTier: 'fast',
		domain: null,
	},
]

const ROLE_BY_NAME: Record<string, OpsRole> = Object.fromEntries(OPS_ROLES.map((r) => [r.role, r]))

/** Pick the operator role for a surface. */
function operatorForSurface(surface: OpsSurface): string {
	if (surface === 'browser') return 'ops-browser-operator'
	if (surface === 'vision') return 'ops-vision'
	if (surface === 'voice') return 'ops-ears' // primary voice role is hearing; voice(tts) joins when needed
	// 'computer' | 'automation' | 'unknown' → computer operator
	return 'ops-computer-operator'
}

/** Build an ops plan for an intent under a governance regime. */
export function planOpsDepartment(intent: OpsIntent, gov: OpsGovernance): OpsPlan {
	const surface: OpsSurface = intent.surface === 'unknown' ? 'computer' : intent.surface
	const operator = operatorForSurface(surface)

	const roles: OpsRole[] = [
		ROLE_BY_NAME['ops-director']!,
		ROLE_BY_NAME['ops-automation-engineer']!,
		ROLE_BY_NAME[operator]!,
		ROLE_BY_NAME['ops-vision']!,
		ROLE_BY_NAME['ops-team-lead']!,
		ROLE_BY_NAME['ops-sentinel']!,
		ROLE_BY_NAME['ops-curator']!,
	]

	const tasks: OpsTask[] = [
		{
			role: 'ops-automation-engineer',
			objective: `Decompose the task into a bounded, idempotent step graph for surface=${surface} (respect automation.maxSteps).`,
			dependsOn: [],
			output: 'automation plan',
		},
		{
			role: operator,
			objective: `Execute the plan on the ${surface} surface via the computer-use loop; screenshot before each destructive action; route approvals.`,
			dependsOn: ['ops-automation-engineer'],
			output: `${surface} execution`,
		},
		{
			role: 'ops-vision',
			objective: 'Verify each step against the screen (metrics + model judgment); detect drift.',
			dependsOn: [operator],
			output: 'verification',
		},
		{
			role: 'ops-team-lead',
			objective:
				'Spawn specialist teammates if the plan is parallelizable (bounded objectives + allowlists).',
			dependsOn: ['ops-automation-engineer'],
			output: 'team plan',
		},
		{
			role: 'ops-sentinel',
			objective:
				'Adversarial safety review: approval coverage, allowlist confinement, secret leakage, fail-safe. Any gap = reject.',
			dependsOn: [operator, 'ops-vision'],
			output: 'safety verdict',
		},
		{
			role: 'ops-curator',
			objective: 'Persist reusable macros/selectors/workflows to the knowledge base.',
			dependsOn: ['ops-sentinel'],
			output: 'curated know-how',
		},
	]

	const notes = opsGovernanceNotes(gov)
	const delegationInstructions = renderOpsDelegation(surface, operator, intent, notes)

	return { roles, tasks, delegationInstructions }
}

function renderOpsDelegation(
	surface: OpsSurface,
	operator: string,
	intent: OpsIntent,
	notes: string[],
): string {
	const lines: string[] = []
	lines.push(`# Ops Department — delegation plan (surface: ${surface})`)
	lines.push(
		`confidence: ${intent.confidence.toFixed(2)} | triggers: ${intent.triggers.join(', ') || 'none'}`,
	)
	lines.push('')
	lines.push('Run these specialist agents in dependency order (Agent tool, subagent_type):')
	lines.push('  1. ops-director — owns scope + the safety boundary + sign-off (admin of admins).')
	lines.push(
		'  2. ops-automation-engineer — bounded, idempotent step graph; honor automation.maxSteps.',
	)
	lines.push(
		`  3. ${operator} — execute on ${surface}; screenshot before destructive actions; route approvals.`,
	)
	lines.push('  4. ops-vision — verify each step against the screen.')
	lines.push('  5. ops-team-lead — spawn teammates only if parallelizable + approved.')
	lines.push('  6. ops-sentinel — adversarial safety review; any gap = reject.')
	lines.push('  7. ops-curator — persist reusable macros/selectors/workflows.')
	lines.push('')
	lines.push(
		'Safety bar: opt-in only; destructive actions ask approval EACH TIME; look before you act; confine browsers to the allowlist; reversible-first; record publishes; fail safe (stop + report).',
	)
	if (notes.length) {
		lines.push('')
		lines.push('Governance (DIRECTOR > domain > default — honor these):')
		for (const n of notes) lines.push(`  - ${n}`)
	}
	return lines.join('\n')
}

/** Render a plan as a single delegation string for the main agent. */
export function formatOpsPlanForDelegation(plan: OpsPlan): string {
	const lines: string[] = [plan.delegationInstructions, '', 'Tasks:']
	for (const t of plan.tasks) {
		const dep = t.dependsOn.length ? ` (after ${t.dependsOn.join(', ')})` : ''
		lines.push(`  - [${t.role}]${dep} → ${t.output}: ${t.objective}`)
	}
	return lines.join('\n')
}
