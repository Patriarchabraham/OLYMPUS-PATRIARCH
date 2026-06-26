/**
 * Zero-config provider autodetection.
 *
 * Scans the environment (API keys, OAuth tokens, stored credentials) and local
 * network (Ollama, LM Studio, vLLM, llama.cpp, etc.) to pick the best provider
 * for first-run users who have not explicitly configured one. Returns a
 * structured detection result that callers can consume to build a launch-ready
 * profile env, or null when nothing is detected — in which case the existing
 * onboarding / picker flow should take over.
 *
 * Detection priority (first match wins):
 *   1. ANTHROPIC_API_KEY → first-party Claude (most capable default)
 *   2. Codex: CODEX_API_KEY, CHATGPT_ACCOUNT_ID, or valid ~/.codex/auth.json
 *   3. GitHub Copilot: GITHUB_TOKEN or GH_TOKEN
 *   4. OPENAI_API_KEY / OPENAI_API_KEYS
 *   5. GEMINI_API_KEY or GOOGLE_API_KEY
 *   6. MISTRAL_API_KEY
 *   7. MINIMAX_API_KEY
 *   8. XAI_API_KEY
 *   9. Universal scan: any env var matching known LLM provider patterns
 *      (DeepSeek, Together, Fireworks, Groq, Cohere, Perplexity, HF, etc.)
 *  10. Google AI Studio / gcloud ADC credentials
 *  11. Local Ollama reachable (default localhost:11434)
 *  12. Local LM Studio reachable (default localhost:1234)
 *  13. Other local services (vLLM, llama.cpp, text-generation-webui, etc.)
 *
 * Local-service probes are parallelized and cheap (short timeout, no
 * request body). Env scans are synchronous and run first so we don't make
 * network calls when a credential is already present.
 *
 * This module intentionally does NOT decide whether to apply the detection;
 * callers should gate on hasExplicitProviderSelection() (providerProfile.ts)
 * and the presence of a persisted profile file.
 */

import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

export type DetectedProviderKind =
	| 'anthropic'
	| 'codex'
	| 'github'
	| 'openai'
	| 'gemini'
	| 'mistral'
	| 'minimax'
	| 'xai'
	| 'ollama'
	| 'lm-studio'
	| 'deepseek'
	| 'together'
	| 'fireworks'
	| 'groq'
	| 'cohere'
	| 'perplexity'
	| 'huggingface'
	| 'replicate'
	| 'openrouter'
	| 'google-ai-studio'
	| 'generic-openai-compatible'

export type DetectedProvider = {
	kind: DetectedProviderKind
	/** One-line human-readable reason, e.g. "ANTHROPIC_API_KEY set". */
	source: string
	/** Present when the detection already resolved a usable base URL. */
	baseUrl?: string
	/** Present when detection also narrowed down a specific model. */
	model?: string
}

type EnvLike = NodeJS.ProcessEnv | Record<string, string | undefined>

function envHasNonEmpty(env: EnvLike, key: string): boolean {
	const value = env[key]
	return typeof value === 'string' && value.trim().length > 0
}

function firstSet(env: EnvLike, keys: readonly string[]): string | undefined {
	for (const key of keys) {
		if (envHasNonEmpty(env, key)) return key
	}
	return undefined
}

/**
 * Universal LLM API-key scanner.
 *
 * Known LLM providers and their env-var patterns. Each entry maps a
 * substring that may appear in an environment variable name to a
 * DetectedProviderKind and a human-readable label.
 */
