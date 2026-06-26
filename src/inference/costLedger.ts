/**
 * Append-only cost + latency ledger.
 *
 * Every {@link getInferenceClient} call appends one entry to
 * `~/.openclaude/costs.jsonl`. The router reads 30-day rolling stats per
 * provider to inform future routing decisions. Stats.tsx reads
 * {@link getSummary} for the UI.
 *
 * Storage budget: ~1KB per entry × ~10K entries/day = ~10MB/day, ~300MB/month.
 * Entries older than 30 days are pruned on read.
 */

import {
	appendFileSync,
	existsSync,
	mkdirSync,
	readFileSync,
	renameSync,
	writeFileSync,
} from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'

import type { CostEntry, CostSummary, ProviderId, ProviderStats, TaskType } from './types.js'

/** 30 days in milliseconds. */
const RETENTION_MS = 30 * 24 * 60 * 60 * 1000

/**
 * Ledger file location: `~/.openclaude/costs.jsonl`.
 * Declared `let` so tests can override via {@link _setLedgerPathForTest}.
 */
let LEDGER_PATH = join(homedir(), '.openclaude', 'costs.jsonl')

/** In-memory cache of stats, invalidated on write. */
let cachedStats: Map<ProviderId, ProviderStats> | null = null
let cachedAt = 0
const CACHE_TTL_MS = 5000

/**
 * Append a single cost entry to the ledger. Synchronous append is safe here:
 * the file is opened in append mode per write and Node guarantees atomicity
 * for writes under the pipe buffer (4KB on Linux, larger on Windows).
 *
 * @param entry - The cost/latency record to persist.
 */
export function recordCost(entry: CostEntry): void {
	ensureLedgerDir()
	const line = `${JSON.stringify(entry)}\n`
	try {
		appendFileSync(LEDGER_PATH, line, { encoding: 'utf8' })
	} catch (_err) {}
	cachedStats = null
}

/**
 * Read all entries within the retention window. Prunes older entries to a
 * side file before returning, so the main file stays bounded.
 *
 * @returns Array of entries from the last 30 days.
 */
export function readRecentEntries(): CostEntry[] {
	if (!existsSync(LEDGER_PATH)) {
		return []
	}

	let raw = ''
	try {
		raw = readFileSync(LEDGER_PATH, { encoding: 'utf8' })
	} catch {
		return []
	}

	const now = Date.now()
	const cutoff = now - RETENTION_MS
	const kept: CostEntry[] = []
	const pruned: CostEntry[] = []

	for (const line of raw.split('\n')) {
		const trimmed = line.trim()
		if (!trimmed) continue
		try {
			const entry = JSON.parse(trimmed) as CostEntry
			if (entry.timestamp >= cutoff) {
				kept.push(entry)
			} else {
				pruned.push(entry)
			}
		} catch {
			// Skip malformed lines silently — partial writes / crashes.
		}
	}

	// Periodically compact: if >10% of lines were pruned, rewrite the file.
	if (pruned.length > 0 && pruned.length > kept.length * 0.1) {
		rewriteLedger(kept)
	}

	return kept
}

/**
 * Get per-provider aggregated stats (30-day window). Cached for 5s.
 *
 * @returns Map keyed by provider id.
 */
export function getStats(): Map<ProviderId, ProviderStats> {
	const now = Date.now()
	if (cachedStats && now - cachedAt < CACHE_TTL_MS) {
		return cachedStats
	}

	const entries = readRecentEntries()
	const byProvider = new Map<ProviderId, Aggregator>()

	for (const e of entries) {
		const agg = byProvider.get(e.provider) ?? newAggregator(e.provider)
		agg.calls += 1
		agg.successCount += e.success ? 1 : 0
		agg.totalLatencyMs += e.latencyMs
		agg.totalCostUsd += e.costUsd
		byProvider.set(e.provider, agg)
	}

	const result = new Map<ProviderId, ProviderStats>()
	for (const agg of byProvider.values()) {
		result.set(agg.provider, finalizeStats(agg))
	}

	cachedStats = result
	cachedAt = now
	return result
}

/**
 * UI-facing summary for the Stats.tsx component.
 *
 * @returns Aggregated totals and per-provider breakdowns.
 */
export function getSummary(): CostSummary {
	const entries = readRecentEntries()
	const byProvider = new Map<ProviderId, Aggregator>()
	const byTaskType = new Map<TaskType, number>()

	let totalCost = 0
	for (const e of entries) {
		const agg = byProvider.get(e.provider) ?? newAggregator(e.provider)
		agg.calls += 1
		agg.successCount += e.success ? 1 : 0
		agg.totalLatencyMs += e.latencyMs
		agg.totalCostUsd += e.costUsd
		byProvider.set(e.provider, agg)

		byTaskType.set(e.taskType, (byTaskType.get(e.taskType) ?? 0) + 1)
		totalCost += e.costUsd
	}

	const avgLatencyByProvider: Record<ProviderId, number> = {}
	const successRateByProvider: Record<ProviderId, number> = {}
	for (const [id, agg] of byProvider) {
		avgLatencyByProvider[id] = agg.calls > 0 ? agg.totalLatencyMs / agg.calls : 0
		successRateByProvider[id] = agg.calls > 0 ? agg.successCount / agg.calls : 0
	}

	const callsByTaskType = Object.fromEntries(byTaskType) as Record<TaskType, number>

	return {
		totalCost30d: totalCost,
		totalCalls30d: entries.length,
		avgLatencyByProvider,
		successRateByProvider,
		callsByTaskType,
	}
}

/** Reset the in-memory stats cache. For tests. */
export function resetStatsCache(): void {
	cachedStats = null
	cachedAt = 0
}

/** Override the ledger path. For tests only. */
export function _setLedgerPathForTest(path: string): void {
	LEDGER_PATH = path
	cachedStats = null
}

// --- Internal helpers ---

interface Aggregator {
	provider: ProviderId
	calls: number
	successCount: number
	totalLatencyMs: number
	totalCostUsd: number
}

function newAggregator(provider: ProviderId): Aggregator {
	return { provider, calls: 0, successCount: 0, totalLatencyMs: 0, totalCostUsd: 0 }
}

function finalizeStats(agg: Aggregator): ProviderStats {
	return {
		provider: agg.provider,
		calls: agg.calls,
		successRate: agg.calls > 0 ? agg.successCount / agg.calls : 0,
		avgLatencyMs: agg.calls > 0 ? agg.totalLatencyMs / agg.calls : 0,
		totalCostUsd: agg.totalCostUsd,
		avgCostPerCall: agg.calls > 0 ? agg.totalCostUsd / agg.calls : 0,
	}
}

function ensureLedgerDir(): void {
	const dir = dirname(LEDGER_PATH)
	if (!existsSync(dir)) {
		try {
			mkdirSync(dir, { recursive: true })
		} catch {
			// Best-effort — recordCost swallows write errors.
		}
	}
}

function rewriteLedger(kept: CostEntry[]): void {
	const tmpPath = `${LEDGER_PATH}.tmp`
	try {
		const content = kept.map((e) => JSON.stringify(e)).join('\n')
		writeFileSync(tmpPath, content, { encoding: 'utf8' })
		renameSync(tmpPath, LEDGER_PATH)
	} catch {
		// If compaction fails, leave the file as-is — next read tries again.
	}
}
