/**
 * Olympuz Agentic Operations — /ops command.
 *
 * Subcommands:
 *   /ops run <task>                       Build the department control plan for a task.
 *   /ops team list|new|spawn <...>        Org-board / autonomous team composition.
 *   /ops review                           Recent ops knowledge + run state.
 *   /ops admin list|get|set <...>         Governance (Director > domain > default).
 *   /ops knowledge stats|recall <query>   Curated automation knowledge base.
 *   /ops principles                       Print the full Ops PRD.
 *   /ops enable | disable                 Toggle the department (opt-in).
 *   /ops status                           Current state.
 */

import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/index.mjs'
import type { Command } from '../../commands.js'
import { opsKnowledgeStats, recallOpsRelevant } from '../../ops/curator.js'
import { formatOpsPlanForDelegation } from '../../ops/department.js'
import { opsGovernanceNotes, resolveOpsPolicy } from '../../ops/governance.js'
import { getOpsEngine, isOpsActive, isTestEnv } from '../../ops/opsEngine.js'
import { OPS_PRD, OPS_PRD_VERSION } from '../../ops/principles.js'

function text(t: string): ContentBlockParam[] {
	return [{ type: 'text', text: t }]
}

const helpText = `[Ops] — the Olympuz Agentic Operations Department (PRD v${OPS_PRD_VERSION}).

Agents that control Windows + any browser, run any task from the prompt on the PC,
see (vision), hear (STT), speak (TTS), and form autonomous agent teams.

Ops is OPT-IN: it is dormant until you run \`/ops enable\` (or set OLYMPUZ_OPS_ENABLED).
Destructive actions (mouse/keyboard/shell/file-delete/browser-submit) ALWAYS ask
approval; read-only actions (screenshot, a11y tree, vision, listen, speak) do not.

Usage:
- /ops run <task>                       Plan + delegate a control task
- /ops team list                        Show the autonomous-team capability
- /ops team new <name>                  Plan a fresh autonomous team for a goal
- /ops team spawn <role>                Plan spawning one specialist teammate
- /ops review                           Recent ops knowledge + state
- /ops admin list                       Show active governance
- /ops admin get <domain> <key>         Resolve one policy
- /ops admin set <domain>.<key>=<val>   Set a policy (director.<domain>.<key>=… for Director)
- /ops knowledge stats                  Knowledge-base counts
- /ops knowledge recall <query>         Recall relevant ops know-how
- /ops principles                       Print the full Ops PRD
- /ops enable | disable                 Toggle the department
- /ops status                           Current state`

async function runSubcommand(task: string): Promise<ContentBlockParam[]> {
	const engine = getOpsEngine()
	const intent = engine.detectIntent(task)
	const plan = engine.planOps(intent)
	const notes = opsGovernanceNotes(engine.governance)
	const digest = [
		`Ops Department — plan for: "${task}"`,
		`Intent: surface=${intent.surface} confidence=${intent.confidence.toFixed(2)} ops=${intent.isOpsRequest}`,
		`Governance: ${notes.length} active polic${notes.length === 1 ? 'y' : 'ies'}`,
		'',
		formatOpsPlanForDelegation(plan),
		'',
		'Execute this plan now: spawn the listed specialist agents in dependency order (Agent tool, subagent_type = role), then have the curator persist the reusable macros/selectors. Destructive actions will ask approval before running; read-only actions will not.',
		'',
		`Ops is currently ${isOpsActive() ? 'ACTIVE' : 'INACTIVE (run /ops enable to activate)'}.`,
	].join('\n')
	return text(digest)
}

async function teamSubcommand(argRest: string): Promise<ContentBlockParam[]> {
	const parts = argRest.split(/\s+/).filter(Boolean)
	const sub = parts[0]
	if (sub === 'list' || !sub) {
		return text(
			[
				'[Ops team capability]',
				'Olympuz has a NATIVE swarm runtime — no external framework needed. Compose autonomous teams from the org board with these already-registered tools:',
				'  - TeamCreate / TeamDelete  — form or dissolve an autonomous team',
				'  - SendMessage              — talk to a named teammate',
				'  - Agent (subagent_type)    — spawn any ops-* specialist defined by this department',
				'',
				'Use `/ops team new <goal>` to plan a team for a goal, or `/ops team spawn <role>` to plan one specialist (e.g. role=ops-browser-operator).',
				`Governance: teams.requireApproval controls per-action approval; teams.maxTeammates bounds size. Active = ${opsGovernanceNotes(getOpsEngine().governance).filter((n) => n.includes('teams.')).length} team polic(ies).`,
			].join('\n'),
		)
	}
	if (sub === 'new') {
		const goal = parts.slice(1).join(' ')
		if (!goal) return text('Usage: /ops team new <goal>')
		const engine = getOpsEngine()
		const plan = engine.planOps(engine.detectIntent(goal))
		return text(
			[
				`[Ops team plan] goal: "${goal}"`,
				'Compose a small autonomous team (prefer ≤ teams.maxTeammates). Suggested specialist roster from this department:',
				...plan.roles.map((r) => `  - ${r.role}: ${r.mission}`),
				'',
				'Execution: create the team (TeamCreate), spawn each specialist (Agent, subagent_type = role), assign objectives via SendMessage in dependency order. The ops-team-lead coordinates; ops-sentinel guards every destructive action.',
			].join('\n'),
		)
	}
	if (sub === 'spawn') {
		const role = parts[1]
		if (!role) return text('Usage: /ops team spawn <role>  (e.g. ops-browser-operator)')
		return text(
			`Spawn one specialist: use the Agent tool with subagent_type="${role}". The agent carries this department's PRD + safety bar. Destructive actions it takes will still route through the approval gate.`,
		)
	}
	return text(`Unknown team subcommand "${sub}". Try: list | new | spawn.`)
}