const LLM_ENV_PATTERNS: ReadonlyArray<{
	/** Substring to look for in env var names (case-insensitive). */
	namePattern: string
	/** Provider kind to report. */
	kind: DetectedProviderKind
	/** Human label for the source string. */
	label: string
	/** Optional base URL that this provider typically uses (OpenAI-compatible). */
	defaultBaseUrl?: string
}> = [
	{
		namePattern: 'DEEPSEEK',
		kind: 'deepseek',
		label: 'DeepSeek',
		defaultBaseUrl: 'https://api.deepseek.com/v1',
	},
	{
		namePattern: 'TOGETHER',
		kind: 'together',
		label: 'Together AI',
		defaultBaseUrl: 'https://api.together.xyz/v1',
	},
	{
		namePattern: 'FIREWORKS',
		kind: 'fireworks',
		label: 'Fireworks AI',
		defaultBaseUrl: 'https://api.fireworks.ai/inference/v1',
	},
	{
		namePattern: 'GROQ',
		kind: 'groq',
		label: 'Groq',
		defaultBaseUrl: 'https://api.groq.com/openai/v1',
	},
	{ namePattern: 'COHERE', kind: 'cohere', label: 'Cohere' },
	{
		namePattern: 'PERPLEXITY',
		kind: 'perplexity',
		label: 'Perplexity AI',
		defaultBaseUrl: 'https://api.perplexity.ai',
	},
	{ namePattern: 'HUGGING', kind: 'huggingface', label: 'Hugging Face' },
	{ namePattern: 'HF_', kind: 'huggingface', label: 'Hugging Face' },
	{ namePattern: 'REPLICATE', kind: 'replicate', label: 'Replicate' },
	{
		namePattern: 'OPENROUTER',
		kind: 'openrouter',
		label: 'OpenRouter',
		defaultBaseUrl: 'https://openrouter.ai/api/v1',
	},
	{ namePattern: 'SAMBANOVA', kind: 'generic-openai-compatible', label: 'SambaNova' },
	{ namePattern: 'CEREBRAS', kind: 'generic-openai-compatible', label: 'Cerebras' },
	{ namePattern: 'SILICONFLOW', kind: 'generic-openai-compatible', label: 'SiliconFlow' },
	{ namePattern: 'ZHIPU', kind: 'generic-openai-compatible', label: 'Zhipu AI' },
	{ namePattern: 'MOONSHOT', kind: 'generic-openai-compatible', label: 'Moonshot AI' },
	{ namePattern: 'BAICHUAN', kind: 'generic-openai-compatible', label: 'Baichuan' },
	{ namePattern: 'QWEN', kind: 'generic-openai-compatible', label: 'Alibaba Qwen' },
	{ namePattern: 'DASHSCOPE', kind: 'generic-openai-compatible', label: 'Alibaba DashScope' },
	{ namePattern: 'VOLCENGINE', kind: 'generic-openai-compatible', label: 'Volcengine' },
	{ namePattern: 'NVRM', kind: 'generic-openai-compatible', label: 'NVIDIA NIM' },
	{ namePattern: 'AZURE_OPENAI', kind: 'openai', label: 'Azure OpenAI' },
]

/**
 * Known API-key env-var suffixes that typically hold bearer credentials.
 */
const API_KEY_SUFFIXES = ['_API_KEY', '_TOKEN', '_SECRET', '_KEY', '_ACCESS_TOKEN']

/**
 * Scan ALL environment variables for any key that matches a known LLM provider
 * pattern. Returns the first match found, or null. This catches providers that
 * the user may have configured ad-hoc without the app knowing about them.
 */
function scanForAnyLlmProvider(env: EnvLike): DetectedProvider | null {
	const envKeys = Object.keys(env)

	for (const pattern of LLM_ENV_PATTERNS) {
		for (const key of envKeys) {
			const upperKey = key.toUpperCase()
			if (!upperKey.includes(pattern.namePattern)) continue

			// Check if this key actually holds a non-empty value that looks like a credential
			const value = env[key]
			if (!value || typeof value !== 'string' || value.trim().length < 8) continue

			// Must have a key-like suffix to be a real credential (avoid false positives)
			const hasKeySuffix = API_KEY_SUFFIXES.some((suffix) => upperKey.endsWith(suffix))
			if (!hasKeySuffix) continue

			// Skip keys already handled by the explicit priority scan above
			const alreadyHandled = [
				'ANTHROPIC_API_KEY',
				'ANTHROPIC_AUTH_TOKEN',
				'ANTHROPIC_BASE_URL',
				'CODEX_API_KEY',
				'CHATGPT_ACCOUNT_ID',
				'CODEX_ACCOUNT_ID',
				'GITHUB_TOKEN',
				'GH_TOKEN',
				'OPENAI_API_KEYS',
				'OPENAI_API_KEY',
				'GEMINI_API_KEY',
				'GOOGLE_API_KEY',
				'MISTRAL_API_KEY',
				'MINIMAX_API_KEY',
				'XAI_API_KEY',
			]
			if (alreadyHandled.includes(key)) continue

			return {
				kind: pattern.kind,
				source: `${key} set (${pattern.label})`,
				baseUrl: pattern.defaultBaseUrl,
			}
		}
	}

	return null
}

