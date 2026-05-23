/**
 * CortexEngine — Main orchestrator for the Deep Intelligence Amplifier.
 * Coordinates all cortex sub-modules: meta-cognition, decomposition, multi-pass
 * reasoning, cross-model verification, knowledge synthesis, and confidence calibration.
 * Supports persistent state so learning survives restarts.
 */

import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { GenerateFn } from '../reasoning/types.js'
import { calibrate } from './confidenceCalibrator.js'
import { verify } from './crossModelVerifier.js'
import { combine } from './insightCombiner.js'
import { synthesize } from './knowledgeSynthesizer.js'
import { analyzeQuery } from './metaCognition.js'
import { reason } from './multiPassReasoner.js'
import { decompose } from './queryDecomposer.js'
import type {
	ConfidenceScore,
	CortexAnalysis,
	CortexConfig,
	CortexState,
	CrossModelResult,
	DecomposedQuery,
	MetaInsight,
	QueryType,
	ReasoningPass,
	ReasoningStrategy,
	SynthesizedKnowledge,
} from './types.js'
import { CORTEX_STATE_DEFAULT, DEFAULT_CORTEX_CONFIG } from './types.js'

/** Serializable subset of CortexState for persistence (excludes recentAnalyses with full objects) */
interface PersistedCortexState {
	totalAnalyses: number
	averageConfidence: number
	averageDurationMs: number
	strategyEffectiveness: Record<string, number>
	queryTypeDistribution: Record<string, number>
	crossModelAgreementRate: number
	lastSavedAt: number
}

export class CortexEngine {
	private config: CortexConfig
	private state: CortexState
	private generateFn?: GenerateFn
	private dataDir?: string
	private analysisCount = 0
	private static readonly SAVE_INTERVAL = 10 // save every N analyses

	constructor(config?: Partial<CortexConfig>, dataDir?: string) {
		this.config = { ...DEFAULT_CORTEX_CONFIG, ...config }
		this.state = { ...CORTEX_STATE_DEFAULT }
		this.dataDir = dataDir
		if (dataDir) {
			this.load()
		}
	}

	/**
	 * Set the data directory for state persistence.
	 * Loads existing state if available.
	 */
	setDataDir(dataDir: string): void {
		this.dataDir = dataDir
		this.load()
	}

	/**
	 * Set the generate function for LLM calls. Called by orchestrator during initialization.
	 */
	setGenerateFn(fn: GenerateFn): void {
		this.generateFn = fn
	}

	/**
	 * Run full cortex analysis pipeline on a query.
	 *
	 * Pipeline:
	 * 1. Meta-cognition: analyze query type, complexity, gaps
	 * 2. Decomposition: break complex queries into sub-queries
	 * 3. Multi-pass reasoning: iterate strategies until confidence threshold
	 * 4. Cross-model verification: optional second model check
	 * 5. Knowledge synthesis: fuse RAG + Web + Graph insights
	 * 6. Confidence calibration: multi-signal scoring
	 * 7. Insight combination: produce augmented context string
	 */
	async analyze(query: string): Promise<CortexAnalysis> {
		const startTime = Date.now()

		// Step 1: Meta-cognition
		let metaInsights: MetaInsight[] = []
		if (this.config.metaCognitionEnabled) {
			try {
				metaInsights = await analyzeQuery(query)
			} catch {
				metaInsights = [
					{
						type: 'query_complexity',
						description: 'Complexity: unknown (meta-cognition failed)',
						action: 'Use default strategy',
						priority: 'low',
						confidence: 0.5,
					},
				]
			}
		}

		// Step 2: Query decomposition
		let subQueries: DecomposedQuery[] = [
			{ id: 'q_1', query, type: 'analytical' as QueryType, priority: 1, dependencies: [] },
		]
		if (this.config.queryDecompositionEnabled) {
			try {
				const decomposed = decompose(query, metaInsights)
				if (decomposed.length > 0) subQueries = decomposed
			} catch {
				// Keep default single query
			}
		}

		// Step 3: Multi-pass reasoning
		let reasoningPasses: ReasoningPass[] = []
		try {
			reasoningPasses = await reason(query, subQueries, this.config.maxPasses, this.generateFn)
		} catch {
			reasoningPasses = [
				{
					passNumber: 1,
					strategy: 'cot' as ReasoningStrategy,
					input: query,
					output: 'Reasoning unavailable',
					gaps: ['reasoning engine failed'],
					refinement: 'Fallback: no reasoning applied',
					confidenceDelta: 0.3,
					durationMs: 0,
				},
			]
		}

		// Step 4: Cross-model verification
		let crossModelResults: CrossModelResult[] = []
		const bestPass = reasoningPasses[reasoningPasses.length - 1]
		if (this.config.crossModelVerification && this.config.verificationModel) {
			try {
				const result = await verify(query, bestPass?.output ?? '', this.config.verificationModel)
				crossModelResults = [result]
			} catch {
				// Skip verification
			}
		}

		// Step 5: Knowledge synthesis
		let synthesizedKnowledge: SynthesizedKnowledge = {
			ragInsights: [],
			webInsights: [],
			graphInsights: [],
			contradictions: [],
			knowledgeGaps: [],
			combinedSummary: 'Knowledge synthesis not performed',
			depth: 0,
		}
		if (this.config.knowledgeSynthesisDepth > 0) {
			try {
				synthesizedKnowledge = await synthesize(query, this.config.knowledgeSynthesisDepth)
			} catch {
				// Keep empty synthesis
			}
		}

		// Step 6: Confidence calibration
		let confidenceScore: ConfidenceScore
		try {
			confidenceScore = calibrate(
				reasoningPasses,
				crossModelResults.length > 0 ? crossModelResults[0] : null,
				synthesizedKnowledge,
			)
		} catch {
			confidenceScore = {
				overall: 0.5,
				factual: 0.5,
				logical: 0.5,
				completeness: 0.5,
				consistency: 0.5,
				signals: [],
			}
		}

		// Step 7: Build analysis object
		const analysis: CortexAnalysis = {
			id: randomUUID(),
			originalQuery: query,
			subQueries,
			reasoningPasses,
			crossModelResults,
			synthesizedKnowledge,
			metaInsights,
			finalConfidence: confidenceScore.overall,
			augmentedContext: '', // Set below
			durationMs: Date.now() - startTime,
			timestamp: Date.now(),
		}

		// Step 8: Combine into augmented context
		analysis.augmentedContext = combine(analysis, this.config.maxTokenBudget)

		// Update state
		this.updateState(analysis)

		// Periodic persistence (every N analyses)
		this.analysisCount++
		if (this.analysisCount % CortexEngine.SAVE_INTERVAL === 0) {
			this.save()
		}

		return analysis
	}

