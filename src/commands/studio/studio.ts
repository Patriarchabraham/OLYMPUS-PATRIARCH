/**
 * Olympuz Studio — /studio command.
 *
 * Subcommands:
 *   /studio run <brief>                     Build the department plan + tokens for a brief.
 *   /studio tokens [base] [mood] [--platform p]  Emit design tokens as CSS + Compose Kotlin + WinUI XAML.
 *   /studio principles                      Print the full Studio PRD.
 *   /studio admin list|get|set <...>        Governance (Director > domain > default).
 *   /studio knowledge stats|recall <query>  Curated knowledge base.
 *   /studio enable | disable                Toggle the department.
 *   /studio status                          Current state.
 */

import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/index.mjs'
import type { Command } from '../../commands.js'
import { knowledgeStats, recallRelevant } from '../../studio/curator.js'
import { formatPlanForDelegation } from '../../studio/department.js'
import {
	generateDesignTokens,
	tokensToComposeKotlin,
	tokensToCSS,
	tokensToWinUIXaml,
} from '../../studio/designTokens.js'
import { governanceNotes, resolvePolicy } from '../../studio/governance.js'
import { STUDIO_PRD, STUDIO_PRD_VERSION } from '../../studio/principles.js'
import { getStudioEngine, isStudioActive, isTestEnv } from '../../studio/studioEngine.js'
import type { StudioAesthetic, StudioPlatform } from '../../studio/types.js'

const MOODS: StudioAesthetic[] = [
	'neutral-adaptive',
	'luxury-dark-gold',
	'calm',
	'vibrant',
	'minimal',
	'bold',
]
const PLATFORMS: StudioPlatform[] = ['web', 'android', 'windows']

function text(t: string): ContentBlockParam[] {
	return [{ type: 'text', text: t }]
}

function parseBaseColor(part: string | undefined): string | undefined {
	if (!part) return undefined
	return /^#?[0-9a-fA-F]{6}$/.test(part) ? (part.startsWith('#') ? part : `#${part}`) : undefined
}

function parseMood(parts: string[]): StudioAesthetic | undefined {
	return parts.find((p) => (MOODS as string[]).includes(p)) as StudioAesthetic | undefined
}

function parsePlatformFlag(parts: string[]): StudioPlatform | undefined {
	const idx = parts.findIndex((p) => p === '--platform' || p === '-p')
	if (idx >= 0 && parts[idx + 1]) {
		const p = parts[idx + 1] as StudioPlatform
		if ((PLATFORMS as string[]).includes(p)) return p
	}
	return undefined
}

const helpText = `[Studio] — the Olympuz Design & Generation Department (PRD v${STUDIO_PRD_VERSION}).

Usage:
- /studio run <brief>                     Plan + tokens for a build brief
- /studio tokens [base] [mood] [--platform web|android|windows]
                                          Emit tokens (CSS + Compose Kotlin + WinUI XAML)
- /studio principles                      Print the full Studio PRD
- /studio admin list                      Show active governance
- /studio admin get <domain> <key>        Resolve one policy
- /studio admin set <domain>.<key>=<val>  Set a policy (director.<domain>.<key>=… for Director)
- /studio knowledge stats                 Knowledge-base counts
- /studio knowledge recall <query>        Recall relevant studio knowledge
- /studio enable | disable                Toggle the department
- /studio status                          Current state

Auto-activation is ON by default (dormant under test runs).`

async function runSubcommand(brief: string): Promise<ContentBlockParam[]> {
	const engine = getStudioEngine()
	const intent = engine.detectIntent(brief)
	const platform: StudioPlatform = intent.platform === 'unknown' ? 'web' : intent.platform
	const tokens = engine.generateTokens({ platform })
	const plan = engine.planBuild({ ...intent, platform })
	const digest = [
		`Studio Department — plan for: "${brief}"`,
		`Intent: ${intent.kind} on ${platform} (confidence ${intent.confidence.toFixed(2)})`,
		`Tokens: mood=${tokens.mood} base=${tokens.baseColor} contrastAA=${tokens.contrastVerified}`,
		`  bg=${tokens.color.semantic.bg.hex} fg=${tokens.color.semantic.fg.hex} accent=${tokens.color.semantic.accent.hex}`,
		'',
		formatPlanForDelegation(plan),
		'',
		'Execute this plan now: spawn the listed specialist agents in dependency order (Agent tool, subagent_type = role), then have the curator persist the reusable assets.',
	].join('\n')
	return text(digest)
}

