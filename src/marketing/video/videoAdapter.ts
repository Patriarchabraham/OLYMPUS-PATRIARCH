/**
 * Olympuz Marketing — Video generation adapter (provider-agnostic, no-op-when-unconfigured).
 *
 * Selects a video-generation provider from environment credentials (Veo 3 / Sora 2 /
 * Runway Gen-5 / Kling 3 — the 2026 SOTA set) and issues a real HTTP request when both
 * an API key AND an endpoint URL are configured. When no provider is configured, every
 * operation returns a clear "not configured" result rather than throwing — so the
 * Marketing department is structurally complete and the deterministic core stays
 * testable without keys or network. Mirrors the browserAdapter availability pattern.
 *
 * NOT executed in tests: the suite never sets a provider key, so only the
 * no-op-when-unconfigured path is exercised. Live generation needs creds + network.
 */

export interface VideoGenerateInput {
	prompt: string
	/** Optional base64'd start-frame / reference image (provider-dependent). */
	image?: string
	/** Desired duration in seconds (clamped to the provider's supported range). */
	duration?: number
	/** Force a specific provider; otherwise the first configured one is selected. */
	provider?: VideoProvider
}

export interface VideoResult {
	ok: boolean
	/** Provider-local job id, downloadable URL, or status text on success. */
	output?: string
	error?: string
	provider?: VideoProvider
}

export type VideoProvider = 'veo' | 'sora' | 'runway' | 'kling'

interface ProviderSpec {
	provider: VideoProvider
	keyEnv: string
	urlEnv: string
	label: string
}

const PROVIDERS: ProviderSpec[] = [
	{ provider: 'veo', keyEnv: 'VEO_API_KEY', urlEnv: 'VEO_API_URL', label: 'Veo 3' },
	{ provider: 'sora', keyEnv: 'SORA_API_KEY', urlEnv: 'SORA_API_URL', label: 'Sora 2' },
	{ provider: 'runway', keyEnv: 'RUNWAY_API_KEY', urlEnv: 'RUNWAY_API_URL', label: 'Runway Gen-5' },
	{ provider: 'kling', keyEnv: 'KLING_API_KEY', urlEnv: 'KLING_API_URL', label: 'Kling 3' },
]

const SPEC_BY_PROVIDER: Record<VideoProvider, ProviderSpec> = Object.fromEntries(
	PROVIDERS.map((p) => [p.provider, p]),
) as Record<VideoProvider, ProviderSpec>

/** The first provider with an API key set, or an explicit override, or null. */
export function selectVideoProvider(preferred?: VideoProvider): ProviderSpec | null {
	if (preferred) {
		const spec = SPEC_BY_PROVIDER[preferred]
		if (spec && process.env[spec.keyEnv]) return spec
	}
	return PROVIDERS.find((p) => process.env[p.keyEnv]) ?? null
}

/** True when at least one provider has its API key configured. */
export function isVideoAvailable(preferred?: VideoProvider): boolean {
	return selectVideoProvider(preferred) !== null
}

function notConfigured(label?: string): VideoResult {
	const list = PROVIDERS.map((p) => p.keyEnv).join(' / ')
	return {
		ok: false,
		error: `No video provider configured. Set one of ${list} (and its *_API_URL) to enable${label ? ` (${label})` : ''}.`,
	}
}

/**
 * Generate a video. Real HTTP POST when configured; otherwise a structured
 * not-configured result. Never throws — network/parse failures are returned.
 */
export async function generateVideo(input: VideoGenerateInput): Promise<VideoResult> {
	const spec = selectVideoProvider(input.provider)
	if (!spec) return notConfigured()
	const endpoint = process.env[spec.urlEnv]
	if (!endpoint) {
		return {
			ok: false,
			provider: spec.provider,
			error: `${spec.label}: set ${spec.urlEnv} to the generation endpoint to enable video generation.`,
		}
	}
	const apiKey = process.env[spec.keyEnv]!
	try {
		const res = await fetch(endpoint, {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				authorization: `Bearer ${apiKey}`,
			},
			body: JSON.stringify({
				prompt: input.prompt,
				image: input.image,
				duration: input.duration ?? 8,
			}),
		})
		const text = await res.text()
		if (!res.ok) {
			return {
				ok: false,
				provider: spec.provider,
				error: `${spec.label} HTTP ${res.status}: ${text.slice(0, 200)}`,
			}
		}
		// Providers return varied shapes; surface the raw body so the caller can extract a URL/id.
		return { ok: true, provider: spec.provider, output: text.slice(0, 500) }
	} catch (e) {
		return {
			ok: false,
			provider: spec.provider,
			error: `${spec.label} request failed: ${e instanceof Error ? e.message : String(e)}`,
		}
	}
}
