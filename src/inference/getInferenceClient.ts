/**
 * Unified inference client factory.
 *
 * Drop-in replacement for `getAnthropicClient()` at `src/services/api/client.ts:185`.
 * Adds two optional inputs: `queryText` (for task classification) and `taskType`
 * (skip classification). All other parameters match the legacy signature, so
 * existing callsites can swap one identifier without touching argument shape.
 *
 * Behavior:
 *   - If `routerConfig` is unset (no settings.agentRouting), classify + route
 *     is skipped and we delegate straight to `getAnthropicClient` — preserving
 *     legacy single-provider behavior bit-for-bit.
 *   - Otherwise we classify (or accept the caller's `taskType`), call the
 *     router, and return either a first-party Anthropic client or an
 *     OpenAI-shim client pointed at the routed provider.
 *
 * The returned object is typed `Anthropic` for drop-in compatibility. The
 * OpenAI shim path produces an object with the same surface (see
 * `createOpenAIShimClient` at `src/services/api/openaiShim.ts:2308`).
 */

import type { Anthropic } from '@anthropic-ai/sdk'
import type { ClientOptions } from '@anthropic-ai/sdk/client'

import { getAnthropicClient } from '../services/api/client.js'
import { createOpenAIShimClient } from '../services/api/openaiShim.js'
import { getGlobalConfig } from '../utils/config.js'
import {
	convertEffortValueToLevel,
	type EffortValue,
	standardEffortToOpenAI,
} from '../utils/effort.js'

import { recordCost } from './costLedger.js'
import { route } from './router.js'
import { classifyTask } from './taskClassifier.js'
import type { ProviderFamily, RouterConfig, RoutingDecision, TaskType } from './types.js'

/** OpenAI-compatible effort level accepted by the shim. */
type OpenAIEffortLevel = 'low' | 'medium' | 'high' | 'xhigh'

/**
 * Input shape — superset of `getAnthropicClient`'s options.
 *
 * The two new fields (`queryText`, `taskType`) are required only when the
 * router is enabled. When the router is disabled (no settings.agentRouting),
 * they're ignored.
 */
export interface GetInferenceClientOptions {
	apiKey?: string
	maxRetries: number
	model?: string
	fetchOverride?: ClientOptions['fetch']
	source?: string
	providerOverride?: { model: string; baseURL: string; apiKey: string }
	effortValue?: EffortValue
	/** Query text — used for task classification when router is enabled. */
	queryText?: string
	/** Pre-classified task type — skips the classifier. */
	taskType?: TaskType
	/** File count in flight — feeds routing rules and classifier. */
	fileCount?: number
	/** Estimated tokens already in the conversation context. */
	contextTokenEstimate?: number
}

/**
 * Build an Anthropic-compatible client, optionally routing through the
 * Inference Booster Layer.
 *
 * @param options - Client options. New fields: `queryText`, `taskType`, `fileCount`, `contextTokenEstimate`.
 * @returns Anthropic-typed client (real or OpenAI-shim).
 */
