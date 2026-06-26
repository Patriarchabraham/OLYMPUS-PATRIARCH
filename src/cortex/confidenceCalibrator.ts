/**
 * ConfidenceCalibrator — Multi-signal confidence scoring across reasoning layers.
 * v2: Adds Bayesian calibration bias (EMA-based), Dempster-Shafer evidence fusion,
 * and Expected Calibration Error (ECE) tracking.
 * Pure calculation, no LLM calls.
 */

import type {
	ConfidenceScore,
	ConfidenceSignal,
	CrossModelResult,
	ReasoningPass,
	SynthesizedKnowledge,
} from './types.js'

// ─── Bayesian calibration state (module-level) ──────────────────────────────

/** Exponential moving average bias learned from prediction→outcome pairs. */
let calibrationBias = 0 // positive = model is underconfident, negative = overconfident
const EMA_ALPHA = 0.1 // smoothing factor for bias updates
/** Bins for Expected Calibration Error tracking. */
const eceBins = new Map<number, { predicted: number; actual: number; count: number }>()

/**
 * Record a calibration outcome: the model predicted `predicted` confidence,
 * and the actual outcome was `actual` (1 = correct, 0 = wrong).
 * Updates the Bayesian calibration bias so future scores are more accurate.
 */
export function recordCalibrationOutcome(predicted: number, actual: number): void {
	const error = actual - predicted // positive if underconfident
	calibrationBias = calibrationBias * (1 - EMA_ALPHA) + error * EMA_ALPHA

	// Update ECE bins (10 bins from 0.0-0.1 to 0.9-1.0)
	const binKey = Math.min(9, Math.floor(predicted * 10))
	const bin = eceBins.get(binKey) ?? { predicted: 0, actual: 0, count: 0 }
	bin.predicted += predicted
	bin.actual += actual
	bin.count++
	eceBins.set(binKey, bin)
}

/** Get the Expected Calibration Error (lower = better calibrated). */
export function getECE(): number {
	let ece = 0
	let totalCount = 0
	for (const bin of eceBins.values()) {
		if (bin.count === 0) continue
		const avgPredicted = bin.predicted / bin.count
		const avgActual = bin.actual / bin.count
		ece += bin.count * Math.abs(avgPredicted - avgActual)
		totalCount += bin.count
	}
	return totalCount > 0 ? ece / totalCount : 0
}

/** Reset calibration state (for testing). */
export function resetCalibration(): void {
	calibrationBias = 0
	eceBins.clear()
}

/**
 * Calibrate overall confidence based on all reasoning outputs.
 */
export function calibrate(
	passes: ReasoningPass[],
	crossModel: CrossModelResult | null,
	knowledge: SynthesizedKnowledge,
): ConfidenceScore {
	const signals: ConfidenceSignal[] = []

	// Signal 1: Reasoning consistency (do passes converge?)
	const consistency = computeConsistency(passes)
	signals.push({
		name: 'reasoning_consistency',
		weight: 0.25,
		value: consistency,
		description: `Passes ${passes.length > 1 ? 'converge' : 'single-pass'} with consistency ${consistency.toFixed(2)}`,
	})

	// Signal 2: Cross-model agreement
	const crossModelValue = crossModel ? crossModel.agreementWithPrimary : 0.7 // neutral if not run
	signals.push({
		name: 'cross_model_agreement',
		weight: 0.2,
		value: crossModelValue,
		description: crossModel
			? `${crossModel.modelName} agreement: ${crossModel.agreementWithPrimary.toFixed(2)}`
			: 'Cross-model verification not performed',
	})

	// Signal 3: Knowledge coverage
	const coverage = computeCoverage(knowledge)
	signals.push({
		name: 'knowledge_coverage',
		weight: 0.2,
		value: coverage,
		description: `${countInsights(knowledge)} insights from knowledge sources, ${knowledge.knowledgeGaps.length} gaps`,
	})

	// Signal 4: Gap count (fewer gaps = higher confidence)
	const gapScore = computeGapScore(passes, knowledge)
	signals.push({
		name: 'gap_score',
		weight: 0.15,
		value: gapScore,
		description: `Total gaps: ${totalGaps(passes, knowledge)}`,
	})

	// Signal 5: Pass improvement trend
	const trend = computeTrend(passes)
	signals.push({
		name: 'improvement_trend',
		weight: 0.1,
		value: trend,
		description:
			passes.length > 1
				? `Confidence ${passes.length > 1 ? 'improved' : 'stable'} across ${passes.length} passes`
				: 'Single pass performed',
	})

	// Signal 6: Output depth
	const depth = computeDepth(passes)
	signals.push({
		name: 'output_depth',
		weight: 0.1,
		value: depth,
		description: `Average output length: ${avgOutputLength(passes)} chars`,
	})

	// Compute weighted overall score
	const rawOverall = signals.reduce((sum, s) => sum + s.value * s.weight, 0)

	// Apply Bayesian calibration bias (learned from past outcomes)
	const calibratedOverall = clamp(rawOverall + calibrationBias)

	// Signal 7: Dempster-Shafer evidence fusion
	const dsFusion = dempsterShaferFusion(signals)
	signals.push({
		name: 'evidence_fusion',
		weight: 0, // informational only, doesn't affect overall
		value: dsFusion,
		description: `Dempster-Shafer belief mass: ${dsFusion.toFixed(3)} (conflict-adjusted)`,
	})

	return {
		overall: calibratedOverall,
		factual: clamp(consistency * 0.6 + crossModelValue * 0.4 + calibrationBias * 0.5),
		logical: clamp(consistency * 0.7 + trend * 0.3 + calibrationBias * 0.3),
		completeness: clamp(coverage * 0.5 + gapScore * 0.5),
		consistency: clamp(consistency),
		signals,
	}
}