/**
 * Detect Google AI Studio credentials via gcloud ADC (Application Default
 * Credentials). Checks for:
 *  1. Application-default credentials file (~/.config/gcloud/application_default_credentials.json)
 *  2. GOOGLE_APPLICATION_CREDENTIALS env var pointing to a JSON key file
 *
 * This covers the "anti-gravity" / Google AI Studio local access path.
 */
function detectGoogleAiStudioCredentials(env: EnvLike): DetectedProvider | null {
	// Already caught by explicit Gemini scan — skip
	if (envHasNonEmpty(env, 'GEMINI_API_KEY') || envHasNonEmpty(env, 'GOOGLE_API_KEY')) {
		return null
	}

	// Check for ADC credentials file
	const adcPath = env.GOOGLE_APPLICATION_CREDENTIALS
		? String(env.GOOGLE_APPLICATION_CREDENTIALS).trim()
		: join(homedir(), '.config', 'gcloud', 'application_default_credentials.json')

	if (existsSync(adcPath)) {
		try {
			const content = readFileSync(adcPath, 'utf8')
			const parsed = JSON.parse(content)
			// ADC files have a "type" field — "authorized_user" or "service_account"
			if (
				parsed &&
				(parsed.type === 'authorized_user' ||
					parsed.type === 'service_account' ||
					parsed.client_id ||
					parsed.quota_project_id)
			) {
				return {
					kind: 'google-ai-studio',
					source: `Google ADC credentials found (${parsed.type ?? 'unknown type'})`,
				}
			}
		} catch {
			// Invalid JSON or unreadable — skip
		}
	}

	return null
}

function defaultHasCodexAuthFile(): boolean {
	const paths = [process.env.CODEX_AUTH_PATH, join(homedir(), '.codex', 'auth.json')]
	return paths.some((p) => p && existsSync(p))
}

export type DetectProviderFromEnvOptions = {
	env?: EnvLike
	/**
	 * Override Codex auth-file detection. Primarily for tests — the default
	 * implementation checks ~/.codex/auth.json and CODEX_AUTH_PATH on disk.
	 */
	hasCodexAuth?: () => boolean
}

/**
 * Synchronous env-only scan. Returns the highest-priority env-provided
 * provider, or null if nothing is present. Intentionally does not touch
 * the network — fast path for the common case where a user has exported
 * one of the standard API-key env vars.
 */
function isOptionsObject(
	value: EnvLike | DetectProviderFromEnvOptions | undefined,
): value is DetectProviderFromEnvOptions {
	if (!value || typeof value !== 'object') return false
	if ('hasCodexAuth' in value && typeof value.hasCodexAuth === 'function') {
		return true
	}
	if ('env' in value && typeof (value as { env?: unknown }).env === 'object') {
		return true
	}
	return false
}

