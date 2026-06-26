/**
 * Per-query multi-vendor router.
 *
 * Replaces session-scoped provider selection (env vars + active profile)
 * with a per-call decision. The router is the heart of the Inference Booster
 * Layer — it picks the optimal provider for each individual query based on
 * task type, cost history, latency history, and explicit user rules.
 *
 * Decision pipeline (early-exit on first match):
 *   1. {@link RouteInput.providerOverride} — wins over everything else.
 *   2. User-configured {@link RoutingRule}s — first match wins.
 *   3. Cost/latency scoring against the {@link CostLedger} 30-day window.
 *   4. Active provider profile (legacy fallback).
 *
 * All paths produce a {@link RoutingDecision} or throw a clear error.
 */

import { getGlobalConfig } from '../utils/config.js'
import { getActiveProviderProfile } from '../utils/providerProfiles.js'

import { getStats } from './costLedger.js'
import { classifyTask } from './taskClassifier.js'
import {
	type ProviderFamily,
	type ProviderId,
	type ProviderStats,
	ROUTER_SCORE_WEIGHTS,
	type RouteInput,
	type RouterConfig,
	type RoutingDecision,
	type RoutingRule,
} from './types.js'

/**
 * Resolve a provider id to a coarse family for cross-family verification.
 * Local providers (Ollama, vLLM, LM Studio, anything on localhost) collapse
 * to `'local'`.
 */
export function resolveFamily(provider: ProviderId, baseURL: string): ProviderFamily {
	const p = provider.toLowerCase()
	if (p.includes('anthropic') || p === 'firstparty') return 'anthropic'
	if (p.includes('openai') || p === 'openai') return 'openai'
	if (p.includes('gemini') || p.includes('google') || p.includes('vertex')) return 'google'
	if (p.includes('mistral')) return 'mistral'
	if (p.includes('deepseek')) return 'deepseek'
	if (p.includes('qwen') || p.includes('alibaba')) return 'qwen'
	if (p.includes('meta') || p.includes('llama')) return 'meta'
	if (p.includes('xai') || p.includes('grok')) return 'xai'
	if (/localhost|127\.0\.0\.1|0\.0\.0\.0|ollama|vllm|lmstudio|sglang/i.test(baseURL)) {
		return 'local'
	}
	return 'unknown'
}

/**
 * Pick the optimal provider for a single call.
 *
 * @param input - Per-query inputs.
 * @param config - Optional router configuration (rules, optimization flags).
 * @returns Routing decision with provider, model, baseURL, apiKey.
 * @throws If no provider can be resolved (override absent, no rules, no active profile).
 */
export async function route(input: RouteInput, config?: RouterConfig): Promise<RoutingDecision> {
	// 1. Per-agent override wins unconditionally — preserves the existing
	//    `ToolUseContext.options.providerOverride` contract at src/Tool.ts:180.
	if (input.providerOverride) {
		return decideFromOverride(input)
	}

	// 2. Resolve task type if caller didn't pre-classify.
	const taskType =
		input.taskType ??
		classifyTask({
			queryText: input.queryText,
			fileCount: input.fileCount,
		}).taskType

	// 3. Explicit rules — first priority-sorted match wins.
	const ruleMatch = matchRule(input, taskType, config?.rules ?? [])
	if (ruleMatch) {
		return decideFromRule(ruleMatch, taskType, input)
	}

	// 4. Stats-aware scoring — only if multiple providers configured.
	const scored = scoreProviders(taskType, config)
	if (scored) {
		return scored
	}

	// 5. Legacy fallback — active provider profile from settings.
	return decideFromActiveProfile(taskType, input)
}

/**
 * Match a routing rule. Rules sorted by priority (desc); ties broken by
 * insertion order. The first rule whose `condition` matches the input wins.
 */
function matchRule(
	input: RouteInput,
	taskType: RouteInput['taskType'],
	rules: RoutingRule[],
): RoutingRule | null {
	if (rules.length === 0) return null

	const sorted = [...rules].sort((a, b) => b.priority - a.priority)
	for (const rule of sorted) {
		const c = rule.condition
		if (c.taskType !== undefined && c.taskType !== taskType) continue
		if (c.fileCountGt !== undefined && (input.fileCount ?? 0) <= c.fileCountGt) continue
		if (c.contextTokensGt !== undefined && input.contextTokenEstimate <= c.contextTokensGt) continue
		// All conditions satisfied — match.
		return rule
	}
	return null
}

/** Build a decision from a per-agent override. */
function decideFromOverride(input: RouteInput): RoutingDecision {
	const o = input.providerOverride
	if (!o) throw new Error('override missing')
	return {
		provider: 'override',
		model: o.model,
		baseURL: o.baseURL,
		apiKey: o.apiKey,
		reason: 'per-agent override',
		taskType: input.taskType ?? 'feature_impl',
		estimatedCostUsd: 0,
		estimatedLatencyMs: 0,
		family: resolveFamily('override', o.baseURL),
	}
}

