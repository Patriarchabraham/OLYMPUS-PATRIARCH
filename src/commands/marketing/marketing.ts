/**
 * Olympuz Marketing & Growth — /marketing command.
 *
 * Subcommands:
 *   /marketing run <brief>                    Build the campaign plan for a brief.
 *   /marketing review [channel]               See everything published (the audit trail).
 *   /marketing reverse <id>                   Reverse a published item (delete/unlist a post).
 *   /marketing admin list|get|set <...>       Governance (Director > domain > default).
 *   /marketing knowledge stats|recall <q>     Curated campaign knowledge base.
 *   /marketing principles                     Print the full Marketing PRD.
 *   /marketing enable | disable               Toggle the department.
 *   /marketing status                         Current state.
 */

import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/index.mjs'
import type { Command } from '../../commands.js'
import { getPublish, listPublishes, markReversed } from '../../departments/publishedLog.js'
import { marketingKnowledgeStats, recallMarketingRelevant } from '../../marketing/curator.js'
import { formatCampaignPlanForDelegation } from '../../marketing/department.js'
import { marketingGovernanceNotes, resolveMarketingPolicy } from '../../marketing/governance.js'
import {
	getMarketingEngine,
	isMarketingActive,
	isTestEnv,
} from '../../marketing/marketingEngine.js'
import { MARKETING_PRD, MARKETING_PRD_VERSION } from '../../marketing/principles.js'
import type { SocialChannel } from '../../marketing/social/socialAdapter.js'
import { deletePost as socialDelete } from '../../marketing/social/socialAdapter.js'

function text(t: string): ContentBlockParam[] {
	return [{ type: 'text', text: t }]
}

const helpText = `[Marketing] — the Olympuz Marketing & Growth Department (PRD v${MARKETING_PRD_VERSION}).

Agents that build complete campaigns, generate images / videos / shorts, write
copy, create emails + official profiles, publish to social, and send email.

Marketing is ENABLED by default (mirrors Studio) but dormant under test. EVERY
publish / send / post asks a human for approval BEFORE it goes out, and every
published item is appended to the reversible published log.

Usage:
- /marketing run <brief>                    Plan + delegate a campaign
- /marketing review [channel]               See everything published (x|meta|linkedin|tiktok|youtube|email)
- /marketing reverse <id>                   Reverse a published social post (you confirming = approved)
- /marketing admin list                     Show active governance
- /marketing admin get <domain> <key>       Resolve one policy
- /marketing admin set <domain>.<key>=<v>   Set a policy (director.<domain>.<key>=… for Director)
- /marketing knowledge stats                Knowledge-base counts
- /marketing knowledge recall <query>       Recall relevant campaign know-how
- /marketing principles                     Print the full Marketing PRD
- /marketing enable | disable               Toggle the department
- /marketing status                         Current state`

async function runSubcommand(brief: string): Promise<ContentBlockParam[]> {
	const engine = getMarketingEngine()
	const intent = engine.detectIntent(brief)
	const plan = engine.planCampaign(intent)
	const notes = marketingGovernanceNotes(engine.governance)
	const digest = [
		`Marketing Department — plan for: "${brief}"`,
		`Intent: kind=${intent.kind} confidence=${intent.confidence.toFixed(2)} marketing=${intent.isMarketingRequest}`,
		`Governance: ${notes.length} active polic${notes.length === 1 ? 'y' : 'ies'}`,
		'',
		formatCampaignPlanForDelegation(plan),
		'',
		'Execute this plan now: spawn the listed specialist agents in dependency order (Agent tool, subagent_type = role). EVERY publish / send / post will ask approval before it goes out and is logged; the curator persists the winners.',
		'',
		`Marketing is currently ${isMarketingActive() ? 'ACTIVE' : 'INACTIVE (run /marketing enable to activate)'}.`,
	].join('\n')
	return text(digest)
}

async function reviewSubcommand(argRest: string): Promise<ContentBlockParam[]> {
	const channel = argRest.trim() || undefined
	const entries = listPublishes(channel ? { channel } : undefined)
	if (entries.length === 0) {
		return text(`[Marketing review] No published items${channel ? ` on ${channel}` : ''} yet.`)
	}
	const lines = [
		`[Marketing review] ${entries.length} published item(s)${channel ? ` on ${channel}` : ''}:`,
	]
	for (const e of entries) {
		const stamp = new Date(e.timestamp).toISOString()
		const preview = e.content.replace(/\s+/g, ' ').slice(0, 80)
		lines.push(
			`  - ${e.id} [${e.status}] ${e.channel}/${e.action} → ${e.target ?? '?'} @ ${stamp}${e.reversible ? '' : ' (not reversible)'}\n      "${preview}"`,
		)
	}
	lines.push('')
	lines.push('Reverse a social post with: /marketing reverse <id>')
	return text(lines.join('\n'))
}

