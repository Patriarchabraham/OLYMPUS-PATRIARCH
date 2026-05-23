import type {
	InteractionRecord,
	StrategyEffectiveness,
	ToolUsageStats,
	TrendData,
} from './types.js'

/** Half-life for exponential time decay (7 days in milliseconds) */
const DECAY_HALF_LIFE_MS = 7 * 24 * 60 * 60 * 1000
/** Maximum age for interaction records before pruning (90 days) */
const MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000

export class EffectivenessTracker {
	private interactions: InteractionRecord[] = []

	constructor(existing?: InteractionRecord[]) {
		if (existing) {
			this.interactions = existing
		}
	}

	/**
	 * Compute exponential time-decay weight for a record based on its age.
	 * Recent interactions have weight ~1.0, old interactions decay towards 0.
	 * Uses half-life formula: weight = 0.5^(age / halfLife)
	 */
	static computeDecayWeight(timestamp: number, now: number = Date.now()): number {
		const ageMs = now - timestamp
		if (ageMs <= 0) return 1.0
		return 0.5 ** (ageMs / DECAY_HALF_LIFE_MS)
	}

	/**
	 * Prune interactions older than MAX_AGE_MS.
	 * Called automatically during getInteractions() to keep data fresh.
	 */
	pruneExpired(): void {
		const cutoff = Date.now() - MAX_AGE_MS
		this.interactions = this.interactions.filter((r) => r.timestamp >= cutoff)
	}

	recordInteraction(record: InteractionRecord): void {
		this.interactions.push(record)
	}

	getInteractions(): InteractionRecord[] {
		return this.interactions
	}

	getStrategyEffectiveness(strategy: string): StrategyEffectiveness {
		const records = this.interactions.filter((r) => r.strategy === strategy)
		const now = Date.now()

		// Time-decay weighted success rate
		let weightedSuccesses = 0
		let weightedTotal = 0
		let totalDuration = 0

		for (const r of records) {
			const weight = EffectivenessTracker.computeDecayWeight(r.timestamp, now)
			weightedTotal += weight
			if (r.success) weightedSuccesses += weight
			totalDuration += r.durationMs
		}

		return {
			strategy,
			totalUses: records.length,
			successes: records.filter((r) => r.success).length,
			successRate: weightedTotal > 0 ? weightedSuccesses / weightedTotal : 0,
			avgDurationMs: records.length > 0 ? totalDuration / records.length : 0,
		}
	}

	getToolEffectiveness(toolName: string): ToolUsageStats | null {
		const records = this.interactions.filter((r) => r.toolsUsed.includes(toolName))
		if (records.length === 0) return null

		const successes = records.filter((r) => r.success).length
		const totalDuration = records.reduce((sum, r) => sum + r.durationMs, 0)

		// Find common combinations (other tools used alongside this one)
		const comboMap = new Map<string, number>()
		for (const record of records) {
			const others = record.toolsUsed.filter((t) => t !== toolName).sort()
			if (others.length > 0) {
				const key = others.join(',')
				comboMap.set(key, (comboMap.get(key) ?? 0) + 1)
			}
		}

		const commonCombinations = [...comboMap.entries()]
			.sort((a, b) => b[1] - a[1])
			.slice(0, 5)
			.map(([combo]) => combo.split(','))

		// Determine best task types by looking at queries that succeeded with this tool
		const successRecords = records.filter((r) => r.success)
		const taskTypes = this.extractTaskTypes(successRecords.map((r) => r.query))

		return {
			toolName,
			totalUses: records.length,
			successRate: successes / records.length,
			avgDurationMs: totalDuration / records.length,
			commonCombinations,
			bestForTaskTypes: taskTypes,
		}
	}