/** Build a decision from a matched routing rule. */
function decideFromRule(
	rule: RoutingRule,
	taskType: RouteInput['taskType'],
	_input: RouteInput,
): RoutingDecision {
	// We need the provider's baseURL/apiKey — look up from settings or active profile.
	const profile = lookupProviderProfile(rule.provider)
	return {
		provider: rule.provider,
		model: rule.model,
		baseURL: profile?.baseUrl ?? '',
		apiKey: profile?.apiKey ?? '',
		reason: `matched rule (priority ${rule.priority})`,
		taskType: taskType ?? 'feature_impl',
		estimatedCostUsd: 0,
		estimatedLatencyMs: 0,
		family: resolveFamily(rule.provider, profile?.baseUrl ?? ''),
	}
}

/**
 * Score all configured providers using 30-day cost/latency/success telemetry
 * and pick the best one for the given task type.
 *
 * Returns null if no providers have stats (cold start) — caller falls back
 * to active profile.
 */
function scoreProviders(
	taskType: RouteInput['taskType'],
	config?: RouterConfig,
): RoutingDecision | null {
	const stats = getStats()
	if (stats.size === 0) return null

	let best: { provider: ProviderId; stats: ProviderStats; score: number } | null = null

	for (const [provider, s] of stats) {
		// Skip providers with no recent activity (stale config).
		if (s.calls === 0) continue

		// Normalize each axis to [0, 1].
		const costNorm = config?.costOptimization ? normalizeCost(s.avgCostPerCall) : 0.5
		const latencyNorm = config?.latencyOptimization ? normalizeLatency(s.avgLatencyMs) : 0.5
		const successNorm = s.successRate

		// Lower cost/latency = better → invert.
		const score =
			(1 - costNorm) * ROUTER_SCORE_WEIGHTS.cost +
			(1 - latencyNorm) * ROUTER_SCORE_WEIGHTS.latency +
			successNorm * ROUTER_SCORE_WEIGHTS.successRate

		if (!best || score > best.score) {
			best = { provider, stats: s, score }
		}
	}

	if (!best) return null

	const profile = lookupProviderProfile(best.provider)
	if (!profile) {
		// Stats exist for a provider no longer in settings — skip.
		return null
	}

	return {
		provider: best.provider,
		model: profile.model,
		baseURL: profile.baseUrl,
		apiKey: profile.apiKey ?? '',
		reason: `scored best (cost/latency/success = ${best.score.toFixed(3)}) for ${taskType ?? 'feature_impl'}`,
		taskType: taskType ?? 'feature_impl',
		estimatedCostUsd: best.stats.avgCostPerCall,
		estimatedLatencyMs: best.stats.avgLatencyMs,
		family: resolveFamily(best.provider, profile.baseUrl),
	}
}

/** Fall back to the user's active provider profile (legacy single-provider path). */
function decideFromActiveProfile(
	taskType: RouteInput['taskType'],
	input: RouteInput,
): RoutingDecision {
	const profile = getActiveProviderProfile(getGlobalConfig())
	if (!profile) {
		throw new Error(
			'No provider available — set a provider profile or pass providerOverride. ' +
				`Query was: "${input.queryText.slice(0, 80)}..."`,
		)
	}

	return {
		provider: profile.provider,
		model: profile.model,
		baseURL: profile.baseUrl,
		apiKey: profile.apiKey ?? '',
		reason: 'active provider profile (legacy fallback)',
		taskType: taskType ?? 'feature_impl',
		estimatedCostUsd: 0,
		estimatedLatencyMs: 0,
		family: resolveFamily(profile.provider, profile.baseUrl),
	}
}

/** Look up a provider profile by id from global config. */
function lookupProviderProfile(provider: ProviderId): {
	baseUrl: string
	apiKey?: string
	model: string
} | null {
	const config = getGlobalConfig()
	const profiles = config.providerProfiles ?? []
	const match = profiles.find((p) => p.id === provider || p.provider === provider)
	if (!match) return null
	return { baseUrl: match.baseUrl, apiKey: match.apiKey, model: match.model }
}

/** Normalize a USD cost to [0, 1] for scoring. $0 = 0, $0.10+ = 1. */
function normalizeCost(costUsd: number): number {
	if (costUsd <= 0) return 0
	if (costUsd >= 0.1) return 1
	return costUsd / 0.1
}

/** Normalize a latency in ms to [0, 1] for scoring. 0ms = 0, 10s+ = 1. */
function normalizeLatency(ms: number): number {
	if (ms <= 0) return 0
	if (ms >= 10_000) return 1
	return ms / 10_000
}
