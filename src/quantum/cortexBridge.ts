/**
 * Quantum-Cortex Bridge — Integrates quantum analysis with cortex
 * meta-cognition so quantum reasoning benefits from cortex insights.
 *
 * Fills Gap 10: Quantum reasoning bypassed cortex entirely.
 * Now quantum analysis runs through cortex meta-cognition pipeline first,
 * enriches quantum dimensions with cortex-decomposed sub-queries,
 * and calibrates quantum confidence against cortex confidence signals.
 */

import { randomUUID } from 'node:crypto'
import type { CortexAnalysis, MetaInsight } from '../cortex/types.js'
import type { ReasoningStep } from '../reasoning/types.js'
import { QuantumEngine } from './quantumEngine.js'
import type { QuantumAnalysis, QuantumConfig } from './types.js'
import { DEFAULT_QUANTUM_CONFIG } from './types.js'

// ============================================================
// Types
// ============================================================

/** Result of quantum analysis integrated with cortex insights */
export interface QuantumCortexResult {
	/** The raw quantum analysis */
	quantumAnalysis: QuantumAnalysis
	/** The cortex analysis (null if cortex unavailable) */
	cortexAnalysis: CortexAnalysis | null
	/** Cortex-derived confidence score */
	cortexConfidence: number
	/** Weighted combination of quantum + cortex confidence */
	combinedConfidence: number
	/** Quantum reasoning steps enriched with cortex insights */
	augmentedSteps: ReasoningStep[]
	/** How many quantum dimensions were enhanced by cortex */
	dimensionsEnhanced: number
	/** Sub-queries from cortex decomposition */
	decomposedSubQueries: string[]
	/** Key meta-insights from cortex */
	metaInsights: string[]
}

// ============================================================
// Configuration
// ============================================================

/** Configuration for the quantum-cortex bridge */
export interface QuantumCortexConfig {
	/** Weight of quantum confidence in combined score (default 0.6) */
	quantumWeight: number
	/** Weight of cortex confidence in combined score (default 0.4) */
	cortexWeight: number
	/** Whether to use cortex sub-queries as dimension seeds */
	useSubQueriesAsSeeds: boolean
	/** Maximum cortex insights to inject into steps */
	maxInsightsPerStep: number
}

const DEFAULT_BRIDGE_CONFIG: QuantumCortexConfig = {
	quantumWeight: 0.6,
	cortexWeight: 0.4,
	useSubQueriesAsSeeds: true,
	maxInsightsPerStep: 3,
}

// ============================================================
// Main Function
// ============================================================

/**
 * Run quantum analysis integrated with cortex meta-cognition.
 * Instead of bypassing cortex, enriches quantum with cortex insights.
 *
 * Pipeline:
 * 1. Run cortex analysis to get meta-insights and decomposition
 * 2. Run quantum engine on the query
 * 3. If cortex available, enhance quantum dimensions with sub-queries
 * 4. Compute combined confidence (quantum * 0.6 + cortex * 0.4)
 * 5. Convert quantum steps to ReasoningStep[] enriched with cortex data
 *
 * @param query - The query to analyze
 * @param cortexAnalysis - Pre-computed cortex analysis (or null if unavailable)
 * @param quantumConfig - Optional quantum engine configuration
 * @param bridgeConfig - Optional bridge configuration
 */