async function tokensSubcommand(argRest: string): Promise<ContentBlockParam[]> {
	const parts = argRest.split(/\s+/).filter(Boolean)
	const baseColor = parseBaseColor(parts.find((p) => /^#?[0-9a-fA-F]{6}$/.test(p)))
	const mood = parseMood(parts)
	const platform = parsePlatformFlag(parts)
	const tokens = generateDesignTokens({ baseColor, mood, platform })
	const blocks: string[] = [
		`[Studio tokens] base=${tokens.baseColor} mood=${tokens.mood} platform=${tokens.platform} contrastAA=${tokens.contrastVerified}`,
		'',
	]
	if (!platform || platform === 'web') {
		blocks.push('--- CSS custom properties (web) ---', tokensToCSS(tokens), '')
	}
	if (!platform || platform === 'android') {
		blocks.push(
			'--- Compose Kotlin (Android: Color.kt / Type.kt / Shapes.kt) ---',
			tokensToComposeKotlin(tokens),
			'',
		)
	}
	if (!platform || platform === 'windows') {
		blocks.push(
			'--- WinUI XAML (Windows: Light/Dark ThemeDictionaries) ---',
			tokensToWinUIXaml(tokens),
			'',
		)
	}
	return text(blocks.join('\n'))
}

async function adminSubcommand(argRest: string): Promise<ContentBlockParam[]> {
	const parts = argRest.split(/\s+/).filter(Boolean)
	const sub = parts[0]
	const engine = getStudioEngine()
	if (sub === 'list' || !sub) {
		const notes = governanceNotes(engine.governance)
		return text(
			notes.length
				? `Active governance:\n${notes.map((n) => `  - ${n}`).join('\n')}`
				: 'No governance policies set (all defaults in effect).',
		)
	}
	if (sub === 'get') {
		const domain = parts[1] as never
		const key = parts[2]
		if (!domain || !key) return text('Usage: /studio admin get <domain> <key>')
		const value = resolvePolicy(engine.governance, domain, key)
		return text(
			value === undefined
				? `${domain}.${key} = <unset>`
				: `${domain}.${key} = ${Array.isArray(value) ? value.join('|') : String(value)}`,
		)
	}
	if (sub === 'set') {
		const directive = parts.slice(1).join(' ')
		if (!directive) return text('Usage: /studio admin set <domain>.<key>=<value>')
		engine.applyAdmin(directive)
		const notes = governanceNotes(engine.governance)
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
		const s = knowledgeStats()
		return text(
			`Knowledge base: ${s.studioEntities} studio entities (${s.entities} total entities, ${s.summaries} summaries).`,
		)
	}
	if (sub === 'recall') {
		const query = parts.slice(1).join(' ')
		if (!query) return text('Usage: /studio knowledge recall <query>')
		const hit = await recallRelevant(query)
		return text(hit || `No studio knowledge found for "${query}".`)
	}
	return text(`Unknown knowledge subcommand "${sub}". Try: stats | recall.`)
}

function statusSubcommand(): ContentBlockParam[] {
	const engine = getStudioEngine()
	const c = engine.config
	const lines = [
		`[Studio status] PRD v${STUDIO_PRD_VERSION}`,
		`  enabled=${c.enabled}  autoActivate=${c.autoActivate}  intensity=${c.intensity}`,
		`  defaultPlatform=${c.defaultPlatform}  aesthetic=${c.aesthetic}`,
		`  isStudioActive()=${isStudioActive()}  isTestEnv()=${isTestEnv()}`,
		`  governance policies=${governanceNotes(engine.governance).length}`,
	]
	return text(lines.join('\n'))
}

const command = {
	type: 'prompt',
	name: 'studio',
	description:
		'Olympuz Studio Design & Generation Department: plan builds, emit design tokens, govern, curate, toggle',
	isEnabled: () => true,
	progressMessage: 'studio department',
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
				return rest ? runSubcommand(rest) : text('Usage: /studio run <brief>')
			case 'tokens':
				return tokensSubcommand(rest)
			case 'principles':
				return text(`Olympuz Studio PRD v${STUDIO_PRD_VERSION}\n\n${STUDIO_PRD}`)
			case 'admin':
				return adminSubcommand(rest)
			case 'knowledge':
				return knowledgeSubcommand(rest)
			case 'enable': {
				getStudioEngine().setConfig({ enabled: true })
				return text('Studio department ENABLED.')
			}
			case 'disable': {
				getStudioEngine().setConfig({ enabled: false })
				return text(
					'Studio department DISABLED (PRD no longer injected; /studio run still callable).',
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
