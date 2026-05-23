import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { EffectivenessTracker } from './effectivenessTracker.js'
import { PatternLearner } from './patternLearner.js'
import { PromptEvolver } from './promptEvolver.js'
import { ToolOptimizer } from './toolOptimizer.js'
import type {
	EvolutionConfig,
	EvolutionReport,
	InteractionRecord,
	Pattern,
	PromptEvolution,
	ToolRecommendation,
	ToolUsageStats,
} from './types.js'

const DEFAULT_CONFIG: EvolutionConfig = {
	maxInteractions: 5000,
	minSampleSize: 3,
	evolutionIntervalMs: 30 * 60 * 1000, // 30 minutes
	maxPatterns: 50,
	dataDir: '',
}

interface SerializedState {
	interactions: InteractionRecord[]
	patterns: Pattern[]
	promptEvolutions: [string, PromptEvolution][]
	toolStats: [string, ToolUsageStats][]
	lastEvolutionTimestamp: number
	evolutionCount: number
}

export class EvolutionEngine {
	private config: EvolutionConfig
	private tracker: EffectivenessTracker
	private learner: PatternLearner
	private optimizer: ToolOptimizer
	private evolver: PromptEvolver
	private lastEvolutionTimestamp = 0
	private evolutionCount = 0
	private dirty = false
	/** Track last evolution time per section to prevent thrashing */
	private sectionLastEvolved = new Map<string, number>()
	/** Minimum interval between auto-evolutions of the same section (1 hour) */
	private static readonly MIN_SECTION_EVOLUTION_INTERVAL_MS = 60 * 60 * 1000
	/** Success rate threshold below which a section is considered underperforming */
	private static readonly UNDERPERFORMING_THRESHOLD = 0.4
	/** Minimum interactions needed before auto-evolving */
	private static readonly MIN_INTERACTIONS_FOR_AUTO_EVOLVE = 20

	private constructor(config: EvolutionConfig) {
		this.config = config
		this.tracker = new EffectivenessTracker()
		this.learner = new PatternLearner()
		this.optimizer = new ToolOptimizer()
		this.evolver = new PromptEvolver()
	}

	static async init(dataDir?: string): Promise<EvolutionEngine> {
		const dir = dataDir ?? ''
		const config = { ...DEFAULT_CONFIG, dataDir: dir }
		const engine = new EvolutionEngine(config)

		if (dir) {
			await engine.load()
		}

		return engine
	}

	trackInteraction(record: Omit<InteractionRecord, 'id'>): InteractionRecord {
		const full: InteractionRecord = {
			...record,
			id: randomUUID(),
		}

		this.tracker.recordInteraction(full)
		this.tracker.pruneOlderThan(this.config.maxInteractions)
		this.dirty = true

		return full
	}

	async evolve(): Promise<{
		patternsLearned: number
		promptEvolutions: number
		toolInsights: string[]
	}> {
		const interactions = this.tracker.getInteractions()

		// Learn patterns
		const newPatterns = this.learner.updatePatterns(interactions)

		// Update tool optimizer data
		this.optimizer.setInteractions(interactions)

		// Analyze tool combinations
		const comboResults = this.optimizer.analyzeToolCombinations()
		const toolInsights: string[] = []
		for (const [combo, data] of comboResults) {
			if (data.rate >= 0.8 && data.uses >= 3) {
				toolInsights.push(
					`Strong combination: ${combo} (${(data.rate * 100).toFixed(0)}% success, ${data.uses} uses)`,
				)
			}
		}

		// Identify underperforming tools
		const underperformers = this.optimizer.identifyUnderperformingTools()
		for (const { tool, successRate, uses } of underperformers) {
			toolInsights.push(
				`Underperforming: ${tool} (${(successRate * 100).toFixed(0)}% success, ${uses} uses)`,
			)
		}

		// Evolve prompts (only for sections that have enough data)
		let promptEvolutionCount = 0
		if (interactions.length >= 10) {
			// Auto-evolve underperforming sections
			const autoEvolutions = this.autoEvolveUnderperformingSections(interactions)
			promptEvolutionCount = this.evolver.getEvolutions().length + autoEvolutions
		} else {
			promptEvolutionCount = this.evolver.getEvolutions().length
		}

		this.lastEvolutionTimestamp = Date.now()
		this.evolutionCount++
		this.dirty = true

		return {
			patternsLearned: newPatterns.length,
			promptEvolutions: promptEvolutionCount,
			toolInsights,
		}
	}

