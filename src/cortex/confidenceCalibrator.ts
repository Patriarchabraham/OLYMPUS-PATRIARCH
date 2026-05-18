/**
 * ConfidenceCalibrator — Multi-signal confidence scoring across reasoning layers.
 * Pure calculation, no LLM calls.
 */

import type { ReasoningPass, CrossModelResult, SynthesizedKnowledge, ConfidenceScore, ConfidenceSignal } from './types.js'

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
    description: passes.length > 1
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
  const overall = signals.reduce((sum, s) => sum + s.value * s.weight, 0)

  return {
    overall: clamp(overall),
    factual: clamp(consistency * 0.6 + crossModelValue * 0.4),
    logical: clamp(consistency * 0.7 + trend * 0.3),
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
  return knowledge.ragInsights.length + knowledge.webInsights.length + knowledge.graphInsights.length
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