	getRecentTrends(timeWindowMs: number): TrendData {
		const cutoff = Date.now() - timeWindowMs
		const recent = this.interactions.filter((r) => r.timestamp >= cutoff)

		if (recent.length === 0) {
			return {
				period: `last ${Math.round(timeWindowMs / 60000)} minutes`,
				overallSuccessRate: 0,
				topStrategies: [],
				failingStrategies: [],
				topTools: [],
				failingTools: [],
			}
		}

		const overallSuccess = recent.filter((r) => r.success).length / recent.length

		// Strategy trends
		const strategyStats = new Map<string, { uses: number; successes: number }>()
		for (const r of recent) {
			const stat = strategyStats.get(r.strategy) ?? { uses: 0, successes: 0 }
			stat.uses++
			if (r.success) stat.successes++
			strategyStats.set(r.strategy, stat)
		}

		const sortedStrategies = [...strategyStats.entries()]
			.map(([strategy, stat]) => ({
				strategy,
				rate: stat.successes / stat.uses,
				uses: stat.uses,
			}))
			.filter((s) => s.uses >= 2)
			.sort((a, b) => b.rate - a.rate)

		const topStrategies = sortedStrategies.filter((s) => s.rate >= 0.7).map((s) => s.strategy)
		const failingStrategies = sortedStrategies.filter((s) => s.rate < 0.4).map((s) => s.strategy)

		// Tool trends
		const toolStats = new Map<string, { uses: number; successes: number }>()
		for (const r of recent) {
			for (const tool of r.toolsUsed) {
				const stat = toolStats.get(tool) ?? { uses: 0, successes: 0 }
				stat.uses++
				if (r.success) stat.successes++
				toolStats.set(tool, stat)
			}
		}

		const sortedTools = [...toolStats.entries()]
			.map(([tool, stat]) => ({ tool, rate: stat.successes / stat.uses, uses: stat.uses }))
			.filter((t) => t.uses >= 2)
			.sort((a, b) => b.rate - a.rate)

		const topTools = sortedTools.filter((t) => t.rate >= 0.7).map((t) => t.tool)
		const failingTools = sortedTools.filter((t) => t.rate < 0.4).map((t) => t.tool)

		return {
			period: `last ${Math.round(timeWindowMs / 60000)} minutes`,
			overallSuccessRate: overallSuccess,
			topStrategies,
			failingStrategies,
			topTools,
			failingTools,
		}
	}

	calculateOverallEffectiveness(): number {
		if (this.interactions.length === 0) return 0.5
		const now = Date.now()
		let weightedSuccesses = 0
		let weightedTotal = 0
		for (const r of this.interactions) {
			const weight = EffectivenessTracker.computeDecayWeight(r.timestamp, now)
			weightedTotal += weight
			if (r.success) weightedSuccesses += weight
		}
		return weightedTotal > 0 ? weightedSuccesses / weightedTotal : 0.5
	}

	getStrategyBreakdown(): StrategyEffectiveness[] {
		const strategies = new Set(this.interactions.map((r) => r.strategy))
		return [...strategies].map((s) => this.getStrategyEffectiveness(s))
	}

	getAllToolStats(): Map<string, ToolUsageStats> {
		const tools = new Set(this.interactions.flatMap((r) => r.toolsUsed))
		const result = new Map<string, ToolUsageStats>()
		for (const tool of tools) {
			const stats = this.getToolEffectiveness(tool)
			if (stats) result.set(tool, stats)
		}
		return result
	}

	pruneOlderThan(maxRecords: number): void {
		// First prune expired records (older than 90 days)
		this.pruneExpired()
		// Then cap total count
		if (this.interactions.length > maxRecords) {
			this.interactions = this.interactions.slice(-maxRecords)
		}
	}

	private extractTaskTypes(queries: string[]): string[] {
		const keywords: Record<string, string[]> = {
			refactoring: ['refactor', 'restructure', 'reorganize', 'clean up'],
			'bug-fixing': ['fix', 'bug', 'error', 'crash', 'broken', 'issue'],
			'feature-creation': ['add', 'create', 'implement', 'build', 'new feature'],
			testing: ['test', 'spec', 'coverage', 'unit test'],
			documentation: ['document', 'readme', 'comment', 'docs'],
			optimization: ['optimize', 'performance', 'speed', 'faster', 'efficient'],
			debugging: ['debug', 'investigate', 'trace', 'diagnose'],
			deployment: ['deploy', 'release', 'publish', 'ship'],
		}

		const typeCounts = new Map<string, number>()
		for (const query of queries) {
			const lower = query.toLowerCase()
			for (const [type, kws] of Object.entries(keywords)) {
				if (kws.some((kw) => lower.includes(kw))) {
					typeCounts.set(type, (typeCounts.get(type) ?? 0) + 1)
				}
			}
		}

		return [...typeCounts.entries()]
			.sort((a, b) => b[1] - a[1])
			.slice(0, 5)
			.map(([type]) => type)
	}
}