export async function getInferenceClient(options: GetInferenceClientOptions): Promise<Anthropic> {
	const routerConfig = readRouterConfig()

	// Cold path: router disabled → exact legacy behavior.
	if (!routerConfig && !options.providerOverride) {
		return getAnthropicClient({
			apiKey: options.apiKey,
			maxRetries: options.maxRetries,
			model: options.model,
			fetchOverride: options.fetchOverride,
			source: options.source,
			providerOverride: options.providerOverride,
			effortValue: options.effortValue,
		})
	}

	// Hot path: route the call.
	const decision = await route(
		{
			queryText: options.queryText ?? '',
			contextTokenEstimate: options.contextTokenEstimate ?? 0,
			toolBudget: 0,
			taskType: options.taskType,
			fileCount: options.fileCount,
			providerOverride: options.providerOverride,
		},
		routerConfig ?? undefined,
	)

	// First-party Anthropic → use the real SDK (preserves OAuth, retries, etc.)
	if (decision.family === 'anthropic') {
		return getAnthropicClient({
			apiKey: decision.apiKey || options.apiKey,
			maxRetries: options.maxRetries,
			model: decision.model,
			fetchOverride: options.fetchOverride,
			source: options.source,
			effortValue: options.effortValue,
		})
	}

	// OpenAI-compatible → shim client pointed at routed baseURL.
	const reasoningEffort: OpenAIEffortLevel | undefined = options.effortValue
		? standardEffortToOpenAI(convertEffortValueToLevel(options.effortValue))
		: undefined

	const client = createOpenAIShimClient({
		maxRetries: options.maxRetries,
		reasoningEffort,
		providerOverride: {
			model: decision.model,
			baseURL: decision.baseURL,
			apiKey: decision.apiKey,
		},
	}) as Anthropic

	// Tag the client with the decision so callers (and the cost ledger) can
	// inspect what was picked. We use a Symbol to avoid colliding with the
	// SDK's own property names.
	;(client as unknown as { __routingDecision?: RoutingDecision }).__routingDecision = decision

	return client
}

/**
 * Read router config from settings.inferenceRouter.
 *
 * Returns null when no routing is configured — callers use this as the signal
 * to skip the IBL path entirely (legacy single-provider behavior).
 */
function readRouterConfig(): RouterConfig | null {
	const config = getGlobalConfig()
	const raw = (config as unknown as Record<string, unknown>).inferenceRouter
	if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
	const r = raw as Record<string, unknown>
	if (!Array.isArray(r.rules)) return null

	return {
		rules: r.rules as RouterConfig['rules'],
		defaultProvider: typeof r.defaultProvider === 'string' ? r.defaultProvider : undefined,
		costOptimization: r.costOptimization !== false,
		latencyOptimization: r.latencyOptimization !== false,
		enableBooster: r.enableBooster === true,
	}
}

/**
 * Record a cost entry against the last routing decision attached to a client.
 * Called from `claude.ts` after each model response.
 *
 * @param client - The client returned by {@link getInferenceClient}.
 * @param metrics - Token counts and timing from the response.
 */
export function recordRoutingCost(
	client: Anthropic,
	metrics: {
		inputTokens: number
		outputTokens: number
		latencyMs: number
		success: boolean
		costUsd?: number
	},
): void {
	const decision = (client as unknown as { __routingDecision?: RoutingDecision }).__routingDecision
	if (!decision) return // legacy client — no telemetry

	const family: ProviderFamily = decision.family ?? 'unknown'
	const taskType: TaskType = decision.taskType
	const costUsd = metrics.costUsd ?? estimateCost(decision, metrics)

	recordCost({
		timestamp: Date.now(),
		provider: decision.provider,
		model: decision.model,
		family,
		inputTokens: metrics.inputTokens,
		outputTokens: metrics.outputTokens,
		costUsd,
		latencyMs: metrics.latencyMs,
		taskType,
		success: metrics.success,
	})
}

/**
 * Rough cost estimate from the routing decision's per-call average.
 * Real cost requires per-model price tables — the cost ledger will record
 * accurate numbers over time, this is just a first-call placeholder.
 */
function estimateCost(
	decision: RoutingDecision,
	metrics: { inputTokens: number; outputTokens: number },
): number {
	// Local providers are free.
	if (decision.family === 'local') return 0
	// Use the historical average from the router, scaled by token count.
	const expectedTokens = Math.max(1, metrics.inputTokens + metrics.outputTokens)
	const ratio = expectedTokens / 1000 // avg per-kilogram
	return decision.estimatedCostUsd * ratio
}

/**
 * Synchronous classification-only helper. Useful when a caller needs the task
 * type but doesn't need the full client (e.g. logging, telemetry).
 */
export function classifyQuery(text: string): {
	taskType: TaskType
	preferFast: boolean
	preferStrong: boolean
} {
	return classifyTask({ queryText: text })
}

/** Re-export route() so consumers can resolve a decision without a client. */
export { route } from './router.js'
export type { RouteInput, RoutingDecision } from './types.js'
