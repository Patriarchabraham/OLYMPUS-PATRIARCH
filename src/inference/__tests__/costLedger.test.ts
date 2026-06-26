import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
	_setLedgerPathForTest,
	getStats,
	getSummary,
	readRecentEntries,
	recordCost,
	resetStatsCache,
} from '../costLedger.js'
import type { CostEntry } from '../types.js'

let tempDir: string

beforeEach(() => {
	tempDir = mkdtempSync(join(tmpdir(), 'olympuz-cost-'))
	_setLedgerPathForTest(join(tempDir, 'costs.jsonl'))
	resetStatsCache()
})

afterEach(() => {
	rmSync(tempDir, { recursive: true, force: true })
})

function entry(overrides: Partial<CostEntry> = {}): CostEntry {
	return {
		timestamp: Date.now(),
		provider: 'ollama',
		model: 'qwen2.5-coder:7b',
		family: 'local',
		inputTokens: 100,
		outputTokens: 50,
		costUsd: 0,
		latencyMs: 500,
		taskType: 'feature_impl',
		success: true,
		...overrides,
	}
}

describe('costLedger', () => {
	it('roundtrips a single entry', () => {
		recordCost(entry({ provider: 'ollama', costUsd: 0 }))
		const entries = readRecentEntries()
		expect(entries).toHaveLength(1)
		expect(entries[0].provider).toBe('ollama')
	})

	it('aggregates per-provider stats', () => {
		recordCost(entry({ provider: 'ollama', latencyMs: 100, success: true }))
		recordCost(entry({ provider: 'ollama', latencyMs: 300, success: true }))
		recordCost(entry({ provider: 'openai', latencyMs: 200, success: false }))

		const stats = getStats()
		expect(stats.size).toBe(2)

		const ollama = stats.get('ollama')
		expect(ollama?.calls).toBe(2)
		expect(ollama?.successRate).toBe(1)
		expect(ollama?.avgLatencyMs).toBe(200)

		const openai = stats.get('openai')
		expect(openai?.calls).toBe(1)
		expect(openai?.successRate).toBe(0)
	})

	it('summary aggregates cost and counts by task type', () => {
		recordCost(entry({ provider: 'openai', costUsd: 0.01, taskType: 'feature_impl' }))
		recordCost(entry({ provider: 'openai', costUsd: 0.02, taskType: 'deep_refactor' }))
		recordCost(entry({ provider: 'ollama', costUsd: 0, taskType: 'trivial_fix' }))

		const summary = getSummary()
		expect(summary.totalCost30d).toBeCloseTo(0.03, 5)
		expect(summary.totalCalls30d).toBe(3)
		expect(summary.callsByTaskType.feature_impl).toBe(1)
		expect(summary.callsByTaskType.deep_refactor).toBe(1)
		expect(summary.callsByTaskType.trivial_fix).toBe(1)
	})

	it('prunes entries older than 30 days', () => {
		const old = entry({
			timestamp: Date.now() - 31 * 24 * 60 * 60 * 1000,
			provider: 'old',
		})
		const fresh = entry({ provider: 'fresh' })
		writeFileSync(
			join(tempDir, 'costs.jsonl'),
			`${JSON.stringify(old)}\n${JSON.stringify(fresh)}\n`,
		)

		const entries = readRecentEntries()
		expect(entries).toHaveLength(1)
		expect(entries[0].provider).toBe('fresh')
	})

	it('skips malformed lines silently', () => {
		writeFileSync(
			join(tempDir, 'costs.jsonl'),
			`not json\n${JSON.stringify(entry({ provider: 'good' }))}\n{broken\n`,
		)
		const entries = readRecentEntries()
		expect(entries).toHaveLength(1)
		expect(entries[0].provider).toBe('good')
	})

	it('caches stats within TTL window', () => {
		recordCost(entry({ provider: 'ollama' }))
		const first = getStats()
		// Second read within TTL window — should return cached value.
		const cached = getStats()
		expect(cached).toBe(first)
		expect(cached.get('ollama')?.calls).toBe(1)

		// After cache reset, fresh read picks up new state.
		recordCost(entry({ provider: 'ollama' }))
		resetStatsCache()
		const fresh = getStats()
		expect(fresh.get('ollama')?.calls).toBe(2)
	})

	it('handles missing ledger file gracefully', () => {
		_setLedgerPathForTest(join(tempDir, 'does-not-exist.jsonl'))
		expect(readRecentEntries()).toEqual([])
		expect(getStats().size).toBe(0)
	})
})