	/**
	 * Get current cortex state (analytics).
	 */
	getState(): CortexState {
		return { ...this.state }
	}

	/**
	 * Update cortex configuration at runtime.
	 */
	updateConfig(config: Partial<CortexConfig>): void {
		this.config = { ...this.config, ...config }
	}

	/**
	 * Get current configuration.
	 */
	getConfig(): CortexConfig {
		return { ...this.config }
	}

	/**
	 * Get the data directory for persistence (if set).
	 */
	getDataDir(): string | undefined {
		return this.dataDir
	}

	/**
	 * Record the outcome of a query that used cortex analysis.
	 * This feeds back into the confidence calibrator so it learns
	 * which query types benefit most from deep analysis.
	 */
	recordOutcome(_query: string, success: boolean, _durationMs: number): void {
		// Update strategy effectiveness based on outcome
		if (this.state.recentAnalyses.length > 0) {
			const lastAnalysis = this.state.recentAnalyses[this.state.recentAnalyses.length - 1]
			if (lastAnalysis) {
				const multiplier = success ? 1.05 : 0.95
				for (const pass of lastAnalysis.reasoningPasses) {
					const current = this.state.strategyEffectiveness[pass.strategy] ?? 0.5
					this.state.strategyEffectiveness[pass.strategy] = Math.min(1, current * multiplier)
				}
			}
		}
	}

	// ─── Persistence ────────────────────────────────────────────────

	/**
	 * Save cortex state to disk. Persists strategy effectiveness,
	 * query type distribution, confidence averages, and agreement rates.
	 * Recent analyses are NOT persisted (too large, transient).
	 */
	save(): void {
		if (!this.dataDir) return

		try {
			const dir = join(this.dataDir, 'cortex')
			if (!existsSync(dir)) {
				mkdirSync(dir, { recursive: true })
			}

			const persisted: PersistedCortexState = {
				totalAnalyses: this.state.totalAnalyses,
				averageConfidence: this.state.averageConfidence,
				averageDurationMs: this.state.averageDurationMs,
				strategyEffectiveness: { ...this.state.strategyEffectiveness },
				queryTypeDistribution: { ...this.state.queryTypeDistribution },
				crossModelAgreementRate: this.state.crossModelAgreementRate,
				lastSavedAt: Date.now(),
			}

			writeFileSync(join(dir, 'state.json'), JSON.stringify(persisted, null, 2), 'utf-8')
		} catch {
			// Non-critical: state will accumulate fresh in memory
		}
	}

