/**
 * Performance Tracker — multi-dimensional scoring for agent employees.
 * 5 dimensions: quality (30%), speed (25%), accuracy (20%), collaboration (15%), initiative (10%).
 * Uses time-decay weighting with 7-day half-life.
 */

import type { PerformanceDimensions, PerformanceScore } from './types.js'

interface MetricRecord {
	timestamp: number
	dimension: keyof PerformanceDimensions
	value: number
}

/** Dimension weights for overall score calculation */
const DIMENSION_WEIGHTS: Record<keyof PerformanceDimensions, number> = {
	quality: 0.3,
	speed: 0.25,
	accuracy: 0.2,
	collaboration: 0.15,
	initiative: 0.1,
}

/** Default performance when no data exists */
const DEFAULT_DIMENSIONS: PerformanceDimensions = {
	quality: 0.5,
	speed: 0.5,
	accuracy: 0.5,
	collaboration: 0.5,
	initiative: 0.5,
}

/**
 * Track and calculate agent performance across 5 dimensions.
 */
export class PerformanceTracker {
	private records: Map<string, MetricRecord[]> = new Map()
	private halfLife = 7 * 24 * 60 * 60 * 1000 // 7 days in ms

	/**
	 * Record a performance metric for an agent.
	 * Values are clamped to [0, 1].
	 */
	record(agentId: string, dimension: keyof PerformanceDimensions, value: number): void {
		if (!this.records.has(agentId)) {
			this.records.set(agentId, [])
		}
		this.records.get(agentId)!.push({
			timestamp: Date.now(),
			dimension,
			value: Math.max(0, Math.min(1, value)),
		})
	}

	/**
	 * Calculate the current performance score for an agent.
	 * Uses time-decay weighting: recent metrics have more influence.
	 */
	getScore(agentId: string): PerformanceScore {
		const records = this.records.get(agentId) || []
		const now = Date.now()

		const dimensions: PerformanceDimensions = { ...DEFAULT_DIMENSIONS }

		for (const dim of Object.keys(dimensions) as Array<keyof PerformanceDimensions>) {
			const dimRecords = records.filter((r) => r.dimension === dim)
			if (dimRecords.length === 0) continue

			let totalWeight = 0
			let weightedSum = 0

			for (const record of dimRecords) {
				const age = now - record.timestamp
				const weight = 0.5 ** (age / this.halfLife)
				weightedSum += record.value * weight
				totalWeight += weight
			}

			dimensions[dim] = totalWeight > 0 ? weightedSum / totalWeight : 0.5
		}

		const overall = (Object.keys(DIMENSION_WEIGHTS) as Array<keyof PerformanceDimensions>).reduce(
			(sum, dim) => sum + dimensions[dim] * DIMENSION_WEIGHTS[dim],
			0,
		)

		return { overall, dimensions }
	}

	/**
	 * Get the top-performing agents sorted by overall score.
	 */
	getTopPerformers(
		agentIds: string[],
		limit = 10,
	): Array<{ agentId: string; score: PerformanceScore }> {
		return agentIds
			.map((id) => ({ agentId: id, score: this.getScore(id) }))
			.sort((a, b) => b.score.overall - a.score.overall)
			.slice(0, limit)
	}

	/**
	 * Prune records older than 90 days to prevent unbounded memory growth.
	 */
	prune(): void {
		const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000

		for (const [agentId, records] of this.records) {
			const filtered = records.filter((r) => r.timestamp >= cutoff)
			if (filtered.length === 0) {
				this.records.delete(agentId)
			} else {
				this.records.set(agentId, filtered)
			}
		}
	}
}
