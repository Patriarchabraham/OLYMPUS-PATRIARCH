/**
 * Local 3GB Model Integration.
 *
 * Manages a small local model (typically Gemma 3 4B ~2.5GB Q4_K_M, or
 * Qwen2.5-Coder 3B ~2GB) running on the user's machine via Ollama. This is
 * the "pseudo-LLM" base for the Inference Booster Layer:
 *
 *   - Prompt compression (LLMLingua-style) — cuts input tokens ~50%
 *   - Speculative drafting — small model drafts, cloud model verifies
 *   - Verifier model — checks cloud model output before delivery
 *   - Fast-path generation for trivial tasks (typos, scaffolds)
 *
 * The model name and endpoint are configurable via env vars or settings:
 *
 *   - `OLYMPUZ_LOCAL_MODEL` (default: "gemma3:4b") — Ollama model tag
 *   - `OLYMPUZ_LOCAL_ENDPOINT` (default: "http://localhost:11434") — Ollama URL
 *   - `OLYMPUZ_LOCAL_AUTO_PULL` (default: "true") — auto-pull missing model
 *
 * All calls go through Ollama's OpenAI-compatible `/v1/chat/completions`
 * endpoint, so the same code works for vLLM, LM Studio, or any other
 * OpenAI-compatible local server — just change the endpoint.
 */

import { spawn } from 'node:child_process'

/** Default 3GB model — Gemma 3 4B in Q4_K_M quantization is ~2.5GB. */
export const DEFAULT_LOCAL_MODEL = 'gemma3:4b'

/** Default Ollama endpoint. Override with OLYMPUZ_LOCAL_ENDPOINT. */
export const DEFAULT_LOCAL_ENDPOINT = 'http://localhost:11434'

/** Cached readiness probe — avoid hitting /api/tags on every call. */
let readinessCache: { ok: boolean; at: number; model?: string } | null = null
const READINESS_TTL_MS = 30_000

/** Resolve the configured local model name. */
export function getLocalModelName(): string {
	return process.env.OLYMPUZ_LOCAL_MODEL ?? DEFAULT_LOCAL_MODEL
}

/** Resolve the configured local endpoint URL. */
export function getLocalEndpoint(): string {
	return process.env.OLYMPUZ_LOCAL_ENDPOINT ?? DEFAULT_LOCAL_ENDPOINT
}

/**
 * Check whether the local model server is reachable and the configured model
 * is available. Cached for 30s to avoid per-call network round-trips.
 *
 * @returns True iff a chat-completion call against the local model is likely to succeed.
 */
export async function isLocalReady(): Promise<boolean> {
	const now = Date.now()
	if (readinessCache && now - readinessCache.at < READINESS_TTL_MS) {
		return readinessCache.ok
	}

	const endpoint = getLocalEndpoint()
	const model = getLocalModelName()
	const ok = await probeReadiness(endpoint, model)
	readinessCache = { ok, at: now, model: ok ? model : undefined }
	return ok
}

/**
 * Force a fresh readiness check on next call. Useful after pulling a model.
 */
export function invalidateReadinessCache(): void {
	readinessCache = null
}

/**
 * Probe Ollama's `/api/tags` to confirm the server is up and the model is
 * installed. If the model is missing and `OLYMPUZ_LOCAL_AUTO_PULL` is enabled,
 * kick off a background pull.
 */
async function probeReadiness(endpoint: string, model: string): Promise<boolean> {
	try {
		const res = await fetch(`${endpoint}/api/tags`)
		if (!res.ok) return false
		const data = (await res.json()) as { models?: Array<{ name: string }> }
		const installed = data.models?.map((m) => m.name) ?? []
		const hasModel = installed.some((name) => name === model || name.startsWith(`${model}:`))

		if (!hasModel && shouldAutoPull()) {
			// Fire-and-forget pull — caller proceeds with whatever's available.
			void pullModelInBackground(model).catch(() => {})
		}
		return hasModel
	} catch {
		return false
	}
}

/** Read OLYMPUZ_LOCAL_AUTO_PULL (default true). */
function shouldAutoPull(): boolean {
	const v = process.env.OLYMPUZ_LOCAL_AUTO_PULL
	return v === undefined ? true : v !== 'false' && v !== '0'
}

/**
 * Spawn `ollama pull <model>` in the background. Resolves when the pull
 * completes (or rejects on failure). The readiness cache is invalidated on
 * success so the next call sees the freshly-pulled model.
 */
export async function pullModelInBackground(model: string): Promise<void> {
	return new Promise((resolve, reject) => {
		const child = spawn('ollama', ['pull', model], {
			stdio: ['ignore', 'ignore', 'inherit'],
			shell: process.platform === 'win32',
		})
		child.on('error', (err) => reject(err))
		child.on('close', (code) => {
			if (code === 0) {
				invalidateReadinessCache()
				resolve()
			} else {
				reject(new Error(`ollama pull exited with code ${code}`))
			}
		})
	})
}

