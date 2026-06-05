/**
 * Token Multiplier — tracks correct-lines-per-token and computes
 * efficiency trends to maximize programming speed per LLM token.
 *
 * Uses linear regression over a rolling window to detect improvement/decline.
 * Feeds recommendations back into the prompt evolution system.
 */

import type {
	EfficiencyTrend,
	ProofResult,
	TokenEfficiencyHistoryEntry,
	TokenMultiplierReport,
	TokenMultiplierState,
} from './types.js'

/** Maximum entries to keep in the rolling window */
const MAX_WINDOW = 20

export class TokenMultiplierTracker {
	private state: TokenMultiplierState
	private readonly maxHistory: number

	constructor(maxHistory = 100) {
		this.maxHistory = maxHistory
		this.state = {
			history: [],
			baselineCorrectLinesPerToken: 0,
			currentCorrectLinesPerToken: 0,
			improvementRate: 0,
			totalProofsRun: 0,
			totalTokensAnalyzed: 0,
			averageConfidence: 0,
		}
	}

	/**
	 * Record a proof result with the tokens used to generate that code.
	 * Updates the efficiency history and recomputes the trend.
	 */
	recordVerification(proofResult: ProofResult, tokenCount: number): void {
		const linesOfCode = proofResult.tokenEfficiency.correctLinesPerToken * tokenCount
		const reworkLines = proofResult.tokenEfficiency.reworkRatio * linesOfCode

		const entry: TokenEfficiencyHistoryEntry = {
			timestamp: Date.now(),
			totalTokensUsed: tokenCount,
			correctLinesProduced: Math.max(0, linesOfCode - reworkLines),
			reworkLines,
			filesVerified: 1,
			averageProofConfidence: proofResult.overallConfidence,
		}

		this.state.history.push(entry)
		if (this.state.history.length > this.maxHistory) {
			this.state.history = this.state.history.slice(-this.maxHistory)
		}

		this.state.totalProofsRun++
		this.state.totalTokensAnalyzed += tokenCount

		// Set baseline on first measurement
		if (this.state.baselineCorrectLinesPerToken === 0) {
			this.state.baselineCorrectLinesPerToken = entry.correctLinesProduced / Math.max(1, tokenCount)
		}

		// Update current ratio
		this.state.currentCorrectLinesPerToken = entry.correctLinesProduced / Math.max(1, tokenCount)

		// Update average confidence
		const totalConf = this.state.history.reduce((s, e) => s + e.averageProofConfidence, 0)
		this.state.averageConfidence = totalConf / this.state.history.length

		// Recompute trend
		this.state.improvementRate = this.computeLinearRegression()
	}

	/**
	 * Compute linear regression slope over the last N entries.
	 * Returns the slope: positive = improving, negative = declining.
	 */
	private computeLinearRegression(): number {
		const data = this.state.history.slice(-MAX_WINDOW)
		if (data.length < 2) return 0

		const n = data.length
		let sumX = 0
		let sumY = 0
		let sumXY = 0
		let sumXX = 0

		for (let i = 0; i < n; i++) {
			const x = i
			const y = data[i].correctLinesProduced / Math.max(1, data[i].totalTokensUsed)
			sumX += x
			sumY += y
			sumXY += x * y
			sumXX += x * x
		}

		const denominator = n * sumXX - sumX * sumX
		if (denominator === 0) return 0

		return (n * sumXY - sumX * sumY) / denominator
	}

	/**
	 * Determine the current efficiency trend.
	 */
	getTrend(): EfficiencyTrend {
		const rate = this.state.improvementRate
		const threshold = 0.001
		if (rate > threshold) return 'improving'
		if (rate < -threshold) return 'declining'
		return 'stable'
	}

	/**
	 * Generate recommendations based on the current efficiency state.
	 */
	getRecommendations(): string[] {
		const recommendations: string[] = []
		const trend = this.getTrend()

		if (trend === 'declining') {
			recommendations.push(
				'Token efficiency declining — consider adding more specific instructions to reduce rework',
			)
		}

		if (this.state.averageConfidence < 0.95) {
			recommendations.push(
				'Average proof confidence below 95% — add type annotations and assertion checks',
			)
		}

		if (this.state.currentCorrectLinesPerToken < this.state.baselineCorrectLinesPerToken * 0.8) {
			recommendations.push(
				'Correct-lines-per-token dropped below 80% of baseline — review recent prompt changes',
			)
		}

		const reworkEntries = this.state.history.filter((e) => e.reworkLines > 0)
		if (reworkEntries.length > this.state.history.length * 0.5) {
			recommendations.push(
				'High rework rate detected — generate more precise initial code to avoid corrections',
			)
		}

		if (recommendations.length === 0 && trend === 'improving') {
			recommendations.push('Token efficiency improving — current strategies are effective')
		}

		return recommendations
	}

	/**
	 * Get the current token efficiency score.
	 */
	getTokenEfficiency(): { correctLinesPerToken: number; reworkRatio: number; usefulTokenRatio: number; trend: EfficiencyTrend } {
		const lastEntry = this.state.history[this.state.history.length - 1]
		if (!lastEntry) {
			return {
				correctLinesPerToken: 0,
				reworkRatio: 0,
				usefulTokenRatio: 1,
				trend: 'stable',
			}
		}

		return {
			correctLinesPerToken: this.state.currentCorrectLinesPerToken,
			reworkRatio: lastEntry.reworkLines / Math.max(1, lastEntry.correctLinesProduced + lastEntry.reworkLines),
			usefulTokenRatio: lastEntry.correctLinesProduced / Math.max(1, lastEntry.totalTokensUsed),
			trend: this.getTrend(),
		}
	}

	/**
	 * Generate a public report for context augmentation.
	 */
	getMultiplierReport(): TokenMultiplierReport {
		return {
			currentCorrectLinesPerToken: this.state.currentCorrectLinesPerToken,
			baselineCorrectLinesPerToken: this.state.baselineCorrectLinesPerToken,
			averageConfidence: this.state.averageConfidence,
			trend: this.getTrend(),
			improvementRate: this.state.improvementRate,
			totalProofsRun: this.state.totalProofsRun,
			totalTokensAnalyzed: this.state.totalTokensAnalyzed,
			recommendations: this.getRecommendations(),
		}
	}

	/**
	 * Get the internal state (for persistence).
	 */
	getState(): TokenMultiplierState {
		return { ...this.state }
	}

	/**
	 * Restore state from a saved snapshot.
	 */
	loadState(state: TokenMultiplierState): void {
		this.state = { ...state }
	}
}