	getRecommendations(query: string): {
		strategy: string | null
		tools: ToolRecommendation[]
		pattern: Pattern | null
	} {
		const pattern = this.learner.matchPattern(query)
		const tools = this.optimizer.recommendToolsForTask(query)

		let strategy: string | null = null
		if (pattern) {
			strategy = pattern.recommendedStrategy
		}

		// Also consider recent trends
		const trends = this.tracker.getRecentTrends(24 * 60 * 60 * 1000) // last 24h
		if (!strategy && trends.topStrategies.length > 0) {
			strategy = trends.topStrategies[0]!
		}

		return { strategy, tools, pattern }
	}

	getEvolutionReport(): EvolutionReport {
		const interactions = this.tracker.getInteractions()
		const patterns = this.learner.getPatterns()
		const evolutions = this.evolver.getEvolutions()
		const _trends = this.tracker.getRecentTrends(24 * 60 * 60 * 1000)

		const toolInsights: string[] = []
		const underperformers = this.optimizer.identifyUnderperformingTools()
		for (const { tool, successRate } of underperformers) {
			toolInsights.push(`${tool}: ${(successRate * 100).toFixed(0)}% success rate`)
		}

		const comboResults = this.optimizer.analyzeToolCombinations()
		const topCombos = [...comboResults.entries()]
			.sort((a, b) => b[1].rate * b[1].uses - a[1].rate * a[1].uses)
			.slice(0, 3)
		for (const [combo, data] of topCombos) {
			toolInsights.push(`${combo}: ${(data.rate * 100).toFixed(0)}% (${data.uses} uses)`)
		}

		return {
			totalInteractions: interactions.length,
			overallSuccessRate: this.tracker.calculateOverallEffectiveness(),
			patternsLearned: patterns.length,
			promptEvolutions: evolutions.length,
			topPatterns: patterns.slice(0, 5),
			toolInsights,
			evolutionCount: this.evolutionCount,
			lastEvolution: this.lastEvolutionTimestamp,
		}
	}

	evolvePrompt(sectionName: string, currentPrompt: string): string {
		const interactions = this.tracker.getInteractions()
		return this.evolver.evolvePrompt(sectionName, currentPrompt, interactions)
	}

	getEvolvedPrompt(sectionName: string): string | null {
		return this.evolver.getEvolvedPrompt(sectionName)
	}

	// Persistence
	async save(): Promise<void> {
		if (!this.config.dataDir) return

		const dir = join(this.config.dataDir, 'evolution')
		if (!existsSync(dir)) {
			mkdirSync(dir, { recursive: true })
		}

		const interactions = this.tracker.getInteractions()
		const patterns = this.learner.getPatterns()
		const evolutions = this.evolver.getEvolutions()
		const toolStats = this.tracker.getAllToolStats()

		const state: SerializedState = {
			interactions,
			patterns,
			promptEvolutions: evolutions.map((e) => [e.sectionName, e] as [string, PromptEvolution]),
			toolStats: [...toolStats.entries()],
			lastEvolutionTimestamp: this.lastEvolutionTimestamp,
			evolutionCount: this.evolutionCount,
		}

		const filePath = join(dir, 'state.json')
		writeFileSync(filePath, JSON.stringify(state), 'utf-8')
		this.dirty = false
	}

	async load(): Promise<void> {
		if (!this.config.dataDir) return

		const filePath = join(this.config.dataDir, 'evolution', 'state.json')
		if (!existsSync(filePath)) return

		try {
			const raw = readFileSync(filePath, 'utf-8')
			const state: SerializedState = JSON.parse(raw)

			// Restore tracker
			this.tracker = new EffectivenessTracker(state.interactions)

			// Restore learner
			this.learner = new PatternLearner(state.patterns)

			// Restore optimizer
			this.optimizer = new ToolOptimizer(state.interactions)

			// Restore evolver
			const evolutions = state.promptEvolutions.map(([, evo]) => evo)
			this.evolver = new PromptEvolver(evolutions)

			this.lastEvolutionTimestamp = state.lastEvolutionTimestamp
			this.evolutionCount = state.evolutionCount
			this.dirty = false
		} catch {
			// Corrupted state — start fresh
		}
	}

	isDirty(): boolean {
		return this.dirty
	}

	getTracker(): EffectivenessTracker {
		return this.tracker
	}

	getLearner(): PatternLearner {
		return this.learner
	}

	getOptimizer(): ToolOptimizer {
		return this.optimizer
	}

	getEvolverInstance(): PromptEvolver {
		return this.evolver
	}

	// ─── Auto-Evolution ────────────────────────────────────────────