export function detectProviderFromEnv(
	envOrOptions: EnvLike | DetectProviderFromEnvOptions = process.env,
): DetectedProvider | null {
	const options: DetectProviderFromEnvOptions = isOptionsObject(envOrOptions)
		? envOrOptions
		: { env: envOrOptions as EnvLike }
	const env = options.env ?? process.env
	const hasCodexAuth = options.hasCodexAuth ?? defaultHasCodexAuthFile
	if (
		envHasNonEmpty(env, 'ANTHROPIC_API_KEY') ||
		envHasNonEmpty(env, 'ANTHROPIC_AUTH_TOKEN') ||
		envHasNonEmpty(env, 'ANTHROPIC_BASE_URL')
	) {
		const sourceEnv = firstSet(env, [
			'ANTHROPIC_API_KEY',
			'ANTHROPIC_AUTH_TOKEN',
			'ANTHROPIC_BASE_URL',
		])
		return { kind: 'anthropic', source: `${sourceEnv} set` }
	}

	if (
		envHasNonEmpty(env, 'CODEX_API_KEY') ||
		envHasNonEmpty(env, 'CHATGPT_ACCOUNT_ID') ||
		envHasNonEmpty(env, 'CODEX_ACCOUNT_ID') ||
		hasCodexAuth()
	) {
		const sourceEnv = firstSet(env, ['CODEX_API_KEY', 'CHATGPT_ACCOUNT_ID', 'CODEX_ACCOUNT_ID'])
		return {
			kind: 'codex',
			source: sourceEnv ? `${sourceEnv} set` : '~/.codex/auth.json present',
		}
	}

	const githubKey = firstSet(env, ['GITHUB_TOKEN', 'GH_TOKEN'])
	if (githubKey) {
		return {
			kind: 'github',
			source: `${githubKey} set (GitHub Copilot)`,
		}
	}

	const openaiKey = firstSet(env, ['OPENAI_API_KEYS', 'OPENAI_API_KEY'])
	if (openaiKey) {
		return {
			kind: 'openai',
			source: `${openaiKey} set`,
			baseUrl: env.OPENAI_BASE_URL ?? env.OPENAI_API_BASE,
		}
	}

	const geminiKey = firstSet(env, ['GEMINI_API_KEY', 'GOOGLE_API_KEY'])
	if (geminiKey) {
		return { kind: 'gemini', source: `${geminiKey} set` }
	}

	if (envHasNonEmpty(env, 'MISTRAL_API_KEY')) {
		return { kind: 'mistral', source: 'MISTRAL_API_KEY set' }
	}

	if (envHasNonEmpty(env, 'MINIMAX_API_KEY')) {
		return { kind: 'minimax', source: 'MINIMAX_API_KEY set' }
	}

	if (envHasNonEmpty(env, 'XAI_API_KEY')) {
		return { kind: 'xai', source: 'XAI_API_KEY set' }
	}

	return null
}

type LocalProbe = {
	kind: DetectedProviderKind
	url: string
	timeoutMs: number
	source: string
	baseUrl: string
}

const DEFAULT_LOCAL_PROBE_TIMEOUT_MS = 1200

async function probeReachable(
	url: string,
	timeoutMs: number,
	fetchImpl: typeof fetch,
): Promise<boolean> {
	const controller = new AbortController()
	const timer = setTimeout(() => controller.abort(), timeoutMs)
	try {
		const response = await fetchImpl(url, {
			method: 'GET',
			signal: controller.signal,
		})
		return response.ok
	} catch {
		return false
	} finally {
		clearTimeout(timer)
	}
}

/**
 * Returns the highest-priority local service reachable from the host.
 * Runs probes in parallel and picks by priority rather than first-response,
 * so slow-but-preferred services still win over fast-but-lower-priority ones.
 */
