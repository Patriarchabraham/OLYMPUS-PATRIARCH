import { describe, expect, it } from 'vitest'
import { GovernanceEngine } from './governanceEngine.js'
import { DEFAULT_GOVERNANCE_CONFIG } from './types.js'

describe('GovernanceEngine', () => {
	it('can be created with init', async () => {
		const engine = await GovernanceEngine.init(undefined, {
			...DEFAULT_GOVERNANCE_CONFIG,
			persistHistory: false,
		})
		expect(engine).toBeDefined()
		expect(engine.getConfig()).toBeDefined()
	})

	it('returns empty history initially', async () => {
		const engine = await GovernanceEngine.init(undefined, {
			...DEFAULT_GOVERNANCE_CONFIG,
			persistHistory: false,
		})
		expect(engine.getHistory()).toEqual([])
	})

	it('returns null last report initially', async () => {
		const engine = await GovernanceEngine.init(undefined, {
			...DEFAULT_GOVERNANCE_CONFIG,
			persistHistory: false,
		})
		expect(engine.getLastReport()).toBeNull()
	})

	it('can analyze a project directory', async () => {
		const engine = await GovernanceEngine.init(undefined, {
			...DEFAULT_GOVERNANCE_CONFIG,
			persistHistory: false,
		})
		const report = await engine.analyzeProject('src/governance/')
		expect(report).toBeDefined()
		expect(report.filesAnalyzed).toBeGreaterThan(0)
		expect(report.overallScore).toBeGreaterThanOrEqual(0)
		expect(report.overallScore).toBeLessThanOrEqual(1)
	})
})