	/**
	 * Identify and auto-evolve prompt sections that are underperforming.
	 * Uses interaction success rates correlated with section keywords.
	 * Returns the number of sections that were evolved.
	 */
	private autoEvolveUnderperformingSections(interactions: InteractionRecord[]): number {
		if (interactions.length < EvolutionEngine.MIN_INTERACTIONS_FOR_AUTO_EVOLVE) return 0

		const now = Date.now()
		const evolved: string[] = []
		const evolutions = this.evolver.getEvolutions()

		// Get known section names from existing evolutions
		const sectionNames = new Set(evolutions.map((e) => e.sectionName))
		if (sectionNames.size === 0) return 0

		for (const sectionName of sectionNames) {
			// Rate-limit: don't evolve the same section more than once per hour
			const lastEvolved = this.sectionLastEvolved.get(sectionName) ?? 0
			if (now - lastEvolved < EvolutionEngine.MIN_SECTION_EVOLUTION_INTERVAL_MS) continue

			// Compute recent success rate for interactions matching this section's domain
			const sectionEvolutions = evolutions.filter((e) => e.sectionName === sectionName)
			const latestEvolution = sectionEvolutions.reduce(
				(a, b) => (a.generation > b.generation ? a : b),
				sectionEvolutions[0]!,
			)

			// Extract keywords from the evolved prompt to match interactions
			const promptWords = latestEvolution.evolvedPrompt
				.toLowerCase()
				.split(/\s+/)
				.filter((w) => w.length > 4)

			// Find recent interactions (last 24h) related to this section
			const oneDayAgo = now - 24 * 60 * 60 * 1000
			const recentRelated = interactions.filter((r) => {
				if (r.timestamp < oneDayAgo) return false
				const queryLower = r.query.toLowerCase()
				return promptWords.some((w) => queryLower.includes(w))
			})

			if (recentRelated.length < 5) continue

			const recentSuccessRate = recentRelated.filter((r) => r.success).length / recentRelated.length

			// Auto-evolve if underperforming
			if (recentSuccessRate < EvolutionEngine.UNDERPERFORMING_THRESHOLD) {
				try {
					this.evolver.evolvePrompt(sectionName, latestEvolution.evolvedPrompt, interactions)
					this.sectionLastEvolved.set(sectionName, now)
					evolved.push(sectionName)
				} catch {
					// Evolution failed — skip this section
				}
			}
		}

		if (evolved.length > 0) {
			this.dirty = true
		}

		return evolved.length
	}

	/**
	 * Get a staleness report for all tracked prompt sections.
	 * Measures time since last evolution and interaction volume.
	 */
	getStalenessReport(): Array<{
		section: string
		lastEvolvedAgeMs: number
		generation: number
		staleness: number
		recommendation: string
	}> {
		const now = Date.now()
		const evolutions = this.evolver.getEvolutions()

		// Group by section
		const bySection = new Map<string, typeof evolutions>()
		for (const evo of evolutions) {
			const list = bySection.get(evo.sectionName) ?? []
			list.push(evo)
			bySection.set(evo.sectionName, list)
		}

		const report: Array<{
			section: string
			lastEvolvedAgeMs: number
			generation: number
			staleness: number
			recommendation: string
		}> = []

		for (const [section, sectionEvos] of bySection) {
			const latest = sectionEvos.reduce((a, b) => (a.generation > b.generation ? a : b))
			const ageMs = now - latest.timestamp
			// Staleness: 0 = fresh, 1 = very stale (half-life 3 days)
			const staleness = Math.min(1, 1 - 0.5 ** (ageMs / (3 * 24 * 60 * 60 * 1000)))

			let recommendation: string
			if (staleness > 0.8) {
				recommendation = 'Very stale. Consider running evolvePrompt() for this section.'
			} else if (staleness > 0.5) {
				recommendation = 'Moderately stale. Monitor performance and evolve if declining.'
			} else {
				recommendation = 'Fresh. No action needed.'
			}

			report.push({
				section,
				lastEvolvedAgeMs: ageMs,
				generation: latest.generation,
				staleness,
				recommendation,
			})
		}

		return report.sort((a, b) => b.staleness - a.staleness)
	}
}

// Convenience singleton for global use
let _instance: EvolutionEngine | null = null

export async function getEvolutionEngine(dataDir?: string): Promise<EvolutionEngine> {
	if (!_instance) {
		_instance = await EvolutionEngine.init(dataDir)
	}
	return _instance
}

export function resetEvolutionEngine(): void {
	_instance = null
}
