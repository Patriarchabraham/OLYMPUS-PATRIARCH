/**
 * Olympuz Anthropic startup screen — filled-block text logo with sunset gradient.
 * Called once at CLI startup before the Ink UI renders.
 *
 * Olympuz Coder — Sovereign AI coding intelligence platform
 */

import { getRouteLabel, resolveRouteIdFromBaseUrl } from '../integrations/routeMetadata.js'
import {
	getCustomProxyDefaultModel,
	getCustomProxyModelCatalog,
} from '../services/api/customAnthropicProxyModels.js'
import { isLocalProviderUrl, resolveProviderRequest } from '../services/api/providerConfig.js'
import { getGlobalConfig } from '../utils/config.js'
import { parseUserSpecifiedModel } from '../utils/model/model.js'
import { findClosestModel } from '../utils/modelRanker.js'
import { getLocalOpenAICompatibleProviderLabel } from '../utils/providerDiscovery.js'
import { DEFAULT_GEMINI_MODEL } from '../utils/providerProfile.js'
import { getSettings_DEPRECATED } from '../utils/settings/settings.js'
import { ANSI_DIM, ANSI_RESET, ansiRgb } from '../utils/terminalAnsi.js'
import { type RGB, resolveLogoPalette } from './StartupScreen.palettes.js'

declare const MACRO: { VERSION: string; DISPLAY_VERSION?: string }

const RESET = ANSI_RESET
const DIM = ANSI_DIM

function lerp(a: RGB, b: RGB, t: number): RGB {
	return [
		Math.round(a[0] + (b[0] - a[0]) * t),
		Math.round(a[1] + (b[1] - a[1]) * t),
		Math.round(a[2] + (b[2] - a[2]) * t),
	]
}

function gradAt(stops: readonly RGB[], t: number): RGB {
	const c = Math.max(0, Math.min(1, t))
	const s = c * (stops.length - 1)
	const i = Math.floor(s)
	if (i >= stops.length - 1) return stops[stops.length - 1]
	return lerp(stops[i], stops[i + 1], s - i)
}

export function paintLine(text: string, stops: readonly RGB[], lineT: number): string {
	let out = ''
	for (let i = 0; i < text.length; i++) {
		const t = text.length > 1 ? lineT * 0.5 + (i / (text.length - 1)) * 0.5 : lineT
		const [r, g, b] = gradAt(stops, t)
		out += `${ansiRgb(r, g, b)}${text[i]}`
	}
	return out + RESET
}

// ─── Filled Block Text Logo ───────────────────────────────────────────────────
// OLYMPUZ CODER — 12 letters rendered as filled block ASCII art with Unicode box-drawing

const LOGO_OLYMPUS = [
	`   ██████╗ ██╗  ██╗   ██╗███╗   ███╗██████╗ ██╗   ██╗███████╗`,
	`  ██╔═══██╗██║  ╚██╗ ██╔╝████╗ ████║██╔══██╗██║   ██║╚══███╔╝`,
	`  ██║   ██║██║   ╚████╔╝ ██╔████╔██║██████╔╝██║   ██║  ███╔╝ `,
	`  ██║   ██║██║    ╚██╔╝  ██║╚██╔╝██║██╔═══╝ ██║   ██║ ███╔╝  `,
	`  ╚██████╔╝███████╗██║   ██║ ╚═╝ ██║██║     ╚██████╔╝███████╗`,
	`   ╚═════╝ ╚══════╝╚═╝   ╚═╝     ╚═╝╚═╝      ╚═════╝ ╚══════╝`,
	``,
	`       ██████╗ ██████╗ ██████╗ ███████╗██████╗ `,
	`      ██╔════╝██╔═══██╗██╔══██╗██╔════╝██╔══██╗`,
	`      ██║     ██║   ██║██║  ██║█████╗  ██████╔╝`,
	`      ██║     ██║   ██║██║  ██║██╔══╝  ██╔══██╗`,
	`      ╚██████╗╚██████╔╝██████╔╝███████╗██║  ██║`,
	`       ╚═════╝ ╚═════╝ ╚═════╝ ╚══════╝╚═╝  ╚═╝`,
]

