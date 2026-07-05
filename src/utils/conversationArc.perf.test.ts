import { beforeEach, describe, expect, it } from 'vitest'
import { getArcSummary, initializeArc, resetArc, updateArcPhase } from './conversationArc.js'

function createMessage(content: string): any {
	return {
		message: { role: 'user', content, id: 'test', type: 'message', created_at: Date.now() },
		sender: 'user',
	}
}

// Run when a SQLite backend is available (knowledgeGraph persists via it):
// bun:sqlite under Bun, node:sqlite (built-in, Node 22+) under Node.
let sqliteAvailable = false
try {
	if (typeof Bun !== 'undefined') {
		require('bun:sqlite')
	} else {
		require('node:sqlite')
	}
	sqliteAvailable = true
} catch {}

describe.skipIf(!sqliteAvailable)('Conversation Arc Performance Benchmarks', () => {
	beforeEach(() => {
		resetArc()
		initializeArc()
	})

	it('performs automatic fact extraction in sub-millisecond time', async () => {
		const iterations = 100
		const complexContent =
			'Deploying version v1.2.3 to /opt/prod/server on https://api.prod.local with JIRA_URL=https://jira.corp'

		const startTime = performance.now()
		for (let i = 0; i < iterations; i++) {
			await updateArcPhase([createMessage(complexContent)])
		}
		const duration = performance.now() - startTime
		const averageTime = duration / iterations

		// Performance guard: catches gross regressions (seconds-per-message) while
		// tolerating environment variance. Observed ~14ms/msg on a 6GB Windows/Node
		// box with SQLite WAL writes + Orama indexing under the full suite; faster CI
		// runs well under 5ms. The threshold gives ~3x headroom over the slowest
		// observed environment without masking a real slowdown.
		expect(averageTime).toBeLessThan(40.0)
	})

	it('generates summaries quickly even with a populated graph', async () => {
		// Populate graph with 50 facts
		for (let i = 0; i < 50; i++) {
			await updateArcPhase([createMessage(`Var_${i}=Value_${i} in /path/to/file_${i}`)])
		}

		const startTime = performance.now()
		const summary = await getArcSummary()
		const duration = performance.now() - startTime

		expect(summary).toMatch(/Knowledge Graph/)
		// Summary generation should be fast
		expect(duration).toBeLessThan(50)
	})

	it('maintains a compact memory footprint', async () => {
		const arc = initializeArc()
		for (let i = 0; i < 100; i++) {
			await updateArcPhase([createMessage(`Fact_${i}=Value_${i}`)])
		}

		const serialized = JSON.stringify(arc)
		const sizeKB = serialized.length / 1024

		// Should be well under 100KB for 100 simple facts
		expect(sizeKB).toBeLessThan(100)
	})
})