/**
 * Compute reasoning consistency across passes.
 * Higher if later passes have higher confidence deltas.
 */
function computeConsistency(passes: ReasoningPass[]): number {
	if (passes.length === 0) return 0.3
	if (passes.length === 1) return passes[0].confidenceDelta

	// Check if confidence improves across passes
	let improving = 0
	for (let i = 1; i < passes.length; i++) {
		if (passes[i].confidenceDelta >= passes[i - 1].confidenceDelta) {
			improving++
		}
	}

	const trendRatio = improving / (passes.length - 1)
	const avgConfidence = passes.reduce((sum, p) => sum + p.confidenceDelta, 0) / passes.length

	return trendRatio * 0.4 + avgConfidence * 0.6
}

/**
 * Compute knowledge coverage score.
 */
function computeCoverage(knowledge: SynthesizedKnowledge): number {
	const totalInsights = countInsights(knowledge)
	if (totalInsights === 0) return 0.3

	// More insights = better, but diminishing returns
	const insightScore = Math.min(totalInsights / 10, 1) * 0.6
	const contradictionPenalty = Math.min(knowledge.contradictions.length * 0.1, 0.3)
	const gapPenalty = Math.min(knowledge.knowledgeGaps.length * 0.1, 0.3)

	return clamp(insightScore - contradictionPenalty + (1 - gapPenalty) * 0.4)
}

/**
 * Compute gap score — fewer gaps means higher score.
 */
function computeGapScore(passes: ReasoningPass[], knowledge: SynthesizedKnowledge): number {
	const totalGapCount = totalGaps(passes, knowledge)
	// 0 gaps = 1.0, 5+ gaps = 0.2
	return clamp(1.0 - totalGapCount * 0.15)
}

/**
 * Compute improvement trend across passes.
 */
function computeTrend(passes: ReasoningPass[]): number {
	if (passes.length <= 1) return 0.5

	const first = passes[0].confidenceDelta
	const last = passes[passes.length - 1].confidenceDelta

	if (last > first) return clamp(0.5 + (last - first) * 0.5)
	if (last === first) return 0.5
	return clamp(0.5 - (first - last) * 0.5)
}

/**
 * Compute output depth score based on analysis length and detail.
 */
function computeDepth(passes: ReasoningPass[]): number {
	const avgLen = avgOutputLength(passes)
	// Short (<200 chars) = 0.3, medium (500 chars) = 0.6, long (2000+ chars) = 0.9
	return clamp(0.2 + Math.min(avgLen / 2000, 1) * 0.7)
}

function countInsights(knowledge: SynthesizedKnowledge): number {
	return (
		knowledge.ragInsights.length + knowledge.webInsights.length + knowledge.graphInsights.length
	)
}

function totalGaps(passes: ReasoningPass[], knowledge: SynthesizedKnowledge): number {
	const passGaps = passes.reduce((sum, p) => sum + p.gaps.length, 0)
	return passGaps + knowledge.knowledgeGaps.length
}

