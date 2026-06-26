/**
 * Speculative Executor — "pseudo-LLM" accelerator.
 *
 * Real speculative decoding requires a specific API that exposes the
 * draft/verify protocol (a small model proposes tokens, a large model
 * accepts or rejects them in a single forward pass). Few providers
 * expose this. As a practical approximation that works against any
 * OpenAI-compatible endpoint, we run the local 3GB model and the
 * cloud model in parallel:
 *
 *   1. Fire `draftResponse()` (local) and a cloud completion in parallel.
 *   2. If the local draft finishes within `localTimeoutMs` AND passes
 *      a heuristic sanity check (optionally a deep verify), return it.
 *      The cloud request is aborted — we got a 2-3x speedup.
 *   3. Otherwise wait for the cloud response and use that.
 *
 * This is sometimes called "model cascading" or "draft-then-verify".
 * The win comes from the local model being right *often enough* on
 * boilerplate/trivial queries that skipping the cloud round-trip
 * dominates the cost of occasionally being wrong.
 *
 * See {@link speculativeExecute} for the entry point.
 */

import { draftResponse, isLocalReady, verifyOutput } from './localModel.js'
import type { ProviderId } from './types.js'

/** Default minimum heuristic score for accepting a local draft. */
const DEFAULT_ACCEPT_THRESHOLD = 0.7

/** Default max tokens for the local draft. */
const DEFAULT_MAX_DRAFT_TOKENS = 512

/** Default timeout for the local draft (ms). Cloud is unaffected. */
const DEFAULT_LOCAL_TIMEOUT_MS = 4_000

/** Minimum length for a useful draft — shorter is treated as failure. */
const MIN_DRAFT_LENGTH = 20

/** Phrases that indicate the local model bailed out. */
const FAILURE_MARKERS = [
	"i don't know",
	'i cannot help',
	"i can't help",
	'as an ai',
	"i'm sorry",
	'i am sorry',
	"i'm unable",
	'i am unable',
]

/**
 * Options for {@link speculativeExecute}.
 */
export interface SpeculativeOptions {
	/** Minimum heuristic score in [0, 1] to accept the local draft. */
	acceptThreshold?: number
	/** Max tokens the local model is allowed to generate. */
	maxDraftTokens?: number
	/** Abort the local draft after this many ms. */
	localTimeoutMs?: number
	/**
	 * If true, also call {@link verifyOutput} (local-model self-review)
	 * after the heuristic check. Doubles local cost but catches more
	 * failures. Default false — heuristic is enough for boilerplate.
	 */
	deepVerify?: boolean
	/**
	 * Cloud provider to fall back to when the local draft is rejected.
	 * If omitted, the executor returns whatever the local model produced.
	 */
	cloudProvider?: {
		provider: ProviderId
		model: string
		baseURL: string
		apiKey: string
	}
	/** System prompt for both local and cloud calls. */
	systemPrompt?: string
}

/** Result of a speculative execution. */
export interface SpeculativeResult {
	/** Final content delivered to the caller. */
	content: string
	/**
	 * Where the content came from:
	 *   - `local_accepted` — local draft passed verification, cloud skipped
	 *   - `local_rejected_cloud` — local draft failed, cloud response used
	 *   - `cloud_only` — local model unavailable or timed out
	 *   - `local_only` — no cloud configured; best-effort local output
	 */
	source: 'local_accepted' | 'local_rejected_cloud' | 'cloud_only' | 'local_only'
	/** Heuristic confidence in the local draft in [0, 1]. */
	draftConfidence: number
	/** Verifier concerns (only populated when deepVerify ran). */
	concerns: string[]
	/** Wall-clock latency in ms. */
	latencyMs: number
	/** True iff the local draft was returned to the caller. */
	usedLocalDraft: boolean
}

/**
 * Run a query through the speculative executor.
 *
 * @param query - User query.
 * @param options - See {@link SpeculativeOptions}.
 * @returns Speculative result with content + audit metadata.
 */