async function reviewSubcommand(): Promise<ContentBlockParam[]> {
	const s = opsKnowledgeStats()
	return text(
		[
			'[Ops review]',
			`Knowledge base: ${s.opsEntities} ops entities (${s.entities} total, ${s.summaries} summaries).`,
			`isOpsActive()=${isOpsActive()}  isTestEnv()=${isTestEnv()}`,
			'Recent know-how:',
			(await recallOpsRelevant('recent ops macro selector workflow')).trim() ||
				'  (nothing recorded yet — run /ops run, then the curator persists reusable assets.)',
		].join('\n'),
	)
}

async function adminSubcommand(argRest: string): Promise<ContentBlockParam[]> {
	const parts = argRest.split(/\s+/).filter(Boolean)
	const sub = parts[0]
	const engine = getOpsEngine()
	if (sub === 'list' || !sub) {
		const notes = opsGovernanceNotes(engine.governance)
		return text(
			notes.length
				? `Active governance:\n${notes.map((n) => `  - ${n}`).join('\n')}`
				: 'No governance policies set (all defaults in effect).',
		)
	}
	if (sub === 'get') {
		const domain = parts[1] as never
		const key = parts[2]
		if (!domain || !key) return text('Usage: /ops admin get <domain> <key>')
		const value = resolveOpsPolicy(engine.governance, domain, key)
		return text(
			value === undefined
				? `${domain}.${key} = <unset>`
				: `${domain}.${key} = ${Array.isArray(value) ? value.join('|') : String(value)}`,
		)
	}
	if (sub === 'set') {
		const directive = parts.slice(1).join(' ')
		if (!directive) return text('Usage: /ops admin set <domain>.<key>=<value>')
		engine.applyAdmin(directive)
		const notes = opsGovernanceNotes(engine.governance)
		return text(
			`Applied: ${directive}\n\nActive governance:\n${notes.map((n) => `  - ${n}`).join('\n')}`,
		)
	}
	return text(`Unknown admin subcommand "${sub}". Try: list | get | set.`)
}

async function knowledgeSubcommand(argRest: string): Promise<ContentBlockParam[]> {
	const parts = argRest.split(/\s+/).filter(Boolean)
	const sub = parts[0]
	if (sub === 'stats' || !sub) {
		const s = opsKnowledgeStats()
		return text(
			`Knowledge base: ${s.opsEntities} ops entities (${s.entities} total entities, ${s.summaries} summaries).`,
		)
	}
	if (sub === 'recall') {
		const query = parts.slice(1).join(' ')
		if (!query) return text('Usage: /ops knowledge recall <query>')
		const hit = await recallOpsRelevant(query)
		return text(hit || `No ops knowledge found for "${query}".`)
	}
	return text(`Unknown knowledge subcommand "${sub}". Try: stats | recall.`)
}

function statusSubcommand(): ContentBlockParam[] {
	const engine = getOpsEngine()
	const c = engine.config
	const lines = [
		`[Ops status] PRD v${OPS_PRD_VERSION}`,
		`  enabled=${c.enabled}  autoActivate=${c.autoActivate}  intensity=${c.intensity}`,
		`  surfaces=${c.surfaces.length ? c.surfaces.join('|') : '(all)'}  approvalPolicy=${c.approvalPolicy}`,
		`  isOpsActive()=${isOpsActive()}  isTestEnv()=${isTestEnv()}`,
		`  OLYMPUZ_OPS_ENABLED=${process.env.OLYMPUZ_OPS_ENABLED ?? '<unset>'}`,
		`  governance policies=${opsGovernanceNotes(engine.governance).length}`,
	]
	return text(lines.join('\n'))
}

const command = {
	type: 'prompt',
	name: 'ops',
	description:
		'Olympuz Agentic Operations Department: control Windows + browsers, see/hear/speak, run autonomous agent teams — opt-in, with per-action approval',
	isEnabled: () => true,
	progressMessage: 'ops department',
	contentLength: 0,
	source: 'builtin',
	async getPromptForCommand(args: string): Promise<ContentBlockParam[]> {
		const trimmed = (args ?? '').trim()
		if (!trimmed || trimmed === 'help') return text(helpText)
		const sp = trimmed.indexOf(' ')
		const sub = sp < 0 ? trimmed : trimmed.slice(0, sp)
		const rest = sp < 0 ? '' : trimmed.slice(sp + 1).trim()

		switch (sub) {
			case 'run':
				return rest ? runSubcommand(rest) : text('Usage: /ops run <task>')
			case 'team':
				return teamSubcommand(rest)
			case 'review':
				return reviewSubcommand()
			case 'admin':
				return adminSubcommand(rest)
			case 'knowledge':
				return knowledgeSubcommand(rest)
			case 'principles':
				return text(`Olympuz Ops PRD v${OPS_PRD_VERSION}\n\n${OPS_PRD}`)
			case 'enable': {
				getOpsEngine().setConfig({ enabled: true })
				return text(
					'Ops department ENABLED. The Ops PRD is now appended to the system prompt and ops-* specialists + tools are registered. Destructive actions still require per-action approval. Set OLYMPUZ_OPS_ENABLED=false to hard-kill.',
				)
			}
			case 'disable': {
				getOpsEngine().setConfig({ enabled: false })
				return text(
					'Ops department DISABLED (PRD no longer injected; ops-* agents/tools unregistered; /ops run still callable for planning).',
				)
			}
			case 'status':
				return statusSubcommand()
			default:
				return text(`Unknown subcommand "${sub}".\n\n${helpText}`)
		}
	},
} satisfies Command

export default command