export async function detectLocalService(options?: {
	env?: EnvLike
	fetchImpl?: typeof fetch
	timeoutMs?: number
}): Promise<DetectedProvider | null> {
	const env = options?.env ?? process.env
	const fetchImpl = options?.fetchImpl ?? globalThis.fetch
	const timeoutMs = options?.timeoutMs ?? DEFAULT_LOCAL_PROBE_TIMEOUT_MS

	const ollamaBase = (env.OLLAMA_BASE_URL ?? 'http://localhost:11434').replace(/\/+$/, '')
	const lmStudioBase = (env.LM_STUDIO_BASE_URL ?? 'http://localhost:1234').replace(/\/+$/, '')
	const llamacppBase = (env.LLAMACPP_BASE_URL ?? 'http://localhost:8080').replace(/\/+$/, '')
	const tgwuiBase = (env.TGWUI_BASE_URL ?? 'http://localhost:5000').replace(/\/+$/, '')
	const koboldBase = (env.KOBOLD_BASE_URL ?? 'http://localhost:5001').replace(/\/+$/, '')
	const vllmBase = (env.VLLM_BASE_URL ?? 'http://localhost:8000').replace(/\/+$/, '')
	const localAiBase = (env.LOCALAI_BASE_URL ?? 'http://localhost:8080').replace(/\/+$/, '')

	const probes: LocalProbe[] = [
		{
			kind: 'ollama',
			url: `${ollamaBase}/api/tags`,
			timeoutMs,
			source: `Ollama reachable at ${ollamaBase}`,
			baseUrl: ollamaBase,
		},
		{
			kind: 'lm-studio',
			url: `${lmStudioBase}/v1/models`,
			timeoutMs,
			source: `LM Studio reachable at ${lmStudioBase}`,
			baseUrl: lmStudioBase,
		},
		{
			kind: 'generic-openai-compatible',
			url: `${vllmBase}/v1/models`,
			timeoutMs,
			source: `vLLM reachable at ${vllmBase}`,
			baseUrl: vllmBase,
		},
		{
			kind: 'generic-openai-compatible',
			url: `${llamacppBase}/v1/models`,
			timeoutMs,
			source: `llama.cpp reachable at ${llamacppBase}`,
			baseUrl: llamacppBase,
		},
		{
			kind: 'generic-openai-compatible',
			url: `${tgwuiBase}/v1/models`,
			timeoutMs,
			source: `text-generation-webui reachable at ${tgwuiBase}`,
			baseUrl: tgwuiBase,
		},
		{
			kind: 'generic-openai-compatible',
			url: `${koboldBase}/v1/models`,
			timeoutMs,
			source: `KoboldCpp reachable at ${koboldBase}`,
			baseUrl: koboldBase,
		},
		{
			kind: 'generic-openai-compatible',
			url: `${localAiBase}/v1/models`,
			timeoutMs,
			source: `LocalAI reachable at ${localAiBase}`,
			baseUrl: localAiBase,
		},
	]

	const results = await Promise.all(
		probes.map(async (probe) => ({
			probe,
			reachable: await probeReachable(probe.url, probe.timeoutMs, fetchImpl),
		})),
	)

	for (const { probe, reachable } of results) {
		if (reachable) {
			return {
				kind: probe.kind,
				source: probe.source,
				baseUrl: probe.baseUrl,
			}
		}
	}

	return null
}

/**
 * Orchestrator: env scan first (sync, free), then local-service probes
 * (async, ~1-2s worst case) only if nothing was found in env.
 */
export async function detectBestProvider(options?: {
	env?: EnvLike
	fetchImpl?: typeof fetch
	timeoutMs?: number
	/** Skip local-service probes — useful for tests or offline smoke checks. */
	skipLocal?: boolean
	/** Override for Codex auth-file detection. See detectProviderFromEnv. */
	hasCodexAuth?: () => boolean
}): Promise<DetectedProvider | null> {
	const env = options?.env ?? process.env

	// 1. Explicit high-priority env vars (Anthropic, Codex, GitHub, OpenAI, etc.)
	const fromEnv = detectProviderFromEnv({
		env,
		hasCodexAuth: options?.hasCodexAuth,
	})
	if (fromEnv) return fromEnv

	// 2. Universal scan: any env var matching known LLM provider patterns
	const universalMatch = scanForAnyLlmProvider(env)
	if (universalMatch) return universalMatch

	// 3. Google AI Studio / ADC credentials (local gcloud auth)
	const googleAiStudio = detectGoogleAiStudioCredentials(env)
	if (googleAiStudio) return googleAiStudio

	if (options?.skipLocal) return null

	// 4. Local service probes (Ollama, LM Studio, vLLM, llama.cpp, etc.)
	return detectLocalService({
		env,
		fetchImpl: options?.fetchImpl,
		timeoutMs: options?.timeoutMs,
	})
}