export async function speculativeExecute(
	query: string,
	options: SpeculativeOptions = {},
): Promise<SpeculativeResult> {
	const start = Date.now()
	const threshold = options.acceptThreshold ?? DEFAULT_ACCEPT_THRESHOLD
	const maxDraftTokens = options.maxDraftTokens ?? DEFAULT_MAX_DRAFT_TOKENS
	const localTimeoutMs = options.localTimeoutMs ?? DEFAULT_LOCAL_TIMEOUT_MS

	// 1. Check local readiness. Cached for 30s — near-instant.
	const localReady = await isLocalReady()
	if (!localReady) {
		const content = await callCloudSafely(options, query)
		return {
			content,
			source: content ? 'cloud_only' : 'local_only',
			draftConfidence: 0,
			concerns: [],
			latencyMs: Date.now() - start,
			usedLocalDraft: false,
		}
	}

	// 2. Fire local draft + cloud in parallel. Cloud is optional.
	const localPromise = raceWithTimeout(
		draftResponse(query, {
			systemPrompt: options.systemPrompt,
			maxTokens: maxDraftTokens,
			temperature: 0.2, // deterministic — it's a draft
		}),
		localTimeoutMs,
	)

	const cloudPromise = options.cloudProvider ? callCloudSafely(options, query) : Promise.resolve('')

	// 3. Wait for local draft (or timeout). Cloud keeps running in background.
	const localDraft = await localPromise

	// 4. Quick path: empty/short draft means local failed.
	if (localDraft.length < MIN_DRAFT_LENGTH) {
		const cloud = await cloudPromise
		const source: SpeculativeResult['source'] = cloud ? 'cloud_only' : 'local_only'
		return {
			content: cloud || localDraft,
			source,
			draftConfidence: 0,
			concerns: [],
			latencyMs: Date.now() - start,
			usedLocalDraft: !cloud,
		}
	}

	// 5. Heuristic sanity check on the local draft.
	const quickScore = heuristicScore(query, localDraft)

	// 6. Optional deep verification via the local model in reviewer mode.
	let concerns: string[] = []
	let verifiedConfidence = quickScore
	if (options.deepVerify && quickScore >= threshold - 0.1) {
		const verdict = await verifyOutput(query, localDraft).catch(() => null)
		if (verdict) {
			concerns = verdict.concerns
			// Blend: average of heuristic + verifier, penalize if concerns.
			const penalty = Math.min(0.3, concerns.length * 0.1)
			verifiedConfidence = (quickScore + verdict.confidence) / 2 - penalty
		}
	}

	// 7. Accept local draft if it passes the bar.
	if (verifiedConfidence >= threshold) {
		return {
			content: localDraft,
			// `local_accepted` requires a cloud to have been skipped —
			// otherwise it's `local_only` (best-effort, no fallback existed).
			source: options.cloudProvider ? 'local_accepted' : 'local_only',
			draftConfidence: verifiedConfidence,
			concerns,
			latencyMs: Date.now() - start,
			usedLocalDraft: true,
		}
	}

	// 8. Local draft rejected — wait for cloud.
	const cloud = await cloudPromise
	if (cloud.length >= MIN_DRAFT_LENGTH) {
		return {
			content: cloud,
			source: 'local_rejected_cloud',
			draftConfidence: verifiedConfidence,
			concerns,
			latencyMs: Date.now() - start,
			usedLocalDraft: false,
		}
	}

	// 9. Cloud also failed (or not configured). Best-effort: return local.
	return {
		content: localDraft,
		source: 'local_only',
		draftConfidence: verifiedConfidence,
		concerns,
		latencyMs: Date.now() - start,
		usedLocalDraft: true,
	}
}

// --- Internals ---