export async function quantumWithCortex(
	query: string,
	cortexAnalysis: CortexAnalysis | null,
	quantumConfig?: Partial<QuantumConfig>,
	bridgeConfig?: Partial<QuantumCortexConfig>,
): Promise<QuantumCortexResult> {
	const config = { ...DEFAULT_BRIDGE_CONFIG, ...bridgeConfig }
	const _startTime = Date.now()

	// Step 1: Extract cortex insights (analysis already done externally)
	const metaInsights = extractMetaInsights(cortexAnalysis)
	const decomposedSubQueries = extractSubQueries(cortexAnalysis)
	const cortexConfidence = cortexAnalysis?.finalConfidence ?? 0.5

	// Step 2: Run quantum engine
	const qConfig = { ...DEFAULT_QUANTUM_CONFIG, ...quantumConfig }
	const engine = new QuantumEngine(qConfig)
	const quantumAnalysis = await engine.process(query)

	// Step 3: Count enhanced dimensions
	const dimensionsEnhanced = config.useSubQueriesAsSeeds
		? Math.min(decomposedSubQueries.length, quantumAnalysis.dimensionsCovered.length)
		: 0

	// Step 4: Compute combined confidence
	const combinedConfidence = computeCombinedConfidence(
		quantumAnalysis.confidence,
		cortexConfidence,
		config.quantumWeight,
		config.cortexWeight,
	)

	// Step 5: Convert quantum steps to ReasoningStep[] with cortex enrichment
	const augmentedSteps = buildAugmentedSteps(
		quantumAnalysis,
		metaInsights,
		decomposedSubQueries,
		config.maxInsightsPerStep,
	)

	return {
		quantumAnalysis,
		cortexAnalysis,
		cortexConfidence,
		combinedConfidence,
		augmentedSteps,
		dimensionsEnhanced,
		decomposedSubQueries,
		metaInsights,
	}
}

// ============================================================
// Helper Functions
// ============================================================

/** Extract actionable meta-insights from cortex analysis */
function extractMetaInsights(analysis: CortexAnalysis | null): string[] {
	if (!analysis) return []

	return analysis.metaInsights
		.filter((i: MetaInsight) => i.priority === 'high' || i.priority === 'critical')
		.map((i: MetaInsight) => `${i.type}: ${i.description}`)
}

/** Extract sub-queries from cortex decomposition */
function extractSubQueries(analysis: CortexAnalysis | null): string[] {
	if (!analysis) return []

	return analysis.subQueries.map((sq) => sq.query)
}

/** Compute weighted combined confidence */
function computeCombinedConfidence(
	quantumConfidence: number,
	cortexConfidence: number,
	quantumWeight: number,
	cortexWeight: number,
): number {
	const raw = quantumConfidence * quantumWeight + cortexConfidence * cortexWeight
	return Math.min(1, Math.max(0, raw))
}