async function reverseSubcommand(argRest: string): Promise<ContentBlockParam[]> {
	const id = argRest.trim()
	if (!id) return text('Usage: /marketing reverse <id>  (find ids with /marketing review)')
	const entry = getPublish(id)
	if (!entry) return text(`No published item with id "${id}".`)
	if (entry.status === 'reversed') return text(`"${id}" is already reversed.`)
	const socialChannels: SocialChannel[] = ['x', 'meta', 'linkedin', 'tiktok', 'youtube']
	if (!socialChannels.includes(entry.channel as SocialChannel)) {
		return text(
			`"${id}" is a ${entry.channel}/${entry.action} item and is NOT mechanically reversible from here. Email sends generally cannot be unsent — send a correction/follow-up instead.`,
		)
	}
	// The user typing /marketing reverse <id> IS the human approval for the reversal.
	const res = await socialDelete(entry.channel as SocialChannel, entry.target ?? '')
	if (!res.ok) {
		return text(
			`Reverse FAILED for "${id}" (${entry.channel}): ${res.error}\nThe log entry was NOT marked reversed.`,
		)
	}
	markReversed(id)
	return text(
		`Reversed "${id}" (${entry.channel}/${entry.action} → ${entry.target ?? '?'}). Log entry marked reversed.`,
	)
}

async function adminSubcommand(argRest: string): Promise<ContentBlockParam[]> {
	const parts = argRest.split(/\s+/).filter(Boolean)
	const sub = parts[0]
	const engine = getMarketingEngine()
	if (sub === 'list' || !sub) {
		const notes = marketingGovernanceNotes(engine.governance)
		return text(
			notes.length
				? `Active governance:\n${notes.map((n) => `  - ${n}`).join('\n')}`
				: 'No governance policies set (all defaults in effect).',
		)
	}
	if (sub === 'get') {
		const domain = parts[1] as never
		const key = parts[2]
		if (!domain || !key) return text('Usage: /marketing admin get <domain> <key>')
		const value = resolveMarketingPolicy(engine.governance, domain, key)
		return text(
			value === undefined
				? `${domain}.${key} = <unset>`
				: `${domain}.${key} = ${Array.isArray(value) ? value.join('|') : String(value)}`,
		)
	}
	if (sub === 'set') {
		const directive = parts.slice(1).join(' ')
		if (!directive) return text('Usage: /marketing admin set <domain>.<key>=<value>')
		engine.applyAdmin(directive)
		const notes = marketingGovernanceNotes(engine.governance)
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
		const s = marketingKnowledgeStats()
		return text(
			`Knowledge base: ${s.marketingEntities} marketing entities (${s.entities} total entities, ${s.summaries} summaries).`,
		)
	}
	if (sub === 'recall') {
		const query = parts.slice(1).join(' ')
		if (!query) return text('Usage: /marketing knowledge recall <query>')
		const hit = await recallMarketingRelevant(query)
		return text(hit || `No marketing knowledge found for "${query}".`)
	}
	return text(`Unknown knowledge subcommand "${sub}". Try: stats | recall.`)
}

function statusSubcommand(): ContentBlockParam[] {
	const engine = getMarketingEngine()
	const c = engine.config
	const lines = [
		`[Marketing status] PRD v${MARKETING_PRD_VERSION}`,
		`  enabled=${c.enabled}  autoActivate=${c.autoActivate}  intensity=${c.intensity}`,
		`  channels=${c.channels.length ? c.channels.join('|') : '(all)'}  publish=${c.publish.approvalPolicy}/${c.publish.logging ? 'logged' : 'unlogged'}`,
		`  isMarketingActive()=${isMarketingActive()}  isTestEnv()=${isTestEnv()}`,
		`  OLYMPUZ_MARKETING_ENABLED=${process.env.OLYMPUZ_MARKETING_ENABLED ?? '<unset>'}`,
		`  governance policies=${marketingGovernanceNotes(engine.governance).length}`,
		`  published items=${listPublishes().length}`,
	]
	return text(lines.join('\n'))
}

const command = {
	type: 'prompt',
	name: 'marketing',
	description:
		'Olympuz Marketing & Growth Department: plan/run campaigns, generate creative + video, publish to social, send email — every publish asks approval and is logged/reversible',
	isEnabled: () => true,
	progressMessage: 'marketing department',
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
				return rest ? runSubcommand(rest) : text('Usage: /marketing run <brief>')
			case 'review':
				return reviewSubcommand(rest)
			case 'reverse':
				return reverseSubcommand(rest)
			case 'admin':
				return adminSubcommand(rest)
			case 'knowledge':
				return knowledgeSubcommand(rest)
			case 'principles':
				return text(`Olympuz Marketing PRD v${MARKETING_PRD_VERSION}\n\n${MARKETING_PRD}`)
			case 'enable': {
				getMarketingEngine().setConfig({ enabled: true })
				return text(
					'Marketing department ENABLED. The Marketing PRD is appended to the system prompt and marketing-* specialists + tools are registered. EVERY publish/send/post still asks approval and is logged. Set OLYMPUZ_MARKETING_ENABLED=false to hard-kill.',
				)
			}
			case 'disable': {
				getMarketingEngine().setConfig({ enabled: false })
				return text(
					'Marketing department DISABLED (PRD no longer injected; marketing-* agents/tools unregistered; /marketing run still callable for planning).',
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