	/**
	 * Load cortex state from disk. Restores strategy effectiveness
	 * and historical metrics so learning persists across restarts.
	 */
	private load(): void {
		if (!this.dataDir) return

		try {
			const filePath = join(this.dataDir, 'cortex', 'state.json')
			if (!existsSync(filePath)) return

			const raw = readFileSync(filePath, 'utf-8')
			const persisted: PersistedCortexState = JSON.parse(raw)

			this.state.totalAnalyses = persisted.totalAnalyses
			this.state.averageConfidence = persisted.averageConfidence
			this.state.averageDurationMs = persisted.averageDurationMs
			this.state.crossModelAgreementRate = persisted.crossModelAgreementRate

			// Restore strategy effectiveness (merge with defaults for any missing strategies)
			for (const strategy of Object.keys(
				CORTEX_STATE_DEFAULT.strategyEffectiveness,
			) as ReasoningStrategy[]) {
				this.state.strategyEffectiveness[strategy] =
					persisted.strategyEffectiveness[strategy] ?? 0.5
			}

			// Restore query type distribution (merge with defaults)
			for (const qt of Object.keys(CORTEX_STATE_DEFAULT.queryTypeDistribution) as QueryType[]) {
				this.state.queryTypeDistribution[qt] = persisted.queryTypeDistribution[qt] ?? 0
			}
		} catch {
			// Corrupted state — start fresh with defaults
		}
	}

	// ─── Staleness Detection ───────────────────────────────────────

	/**
	 * Get a staleness report for the cortex system.
	 * Measures how "stale" the learned state is based on time since last analysis,
	 * volume of recent interactions, and strategy effectiveness variance.
	 *
	 * @returns Object with staleness scores per dimension and overall staleness 0-1
	 */
	getStalenessReport(): {
		overall: number
		dataFreshness: number
		strategyDiversity: number
		lastAnalysisAgeMs: number
		recommendation: string
	} {
		const now = Date.now()

		// Data freshness: how recently was the last analysis
		const lastAnalysis = this.state.recentAnalyses[this.state.recentAnalyses.length - 1]
		const lastAnalysisAgeMs = lastAnalysis ? now - lastAnalysis.timestamp : Infinity
		// Stale if > 24 hours since last analysis
		const dataFreshness = lastAnalysis
			? Math.max(0, 1 - lastAnalysisAgeMs / (24 * 60 * 60 * 1000))
			: 0

		// Strategy diversity: how many strategies have been used with decent effectiveness
		const effectValues = Object.values(this.state.strategyEffectiveness)
		const activeStrategies = effectValues.filter((v) => v > 0.3 && v < 0.9).length
		const strategyDiversity = activeStrategies / Math.max(1, effectValues.length)

		// Overall staleness: higher = more stale
		const overall = 1 - (dataFreshness * 0.6 + strategyDiversity * 0.4)

		let recommendation: string
		if (overall > 0.8) {
			recommendation = 'Cortex state is very stale. Run more queries to refresh learning.'
		} else if (overall > 0.5) {
			recommendation = 'Cortex state is moderately stale. Consider evolving prompts.'
		} else {
			recommendation = 'Cortex state is fresh. System is learning actively.'
		}

		return { overall, dataFreshness, strategyDiversity, lastAnalysisAgeMs, recommendation }
	}

	/**
	 * Update internal state with results from an analysis.
	 */
	private updateState(analysis: CortexAnalysis): void {
		this.state.totalAnalyses++

		// Running average confidence
		const prevTotal = this.state.averageConfidence * (this.state.totalAnalyses - 1)
		this.state.averageConfidence = (prevTotal + analysis.finalConfidence) / this.state.totalAnalyses

		// Running average duration
		const prevDurTotal = this.state.averageDurationMs * (this.state.totalAnalyses - 1)
		this.state.averageDurationMs = (prevDurTotal + analysis.durationMs) / this.state.totalAnalyses

		// Strategy effectiveness
		for (const pass of analysis.reasoningPasses) {
			const prev = this.state.strategyEffectiveness[pass.strategy] ?? 0.5
			this.state.strategyEffectiveness[pass.strategy] = prev * 0.9 + pass.confidenceDelta * 0.1
		}

		// Query type distribution
		for (const sq of analysis.subQueries) {
			this.state.queryTypeDistribution[sq.type] =
				(this.state.queryTypeDistribution[sq.type] ?? 0) + 1
		}

		// Cross-model agreement rate
		if (analysis.crossModelResults.length > 0) {
			const agreement = analysis.crossModelResults[0].agreementWithPrimary
			this.state.crossModelAgreementRate =
				this.state.crossModelAgreementRate * 0.9 + agreement * 0.1
		}

		// Recent analyses (keep last 100)
		this.state.recentAnalyses.push(analysis)
		if (this.state.recentAnalyses.length > 100) {
			this.state.recentAnalyses = this.state.recentAnalyses.slice(-100)
		}
	}
}