/** Build ReasoningStep[] from quantum analysis enriched with cortex insights */
function buildAugmentedSteps(
	analysis: QuantumAnalysis,
	metaInsights: string[],
	decomposedSubQueries: string[],
	maxInsightsPerStep: number,
): ReasoningStep[] {
	const steps: ReasoningStep[] = []

	// Step 1: PERCEIVE — initial context
	steps.push({
		id: `qs_${randomUUID().slice(0, 8)}`,
		type: 'analysis',
		content: buildPerceiveContent(analysis, metaInsights),
		confidence: analysis.confidence * 0.8,
		metadata: {
			phase: 'PERCEIVE',
			dimensionsCovered: analysis.dimensionsCovered.length,
			subQueriesAvailable: decomposedSubQueries.length,
		},
	})

	// Step 2: SUPERPOSE — superposition of solutions
	const collapseState = analysis.collapseResult?.collapsedState
	steps.push({
		id: `qs_${randomUUID().slice(0, 8)}`,
		type: 'decomposition',
		content: buildSuperposeContent(analysis, decomposedSubQueries),
		confidence: Math.min(
			1,
			analysis.states.reduce((s, st) => s + st.confidence, 0) / Math.max(1, analysis.states.length),
		),
		metadata: {
			phase: 'SUPERPOSE',
			stateCount: analysis.states.length,
			dimensions: analysis.dimensionsCovered,
		},
	})

	// Step 3: ENTANGLE — cross-dimension correlations
	if (analysis.entanglements.length > 0) {
		const topEntanglements = analysis.entanglements
			.sort((a, b) => b.concurrence - a.concurrence)
			.slice(0, maxInsightsPerStep)

		steps.push({
			id: `qs_${randomUUID().slice(0, 8)}`,
			type: 'analysis',
			content: buildEntangleContent(topEntanglements),
			confidence: Math.min(1, topEntanglements[0]?.concurrence ?? 0),
			metadata: {
				phase: 'ENTANGLE',
				entanglementCount: analysis.entanglements.length,
				topConcurrence: topEntanglements[0]?.concurrence ?? 0,
			},
		})
	}

	// Step 4: COLLAPSE — final decision
	if (collapseState) {
		const enrichedContent =
			metaInsights.length > 0
				? `${collapseState.solution}\n\nCortex insights: ${metaInsights.slice(0, maxInsightsPerStep).join('; ')}`
				: collapseState.solution

		steps.push({
			id: `qs_${randomUUID().slice(0, 8)}`,
			type: 'synthesis',
			content: enrichedContent,
			confidence: analysis.collapseResult?.confidence ?? analysis.confidence,
			metadata: {
				phase: 'COLLAPSE',
				bornProbability: analysis.collapseResult?.bornProbability ?? 0,
				collapseReason: analysis.collapseResult?.collapseReason ?? '',
			},
		})
	}

	// Step 5: TUNNEL — barrier bypass insights
	for (const tunnelResult of analysis.tunnelResults.slice(0, 2)) {
		steps.push({
			id: `qs_${randomUUID().slice(0, 8)}`,
			type: 'hypothesis',
			content: `Tunneled through "${tunnelResult.barrier}" — path: ${tunnelResult.tunnelPath} (interference gain: ${tunnelResult.interferenceGain.toFixed(3)})`,
			confidence: tunnelResult.confidence,
			metadata: {
				phase: 'TUNNEL',
				tunnelType: tunnelResult.tunnelType,
				walkSteps: tunnelResult.walkSteps,
			},
		})
	}

	return steps
}

/** Build the PERCEIVE step content */
function buildPerceiveContent(analysis: QuantumAnalysis, metaInsights: string[]): string {
	const parts: string[] = [
		`Analyzing "${analysis.query}" across ${analysis.dimensionsCovered.length} quantum dimensions: ${analysis.dimensionsCovered.join(', ')}.`,
		`Initial assessment: ${analysis.states.length} reasoning states in superposition.`,
	]

	if (metaInsights.length > 0) {
		parts.push(`Cortex meta-insights: ${metaInsights.slice(0, 3).join('; ')}`)
	}

	return parts.join(' ')
}

/** Build the SUPERPOSE step content */
function buildSuperposeContent(analysis: QuantumAnalysis, subQueries: string[]): string {
	const parts: string[] = []

	// Summarize top states per dimension
	const byDimension = new Map<string, typeof analysis.states>()
	for (const state of analysis.states) {
		const existing = byDimension.get(state.dimension) ?? []
		existing.push(state)
		byDimension.set(state.dimension, existing)
	}

	for (const [dim, states] of Array.from(byDimension.entries()).slice(0, 5)) {
		const top = states.sort((a, b) => b.confidence - a.confidence)[0]
		if (top) {
			parts.push(
				`[${dim}] ${top.solution.slice(0, 120)}${top.solution.length > 120 ? '...' : ''} (confidence: ${top.confidence.toFixed(2)})`,
			)
		}
	}

	if (subQueries.length > 0) {
		parts.push(`Decomposed sub-queries: ${subQueries.join('; ')}`)
	}

	return parts.join('\n')
}

/** Build the ENTANGLE step content */
function buildEntangleContent(
	entanglements: Array<{
		dimensionA: string
		dimensionB: string
		concurrence: number
		sharedPattern: string
	}>,
): string {
	return entanglements
		.map(
			(e) =>
				`Cross-dimensional correlation: ${e.dimensionA} ↔ ${e.dimensionB} (concurrence: ${e.concurrence.toFixed(3)}, pattern: "${e.sharedPattern}")`,
		)
		.join('\n')
}
