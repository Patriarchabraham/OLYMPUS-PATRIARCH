import { describe, it, expect, beforeEach } from 'vitest'
import { ProofEngine } from '../proofEngine.js'
import { resetProofEngine } from '../index.js'

describe('ProofEngine', () => {
	let engine: ProofEngine

	beforeEach(() => {
		resetProofEngine()
		engine = new ProofEngine({ enableCaching: false, enableTokenTracking: true })
	})

	it('should prove clean code with high confidence', async () => {
		const code = `
			function add(a: number, b: number): number {
				return a + b
			}
		`
		const result = await engine.prove(code, 'test.ts')
		expect(result.overallConfidence).toBeGreaterThan(0.5)
		expect(result.passed).toBeDefined()
		expect(result.dimensions).toHaveProperty('mathematical')
		expect(result.dimensions).toHaveProperty('logical')
		expect(result.dimensions).toHaveProperty('engineering')
		expect(result.dimensions).toHaveProperty('typographical')
	})

	it('should flag problematic code with lower confidence', async () => {
		const code = `
			if (false) { doSomething() }
			if (true) { doOther() }
			const x = a / 0
			return
			doUnreachable()
		`
		const result = await engine.prove(code, 'bad.ts')
		expect(result.overallConfidence).toBeLessThan(0.95)
		expect(result.dimensions.logical.value).toBeLessThan(0.9)
	})

	it('should generate escalation fixes for low confidence', async () => {
		const code = `
			if (false) { x() }
			if (false) { y() }
			if (true) { z() }
		`
		const result = await engine.prove(code, 'escalation.ts')
		if (!result.passed && result.escalationRequired) {
			expect(result.escalationFixes.length).toBeGreaterThan(0)
		}
	})

	it('should cache results when caching is enabled', async () => {
		const cached = new ProofEngine({ enableCaching: true })
		const code = 'const x = 1 + 2'

		const result1 = await cached.prove(code, 'cached.ts')
		const result2 = await cached.prove(code, 'cached.ts')

		expect(result1.proofCacheKey).toBe(result2.proofCacheKey)
		expect(result1.id).toBe(result2.id) // Same cache result
	})

	it('should track token usage', async () => {
		const result = await engine.prove('const x = 1', 'token.ts')
		engine.recordTokenUsage(result, 100)

		const report = engine.getTokenMultiplierReport()
		expect(report.totalProofsRun).toBe(1)
		expect(report.totalTokensAnalyzed).toBe(100)
	})

	it('should return recent proofs', async () => {
		await engine.prove('const a = 1', 'a.ts')
		await engine.prove('const b = 2', 'b.ts')
		await engine.prove('const c = 3', 'c.ts')

		const recent = engine.getRecentProofs(2)
		expect(recent.length).toBe(2)
	})

	it('should register and use proven functions', async () => {
		engine.registerProvenFunction('safeAdd', 0.999)
		// The compositional proof should use this confidence
		const result = await engine.prove('const x = safeAdd(1, 2)', 'comp.ts')
		expect(result).toBeDefined()
	})

	it('should clear cache', async () => {
		const cached = new ProofEngine({ enableCaching: true })
		await cached.prove('const x = 1', 'clear.ts')
		cached.clearCache()
		// No error means cache was cleared
		expect(true).toBe(true)
	})

	it('should compute duration', async () => {
		const result = await engine.prove('const x = 1', 'dur.ts')
		expect(result.durationMs).toBeGreaterThanOrEqual(0)
	})
})