function avgOutputLength(passes: ReasoningPass[]): number {
	if (passes.length === 0) return 0
	return passes.reduce((sum, p) => sum + p.output.length, 0) / passes.length
}

function clamp(value: number): number {
	return Math.max(0, Math.min(1, value))
}

/**
 * Dempster-Shafer evidence fusion.
 * Combines independent evidence sources (signals) into a single belief mass,
 * accounting for conflict between sources. Higher conflict = less trust in the fusion.
 */
function dempsterShaferFusion(signals: ConfidenceSignal[]): number {
	if (signals.length === 0) return 0.5

	// Each signal becomes a belief mass assignment:
	// m(H) = value * weight, m(¬H) = (1-value) * weight, m(Θ) = 1 - weight
	let beliefH = signals[0]!.value
	let beliefNotH = 1 - signals[0]!.value

	for (let i = 1; i < signals.length; i++) {
		const s = signals[i]!
		const m2H = s.value
		const m2NotH = 1 - s.value

		// Dempster's rule of combination
		const conflict = beliefH * m2NotH + beliefNotH * m2H
		const normalization = 1 - conflict * 0.5 // partial conflict normalization

		if (normalization < 0.01) {
			// Complete conflict — average instead
			beliefH = (beliefH + m2H) / 2
			beliefNotH = (beliefNotH + m2NotH) / 2
		} else {
			beliefH = (beliefH * m2H) / normalization
			beliefNotH = (beliefNotH * m2NotH) / normalization
		}
	}

	return clamp(beliefH)
}

// ============================================================
// Gap 4: Multi-dimensional Confidence Gates
// ============================================================

/** A confidence gate that triggers an action when a dimension is below threshold */
export interface ConfidenceGate {
	/** Which confidence dimension to check */
	dimension: 'factual' | 'logical' | 'completeness' | 'consistency'
	/** Threshold below which the gate triggers */
	threshold: number
	/** Action to take when triggered */
	action: 'escalate' | 'warn' | 'reject'
}

/** Default confidence gates for multi-dimensional quality enforcement */
const DEFAULT_GATES: ConfidenceGate[] = [
	{ dimension: 'factual', threshold: 0.6, action: 'escalate' },
	{ dimension: 'logical', threshold: 0.5, action: 'escalate' },
	{ dimension: 'completeness', threshold: 0.5, action: 'warn' },
	{ dimension: 'consistency', threshold: 0.4, action: 'reject' },
]

/** Result of evaluating confidence gates */
export interface GateEvaluationResult {
	/** Whether the result passed all critical gates */
	passed: boolean
	/** Gates that were triggered */
	triggered: ConfidenceGate[]
	/** Human-readable recommendation */
	recommendation: string
}

/**
 * Evaluate confidence gates against a scored result.
 *
 * Checks each gate against the corresponding confidence dimension.
 * If any 'reject' gate triggers, passed=false.
 * Returns triggered gates and a recommendation for remediation.
 *
 * @param score - The confidence score to evaluate
 * @param gates - Optional custom gates (uses DEFAULT_GATES if not provided)
 */
export function evaluateGates(
	score: ConfidenceScore,
	gates?: ConfidenceGate[],
): GateEvaluationResult {
	const activeGates = gates ?? DEFAULT_GATES
	const triggered: ConfidenceGate[] = []
	const recommendations: string[] = []
	let hasReject = false

	for (const gate of activeGates) {
		const dimensionValue = score[gate.dimension]
		if (dimensionValue < gate.threshold) {
			triggered.push(gate)

			switch (gate.action) {
				case 'reject':
					hasReject = true
					recommendations.push(
						`REJECT: ${gate.dimension} confidence (${dimensionValue.toFixed(2)}) below critical threshold (${gate.threshold})`,
					)
					break
				case 'escalate':
					recommendations.push(
						`ESCALATE: ${gate.dimension} confidence (${dimensionValue.toFixed(2)}) below threshold (${gate.threshold}) — run additional reasoning pass`,
					)
					break
				case 'warn':
					recommendations.push(
						`WARN: ${gate.dimension} confidence (${dimensionValue.toFixed(2)}) is low (${gate.threshold}) — may need attention`,
					)
					break
			}
		}
	}

	return {
		passed: !hasReject,
		triggered,
		recommendation:
			recommendations.length > 0 ? recommendations.join('\n') : 'All confidence gates passed',
	}
}