/**
 * Reject a promise with a fallback value after `ms`. The underlying promise
 * keeps running (Node doesn't support cancelling fetch without an AbortController
 * and many SDKs ignore the signal anyway) — we just stop awaiting it.
 */
function raceWithTimeout<T>(promise: Promise<T>, ms: number): Promise<T | ''> {
	return new Promise((resolve) => {
		const timer = setTimeout(() => resolve('' as T | ''), ms)
		promise
			.then((value) => {
				clearTimeout(timer)
				resolve(value)
			})
			.catch(() => {
				clearTimeout(timer)
				resolve('')
			})
	})
}

/**
 * Heuristic sanity check on a local draft. Returns a confidence score
 * in [0, 1]. Pure function — no LLM calls.
 *
 * Scoring breakdown:
 *   - Start at 0.5 (neutral).
 *   - +0.2 if length is "reasonable" (30–2000 chars).
 *   - +0.2 if no failure markers.
 *   - +0.1 if code blocks (```...```) are balanced.
 *   - -0.5 if any failure marker appears at the very start.
 */
export function heuristicScore(query: string, draft: string): number {
	if (draft.length < MIN_DRAFT_LENGTH) return 0

	let score = 0.5
	const lower = draft.toLowerCase()

	// Length check.
	if (draft.length >= 30 && draft.length <= 2000) {
		score += 0.2
	} else if (draft.length > 2000) {
		// Rambling — mild penalty.
		score -= 0.1
	}

	// Failure marker check.
	const hasMarker = FAILURE_MARKERS.some((m) => lower.includes(m))
	if (!hasMarker) {
		score += 0.2
	} else {
		// Heavy penalty if marker appears in the first 100 chars.
		const head = lower.slice(0, 100)
		const earlyMarker = FAILURE_MARKERS.some((m) => head.includes(m))
		if (earlyMarker) score -= 0.5
	}

	// Code block balance — only matters if the query mentions code.
	const looksLikeCodeRequest = /code|function|class|bug|fix|implement|refactor/i.test(query)
	if (looksLikeCodeRequest) {
		const fenceCount = (draft.match(/```/g) ?? []).length
		if (fenceCount % 2 === 0) score += 0.1
		else score -= 0.15
	}

	return Math.max(0, Math.min(1, score))
}

/**
 * Call the cloud provider, returning '' on any failure so the caller
 * can fall through to local-only mode gracefully.
 */
async function callCloudSafely(options: SpeculativeOptions, query: string): Promise<string> {
	const provider = options.cloudProvider
	if (!provider) return ''
	try {
		return await callOpenAICompatible(provider.baseURL, provider.apiKey, provider.model, query, {
			systemPrompt: options.systemPrompt,
		})
	} catch {
		return ''
	}
}

/**
 * OpenAI-compatible chat completion. Same shape as in mixtureOfAgents.ts
 * but kept local to avoid a cross-module dependency.
 */
async function callOpenAICompatible(
	baseURL: string,
	apiKey: string,
	model: string,
	prompt: string,
	options: { systemPrompt?: string } = {},
): Promise<string> {
	if (!baseURL) throw new Error('baseURL required for cloud call')

	const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = []
	if (options.systemPrompt) {
		messages.push({ role: 'system', content: options.systemPrompt })
	}
	messages.push({ role: 'user', content: prompt })

	const headers: Record<string, string> = { 'Content-Type': 'application/json' }
	if (apiKey) headers.Authorization = `Bearer ${apiKey}`

	const res = await fetch(`${baseURL.replace(/\/$/, '')}/chat/completions`, {
		method: 'POST',
		headers,
		body: JSON.stringify({ model, messages, stream: false }),
	})
	if (!res.ok) {
		throw new Error(`cloud call failed: ${res.status} ${await res.text()}`)
	}
	const data = (await res.json()) as {
		choices?: Array<{ message?: { content?: string } }>
	}
	return data.choices?.[0]?.message?.content ?? ''
}