// ─── Provider detection ───────────────────────────────────────────────────────

export function detectProvider(modelOverride?: string): {
	name: string
	model: string
	baseUrl: string
	isLocal: boolean
} {
	const hasAnthropicEnv =
		(process.env.ANTHROPIC_BASE_URL && process.env.ANTHROPIC_BASE_URL.trim() !== '') ||
		(process.env.ANTHROPIC_AUTH_TOKEN && process.env.ANTHROPIC_AUTH_TOKEN.trim() !== '')

	const useGemini =
		!hasAnthropicEnv &&
		(process.env.CLAUDE_CODE_USE_GEMINI === '1' || process.env.CLAUDE_CODE_USE_GEMINI === 'true')
	const useGithub =
		!hasAnthropicEnv &&
		(process.env.CLAUDE_CODE_USE_GITHUB === '1' || process.env.CLAUDE_CODE_USE_GITHUB === 'true')
	const useOpenAI =
		!hasAnthropicEnv &&
		(process.env.CLAUDE_CODE_USE_OPENAI === '1' || process.env.CLAUDE_CODE_USE_OPENAI === 'true')
	const useMistral =
		!hasAnthropicEnv &&
		(process.env.CLAUDE_CODE_USE_MISTRAL === '1' || process.env.CLAUDE_CODE_USE_MISTRAL === 'true')

	if (useGemini) {
		const model = modelOverride || process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL
		const baseUrl =
			process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com/v1beta/openai'
		return { name: 'Google Gemini', model, baseUrl, isLocal: false }
	}

	if (useMistral) {
		const model = modelOverride || process.env.MISTRAL_MODEL || 'devstral-latest'
		const baseUrl = process.env.MISTRAL_BASE_URL || 'https://api.mistral.ai/v1'
		return { name: 'Mistral', model, baseUrl, isLocal: false }
	}

	if (useGithub) {
		const model = modelOverride || process.env.OPENAI_MODEL || 'github:copilot'
		const baseUrl = process.env.OPENAI_BASE_URL || 'https://api.githubcopilot.com'
		return { name: 'GitHub Copilot', model, baseUrl, isLocal: false }
	}

	if (useOpenAI) {
		const rawModel = modelOverride || process.env.OPENAI_MODEL || 'gpt-4o'
		const resolvedRequest = resolveProviderRequest({
			model: rawModel,
			baseUrl: process.env.OPENAI_BASE_URL,
		})
		const baseUrl = resolvedRequest.baseUrl
		const isLocal = isLocalProviderUrl(baseUrl)
		const routeId = resolveRouteIdFromBaseUrl(baseUrl)
		let name = 'OpenAI'
		// Explicit dedicated-provider env flags win.
		if (process.env.NVIDIA_NIM) name = 'NVIDIA NIM'
		else if (process.env.MINIMAX_API_KEY) name = 'MiniMax'
		else if (
			resolvedRequest.transport === 'codex_responses' ||
			baseUrl.includes('chatgpt.com/backend-api/codex')
		)
			name = 'Codex'
		// Base URL is authoritative — must precede rawModel checks so aggregators
		// (OpenRouter/Together/Groq) aren't mislabelled as DeepSeek/Kimi/etc.
		// when routed to models whose IDs contain a vendor prefix. See issue #855.
		else if (/openrouter/i.test(baseUrl)) name = 'OpenRouter'
		else if (/together/i.test(baseUrl)) name = 'Together AI'
		else if (/groq/i.test(baseUrl)) name = 'Groq'
		else if (/azure/i.test(baseUrl)) name = 'Azure OpenAI'
		else if (/nvidia/i.test(baseUrl)) name = 'NVIDIA NIM'
		else if (/minimax/i.test(baseUrl)) name = 'MiniMax'
		else if (/api\.kimi\.com/i.test(baseUrl)) name = 'Moonshot AI - Kimi Code'
		else if (routeId && routeId !== 'openai' && routeId !== 'custom')
			name = getRouteLabel(routeId) ?? name
		else if (/moonshot/i.test(baseUrl)) name = 'Moonshot AI - API'
		else if (/deepseek/i.test(baseUrl)) name = 'DeepSeek'
		else if (/mistral/i.test(baseUrl)) name = 'Mistral'
		// rawModel fallback — fires only when base URL is generic/custom.
		else if (/nvidia/i.test(rawModel)) name = 'NVIDIA NIM'
		else if (/minimax/i.test(rawModel)) name = 'MiniMax'
		else if (/\bkimi-for-coding\b/i.test(rawModel)) name = 'Moonshot AI - Kimi Code'
		else if (/\bkimi-k/i.test(rawModel) || /moonshot/i.test(rawModel)) name = 'Moonshot AI - API'
		else if (/deepseek/i.test(rawModel)) name = 'DeepSeek'
		else if (/mistral/i.test(rawModel)) name = 'Mistral'
		else if (/llama/i.test(rawModel)) name = 'Meta Llama'
		else if (/ollama/i.test(baseUrl) || baseUrl.includes(':11434')) name = 'Ollama'
		else if (/bankr/i.test(baseUrl)) name = 'Bankr'
		else if (/bankr/i.test(rawModel)) name = 'Bankr'
		else if (isLocal) name = getLocalOpenAICompatibleProviderLabel(baseUrl)

		// Resolve model alias to actual model name + reasoning effort
		let displayModel = resolvedRequest.resolvedModel
		if (resolvedRequest.reasoning?.effort) {
			displayModel = `${displayModel} (${resolvedRequest.reasoning.effort})`
		}

		return { name, model: displayModel, baseUrl, isLocal }
	}

	// Ollama: OLLAMA_BASE_URL set directly (before the OpenAI shim kicks in)
	if (process.env.OLLAMA_BASE_URL && !process.env.CLAUDE_CODE_USE_OPENAI) {
		const ollamaBase = process.env.OLLAMA_BASE_URL.replace(/\/+$/, '')
		const model = modelOverride || process.env.OLLAMA_MODEL || process.env.OPENAI_MODEL || 'llama3'
		return { name: 'Ollama', model, baseUrl: ollamaBase, isLocal: true }
	}

	// Anthropic / custom Anthropic-compatible proxy
	const settings = getSettings_DEPRECATED() || {}
	const baseUrl = process.env.ANTHROPIC_BASE_URL?.trim() || 'https://api.anthropic.com'
	const isCustomProxy = baseUrl !== 'https://api.anthropic.com'
	const isLocal = isLocalProviderUrl(baseUrl)

	// Detect provider name from the base URL when using a custom proxy
	let name = 'Anthropic'
	if (isCustomProxy) {
		try {
			const parsed = new URL(baseUrl)
			const host = parsed.hostname.toLowerCase()
			const path = parsed.pathname.toLowerCase()
			if (host.includes('bigmodel') || host.includes('zhipu') || path.includes('bigmodel'))
				name = 'BigModel (ZhipuAI)'
			else if (host.includes('deepseek')) name = 'DeepSeek'
			else if (host.includes('openrouter')) name = 'OpenRouter'
			else if (host.includes('groq')) name = 'Groq'
			else if (host.includes('together')) name = 'Together AI'
			else if (host.includes('mistral')) name = 'Mistral'
			else if (host.includes('moonshot') || host.includes('kimi')) name = 'Moonshot AI'
			else if (host.includes('minimax')) name = 'MiniMax'
			else if (host.includes('azure') || host.includes('microsoft')) name = 'Azure'
			else if (isLocal) name = 'Local (Anthropic-compatible)'
			else name = `Custom (${parsed.hostname})`
		} catch {
			name = 'Custom Proxy'
		}
	}

	// Model: env var wins, then config, then the proxy catalog default (e.g.
	// glm-5.1 for BigModel), then a Claude fallback. Custom proxies reject
	// Claude model IDs, so the catalog default must win over the Claude default.
	const modelSetting =
		modelOverride || process.env.ANTHROPIC_MODEL || process.env.CLAUDE_MODEL || settings.model
	const proxyDefault = isCustomProxy ? getCustomProxyDefaultModel(baseUrl) : null
	const resolvedModel = modelSetting
		? parseUserSpecifiedModel(modelSetting)
		: (proxyDefault ?? (isCustomProxy ? 'claude-3-5-sonnet-20241022' : 'claude-sonnet-4-6'))

	return { name, model: resolvedModel, baseUrl, isLocal }
}