/**
 * Generate a completion from the local model. Uses Ollama's OpenAI-compatible
 * `/v1/chat/completions` endpoint so the same call shape works against any
 * OpenAI-compatible local server.
 *
 * @param prompt - User prompt (system prompt can be embedded).
 * @param options - Optional max_tokens, temperature, system prompt.
 * @returns The assistant's response content.
 */
export async function draftResponse(
	prompt: string,
	options: {
		systemPrompt?: string
		maxTokens?: number
		temperature?: number
	} = {},
): Promise<string> {
	const endpoint = getLocalEndpoint()
	const model = getLocalModelName()

	const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = []
	if (options.systemPrompt) {
		messages.push({ role: 'system', content: options.systemPrompt })
	}
	messages.push({ role: 'user', content: prompt })

	const body = {
		model,
		messages,
		stream: false,
		...(options.maxTokens !== undefined && { max_tokens: options.maxTokens }),
		...(options.temperature !== undefined && { temperature: options.temperature }),
	}

	const res = await fetch(`${endpoint}/v1/chat/completions`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body),
	})
	if (!res.ok) {
		throw new Error(`local model call failed: ${res.status} ${await res.text()}`)
	}
	const data = (await res.json()) as {
		choices?: Array<{ message?: { content?: string } }>
	}
	return data.choices?.[0]?.message?.content ?? ''
}

/**
 * Compress a prompt using LLMLingua-style instruction. The local model is
 * instructed to produce a token-compact version that preserves meaning.
 *
 * Real LLMLingua uses a small dedicated model + entropy-based token scoring.
 * This implementation uses the local chat model with a focused instruction —
 * slightly lower quality but no extra dependencies.
 *
 * @param prompt - The prompt to compress.
 * @returns Compressed prompt, or original on any failure.
 */
export async function compressPrompt(prompt: string): Promise<string> {
	if (prompt.length < 500) return prompt // not worth compressing

	const instruction = `Compress the following prompt while preserving all key information, instructions, and code references. Remove redundant phrases and unnecessary filler. Keep all literal code/paths/identifiers intact. Output only the compressed prompt:\n\n---\n${prompt}\n---`

	try {
		const compressed = await draftResponse(instruction, {
			systemPrompt:
				'You are a prompt-compression assistant. Output the compressed prompt only — no preamble, no explanation.',
			maxTokens: Math.floor(prompt.length / 2), // target ~50% reduction
			temperature: 0.1, // deterministic
		})
		// Sanity-check: never return empty or longer output.
		if (compressed.trim().length > 20 && compressed.length < prompt.length) {
			return compressed.trim()
		}
	} catch {
		// Fall through — return original.
	}
	return prompt
}

/**
 * Verify cloud model output using the local model as reviewer. Returns a
 * confidence score in [0, 1] and any concerns.
 *
 * @param originalQuery - The user's original query.
 * @param cloudOutput - The cloud model's response.
 * @returns Confidence and list of concerns (empty if confident).
 */
export async function verifyOutput(
	originalQuery: string,
	cloudOutput: string,
): Promise<{ confidence: number; concerns: string[] }> {
	const instruction = `You are reviewing another AI's response. The original query was:

${originalQuery}

The response to review is:

${cloudOutput}

Rate your confidence that the response correctly and completely answers the query on a scale of 0.0 to 1.0. List any concerns (one per line, prefixed with "- "). If you have no concerns, write "no concerns".

Format your response as:
CONFIDENCE: <number>
CONCERNS:
- <concern 1>
- <concern 2>`

	try {
		const review = await draftResponse(instruction, {
			systemPrompt: 'You are a precise code reviewer. Be concise.',
			maxTokens: 200,
			temperature: 0.2,
		})

		const confidenceMatch = review.match(/CONFIDENCE:\s*([\d.]+)/i)
		const confidence = confidenceMatch ? Number.parseFloat(confidenceMatch[1]!) : 0.5

		const concernsMatch = review.match(/CONCERNS:\s*([\s\S]*?)(?:$|\n\n)/i)
		const concernsBlock = concernsMatch?.[1] ?? ''
		const concerns = concernsBlock
			.split('\n')
			.map((l) => l.trim())
			.filter((l) => l.startsWith('-'))
			.map((l) => l.slice(1).trim())
			.filter((l) => l.length > 0 && l.toLowerCase() !== 'no concerns')

		return {
			confidence: Math.max(0, Math.min(1, confidence)),
			concerns,
		}
	} catch {
		// Reviewer unavailable — return neutral confidence.
		return { confidence: 0.5, concerns: [] }
	}
}
