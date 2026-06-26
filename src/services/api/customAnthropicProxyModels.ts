/**
 * Catalog of top-tier models for known Anthropic-compatible proxy providers.
 *
 * When a user points ANTHROPIC_BASE_URL at a third-party Anthropic-compatible
 * endpoint (BigModel/ZhiPu, OpenRouter, etc.), the real Anthropic model IDs
 * (claude-sonnet-4-6, claude-3-5-sonnet-...) do not exist there and the proxy
 * rejects them (e.g. BigModel error 1211 "模型不存在" / "model does not exist").
 *
 * This module detects the proxy from the base URL and returns the right set of
 * top-tier models + a sensible default so requests succeed out of the box.
 *
 * ANTHROPIC_MODEL always wins — these are only fallbacks when nothing is set.
 */

export type ProxyModel = {
	/** Model ID sent to the API in the `model` field. */
	id: string
	/** Human-readable label for the picker / banner. */
	label: string
	/** Short note (context window, tier, etc.) shown to the user. */
	note?: string
	/** Whether this is the recommended default for the provider. */
	recommended?: boolean
}

export type ProxyModelCatalog = {
	/** Stable provider id (e.g. 'bigmodel'). */
	providerId: string
	/** Display name for the banner (e.g. 'BigModel (ZhipuAI)'). */
	providerName: string
	/** The recommended top-tier model to default to. */
	defaultModel: string
	/** Full list of selectable top-tier models, best first. */
	models: ProxyModel[]
}

function hostMatches(baseUrl: string | undefined, needles: string[]): boolean {
	if (!baseUrl) return false
	try {
		const host = new URL(baseUrl).hostname.toLowerCase()
		const path = new URL(baseUrl).pathname.toLowerCase()
		return needles.some((n) => host.includes(n) || path.includes(n))
	} catch {
		return false
	}
}

// ─── BigModel / ZhipuAI (Anthropic-compatible endpoint) ───────────────────────
const BIGMODEL_CATALOG: ProxyModelCatalog = {
	providerId: 'bigmodel',
	providerName: 'BigModel (ZhipuAI)',
	defaultModel: 'glm-5.1',
	models: [
		{
			id: 'glm-5.1',
			label: 'GLM-5.1',
			note: 'Flagship · 200K context · 131K output · top-tier reasoning + coding',
			recommended: true,
		},
		{
			id: 'glm-5',
			label: 'GLM-5',
			note: '200K context · 131K output · strong general reasoning',
		},
		{
			id: 'glm-5-turbo',
			label: 'GLM-5-Turbo',
			note: '200K context · 131K output · faster, lower cost',
		},
		{
			id: 'glm-4.7',
			label: 'GLM-4.7',
			note: '200K context · 131K output · previous-gen flagship',
		},
		{
			id: 'glm-4.5-air',
			label: 'GLM-4.5-Air',
			note: '128K context · 65K output · lightweight / mobile-tier',
		},
	],
}

// Registry of known proxies keyed by their host/path fingerprints.
const KNOWN_PROXIES: Array<{
	match: (baseUrl: string | undefined) => boolean
	catalog: ProxyModelCatalog
}> = [
	{
		match: (baseUrl) => hostMatches(baseUrl, ['bigmodel', 'zhipu']),
		catalog: BIGMODEL_CATALOG,
	},
]

/**
 * Resolve the model catalog for the active ANTHROPIC_BASE_URL.
 * Returns null when the URL is unset, is the real Anthropic endpoint, or is
 * an unknown proxy (in which case we don't presume a model list).
 */
export function getCustomProxyModelCatalog(
	baseUrl: string | undefined = process.env.ANTHROPIC_BASE_URL,
): ProxyModelCatalog | null {
	if (!baseUrl) return null
	// First-party Anthropic: no catalog needed.
	try {
		if (new URL(baseUrl).hostname.toLowerCase() === 'api.anthropic.com') {
			return null
		}
	} catch {
		return null
	}
	return KNOWN_PROXIES.find((p) => p.match(baseUrl))?.catalog ?? null
}

/**
 * Default model for the active proxy, or null if unknown.
 * ANTHROPIC_MODEL (if set) should always take precedence over this.
 */
export function getCustomProxyDefaultModel(
	baseUrl: string | undefined = process.env.ANTHROPIC_BASE_URL,
): string | null {
	return getCustomProxyModelCatalog(baseUrl)?.defaultModel ?? null
}

/**
 * Is this a known proxy with a model catalog? Used to decide whether to show
 * the model picker / banner and whether to override the Claude default model.
 */
export function isKnownCustomAnthropicProxy(
	baseUrl: string | undefined = process.env.ANTHROPIC_BASE_URL,
): boolean {
	return getCustomProxyModelCatalog(baseUrl) !== null
}