// ─── Box drawing ──────────────────────────────────────────────────────────────

function boxRow(content: string, width: number, rawLen: number, border: RGB): string {
	const pad = Math.max(0, width - 2 - rawLen)
	return `${ansiRgb(...border)}\u2502${RESET}${content}${' '.repeat(pad)}${ansiRgb(...border)}\u2502${RESET}`
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function printStartupScreen(modelOverride?: string): void {
	// Skip in non-interactive / CI / print mode
	if (process.env.CI || !process.stdout.isTTY) return

	const palette = resolveLogoPalette(getGlobalConfig().logoColor)
	const ACCENT = palette.accent
	const CREAM = palette.cream
	const DIMCOL = palette.dim
	const BORDER = palette.border
	const GRAD = palette.gradient

	const p = detectProvider(modelOverride)
	const W = 96
	const out: string[] = []

	out.push('')

	// Gradient logo — OLYMPUS
	const allLogo = [...LOGO_OLYMPUS]
	const total = allLogo.length
	for (let i = 0; i < total; i++) {
		const t = total > 1 ? i / (total - 1) : 0
		if (allLogo[i] === '') {
			out.push('')
		} else {
			out.push(paintLine(allLogo[i], GRAD, t))
		}
	}

	out.push('')

	// Tagline
	out.push(
		`  ${ansiRgb(...ACCENT)}\u2726${RESET} ${ansiRgb(...CREAM)}OLYMPUZ CODER \u2014 Where gods code.${RESET} ${ansiRgb(...ACCENT)}\u2726${RESET}`,
	)
	out.push('')

	// Provider info box
	out.push(`${ansiRgb(...BORDER)}\u2554${'\u2550'.repeat(W - 2)}\u2557${RESET}`)

	const lbl = (k: string, v: string, c: RGB = CREAM): [string, number] => {
		const padK = k.padEnd(9)
		return [
			` ${DIM}${ansiRgb(...DIMCOL)}${padK}${RESET} ${ansiRgb(...c)}${v}${RESET}`,
			` ${padK} ${v}`.length,
		]
	}

	const provC: RGB = p.isLocal ? [130, 175, 130] : ACCENT
	let [r, l] = lbl('Provider', p.name, provC)
	out.push(boxRow(r, W, l, BORDER))
	;[r, l] = lbl('Model', p.model)
	out.push(boxRow(r, W, l, BORDER))
	const ep = p.baseUrl.length > 38 ? `${p.baseUrl.slice(0, 35)}...` : p.baseUrl
	;[r, l] = lbl('Endpoint', ep)
	out.push(boxRow(r, W, l, BORDER))

	// Model quality indicator from the model ranking system
	const caps = findClosestModel(p.model)
	const tierLabel = caps
		? caps.reasoning >= 9
			? 'Tier 1 — Supreme'
			: caps.reasoning >= 7
				? 'Tier 2 — Strong'
				: 'Tier 3 — Fast'
		: 'Unknown'
	const tierColor: RGB = caps
		? caps.reasoning >= 9
			? ACCENT
			: caps.reasoning >= 7
				? CREAM
				: DIMCOL
		: DIMCOL
	;[r, l] = lbl('Quality', tierLabel, tierColor)
	out.push(boxRow(r, W, l, BORDER))

	// When routing to a known custom Anthropic proxy (BigModel/ZhipuAI, ...),
	// list its top-tier models so the user can pick one. Claude model IDs do
	// not exist on these endpoints, so the choice matters.
	const proxyCatalog = getCustomProxyModelCatalog()
	if (proxyCatalog) {
		const headRow = ` ${ansiRgb(...ACCENT)}Top-tier models${RESET} ${DIM}${ansiRgb(...DIMCOL)}\u2014 pick with ${RESET}${ansiRgb(...ACCENT)}/model${RESET}${DIM}${ansiRgb(...DIMCOL)} or ${RESET}${ansiRgb(...ACCENT)}ANTHROPIC_MODEL${RESET}`
		const headLen = ` Top-tier models \u2014 pick with /model or ANTHROPIC_MODEL`.length
		out.push(boxRow(headRow, W, headLen, BORDER))
		for (const m of proxyCatalog.models) {
			const marker =
				m.id === p.model
					? `${ansiRgb(...ACCENT)}\u25b6${RESET}`
					: `${DIM}${ansiRgb(...DIMCOL)}\u2022${RESET}`
			const star = m.recommended ? `${ansiRgb(...ACCENT)} \u2605${RESET}` : ''
			const modelLabel =
				m.id === p.model
					? `${ansiRgb(...CREAM)}${m.label}${RESET}${star} ${DIM}${ansiRgb(...DIMCOL)}(active)${RESET}`
					: `${ansiRgb(...CREAM)}${m.label}${RESET}${star}`
			const noteText = m.note ? ` ${DIM}${ansiRgb(...DIMCOL)}\u2014 ${m.note}${RESET}` : ''
			const row = `   ${marker} ${modelLabel}${noteText}`
			// Raw length estimate for box padding (ANSI codes stripped).
			const rawLen =
				`   ${m.id === p.model ? '\u25b6' : '\u2022'} ${m.label}${m.recommended ? ' \u2605' : ''}${m.id === p.model ? ' (active)' : ''}${m.note ? ` \u2014 ${m.note}` : ''}`
					.length
			out.push(boxRow(row, W, rawLen, BORDER))
		}
		const switchHint = ` ${DIM}${ansiRgb(...DIMCOL)}Active model above. Switch anytime with ${RESET}${ansiRgb(...ACCENT)}/model ${proxyCatalog.models.map((m) => m.id).join(' | ')}${RESET}`
		const switchRawLen =
			` Active model above. Switch anytime with /model ${proxyCatalog.models.map((m) => m.id).join(' | ')}`
				.length
		out.push(boxRow(switchHint, W, switchRawLen, BORDER))
	}

	out.push(`${ansiRgb(...BORDER)}\u2560${'\u2550'.repeat(W - 2)}\u2563${RESET}`)

	const sC: RGB = p.isLocal ? [130, 175, 130] : ACCENT
	const sL = p.isLocal ? 'local' : 'cloud'
	const sRow = ` ${ansiRgb(...sC)}\u25cf${RESET} ${DIM}${ansiRgb(...DIMCOL)}${sL}${RESET}    ${DIM}${ansiRgb(...DIMCOL)}Ready \u2014 type ${RESET}${ansiRgb(...ACCENT)}/help${RESET}${DIM}${ansiRgb(...DIMCOL)} to begin${RESET}`
	const sLen = ` \u25cf ${sL}    Ready \u2014 type /help to begin`.length
	out.push(boxRow(sRow, W, sLen, BORDER))

	out.push(`${ansiRgb(...BORDER)}\u255a${'\u2550'.repeat(W - 2)}\u255d${RESET}`)
	out.push(
		`  ${DIM}${ansiRgb(...DIMCOL)}OLYMPUZ CODER ${RESET}${ansiRgb(...ACCENT)}v${MACRO.DISPLAY_VERSION ?? MACRO.VERSION}${RESET}`,
	)
	out.push('')

	process.stdout.write(`${out.join('\n')}\n`)
}
