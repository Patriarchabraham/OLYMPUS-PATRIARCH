import { describe, it, expect } from 'vitest'
import { TokenMultiplierTracker } from '../tokenMultiplier.js'
import type { ProofResult } from '../types.js'

function makeMockProofResult(confidence: number): ProofResult {
	return {
		id: 'test-proof',
		overallConfidence: confidence,
		dimensions: {
			mathematical: { value: confidence, weight: 0.30, findings: [], subScores: {} },
			logical: { value: confidence, weight: 0.30, findings: [], subScores: {} },
			engineering: { value: confidence, weight: 0.25, findings: [], subScores: {} },
			typographical: { value: confidence, weight: 0.15, findings: [], subScores: {} },
		},
		passed: confidence >= 0.997,
		escalationRequired: false,
		escalationFixes: [],
		tokenEfficiency: {
			correctLinesPerToken: 0.5,
			reworkRatio: 0,
			usefulTokenRatio: 0.8,
			trend: 'stable',
		},
		proofCacheKey: 'test-key',
		timestamp: Date.now(),
		durationMs: 10,
	}
}

describe('TokenMultiplierTracker', () => {
	it('should record verifications and update state', () => {
		const tracker = new TokenMultiplierTracker()
		const result = makeMockProofResult(0.99)
		tracker.recordVerification(result, 100)

		const report = tracker.getMultiplierReport()
		expect(report.totalProofsRun).toBe(1)
		expect(report.totalTokensAnalyzed).toBe(100)
	})

	it('should set baseline on first measurement', () => {
		const tracker = new TokenMultiplierTracker()
		const result = makeMockProofResult(0.99)
		tracker.recordVerification(result, 100)

		const report = tracker.getMultiplierReport()
		expect(report.baselineCorrectLinesPerToken).toBeGreaterThan(0)
	})

	it('should compute trend as stable with few entries', () => {
		const tracker = new TokenMultiplierTracker()
		tracker.recordVerification(makeMockProofResult(0.99), 100)

		const trend = tracker.getTrend()
		expect(trend).toBe('stable')
	})

	it('should detect improving trend', () => {
		const tracker = new TokenMultiplierTracker(30)

		// Simulate improving efficiency: more correct lines per token over time
		for (let i = 0; i < 25; i++) {
			const result = makeMockProofResult(0.9 + i * 0.004)
			result.tokenEfficiency.correctLinesPerToken = 0.3 + i * 0.02
			tracker.recordVerification(result, 100)
		}

		const trend = tracker.getTrend()
		expect(trend).toBe('improving')
	})

	it('should generate recommendations for declining trend', () => {
		const tracker = new TokenMultiplierTracker(30)

		// Simulate declining efficiency
		for (let i = 0; i < 25; i++) {
			const result = makeMockProofResult(0.9 - i * 0.01)
			result.tokenEfficiency.correctLinesPerToken = 0.5 - i * 0.01
			tracker.recordVerification(result, 100)
		}

		const recommendations = tracker.getRecommendations()
		expect(recommendations.length).toBeGreaterThan(0)
	})

	it('should limit history to max entries', () => {
		const tracker = new TokenMultiplierTracker(5)

		for (let i = 0; i < 10; i++) {
			tracker.recordVerification(makeMockProofResult(0.99), 50)
		}

		const state = tracker.getState()
		expect(state.history.length).toBeLessThanOrEqual(5)
	})

	it('should return correct token efficiency', () => {
		const tracker = new TokenMultiplierTracker()
		const result = makeMockProofResult(0.99)
		result.tokenEfficiency.correctLinesPerToken = 0.5
		tracker.recordVerification(result, 100)

		const eff = tracker.getTokenEfficiency()
		expect(eff.correctLinesPerToken).toBeGreaterThan(0)
		expect(eff.trend).toBeDefined()
	})

	it('should persist and restore state', () => {
		const tracker = new TokenMultiplierTracker()
		tracker.recordVerification(makeMockProofResult(0.99), 100)

		const state = tracker.getState()
		const restored = new TokenMultiplierTracker()
		restored.loadState(state)

		expect(restored.getMultiplierReport().totalProofsRun).toBe(1)
	})

	it('should handle default efficiency for empty tracker', () => {
		const tracker = new TokenMultiplierTracker()
		const eff = tracker.getTokenEfficiency()
		expect(eff.correctLinesPerToken).toBe(0)
		expect(eff.trend).toBe('stable')
	})
})
