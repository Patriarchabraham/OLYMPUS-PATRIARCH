/**
 * InsightCombiner — Merges all cortex outputs into a structured augmented context string.
 * Respects maxTokenBudget by truncating if needed.
 */

import type { CortexAnalysis, MetaInsight } from './types.js'

/** Approximate characters per token (conservative estimate) */
const CHARS_PER_TOKEN = 3.5

/**
 * Combine all cortex analysis results into a single augmented context string
 * suitable for injection into the system prompt.
 */
export function combine(analysis: CortexAnalysis, maxTokenBudget: number = 2000): string {
  const maxChars = Math.floor(maxTokenBudget * CHARS_PER_TOKEN)

  const sections: string[] = []

  // Header with key metrics
  sections.push(formatHeader(analysis))

  // Meta insights (query analysis)
  if (analysis.metaInsights.length > 0) {
    sections.push(formatMetaInsights(analysis.metaInsights))
  }

  // Reasoning summary
  if (analysis.reasoningPasses.length > 0) {
    sections.push(formatReasoning(analysis.reasoningPasses))
  }

  // Cross-model verification
  if (analysis.crossModelResults.length > 0) {
    sections.push(formatCrossModel(analysis.crossModelResults))
  }

  // Knowledge synthesis
  if (analysis.synthesizedKnowledge.combinedSummary) {
    sections.push(formatKnowledge(analysis.synthesizedKnowledge))
  }

  // Sub-query decomposition
  if (analysis.subQueries.length > 1) {
    sections.push(formatSubQueries(analysis.subQueries))
  }

  // Combine and truncate to budget
  const full = sections.join('\n\n')
  if (full.length <= maxChars) return full

  // Truncate: keep header + most important sections
  const header = sections[0]
  const remaining = sections.slice(1).join('\n\n')
  const available = maxChars - header.length - 20 // 20 for truncation notice

  if (available <= 0) return header.substring(0, maxChars)

  return `${header}\n\n${remaining.substring(0, available)}\n[...truncated]`
}

function formatHeader(analysis: CortexAnalysis): string {
  const complexity = analysis.metaInsights.find((i) => i.type === 'query_complexity')
  const domain = analysis.metaInsights.find((i) => i.type === 'domain_detection')
  const strategy = analysis.metaInsights.find((i) => i.type === 'optimal_strategy')

  const complexityLevel = complexity?.description.match(/complexity: (\w+)/)?.[1] ?? 'unknown'
  const domainName = domain?.description.match(/domain: (\w+)/)?.[1] ?? 'unknown'
  const strategyName = strategy?.description.match(/strategy: (\w+)/)?.[1] ?? 'auto'

  return [
    '[Deep Analysis]',
    `Query Type: ${domainName} | Complexity: ${complexityLevel} | Confidence: ${(analysis.finalConfidence * 100).toFixed(0)}%`,
    `Strategy: ${strategyName} | Passes: ${analysis.reasoningPasses.length} | Duration: ${analysis.durationMs}ms`,
  ].join('\n')
}

function formatMetaInsights(insights: MetaInsight[]): string {
  const highPriority = insights.filter((i) => i.priority === 'high' || i.priority === 'critical')
  const items = highPriority.length > 0 ? highPriority : insights.slice(0, 3)

  return [
    'Key Insights:',
    ...items.map((i) => `- ${i.description}${i.action ? ` → ${i.action}` : ''}`),
  ].join('\n')
}

function formatReasoning(passes: CortexAnalysis['reasoningPasses']): string {
  if (passes.length === 0) return ''

  const best = passes[passes.length - 1]
  const gapsAddressed = passes.flatMap((p) => p.gaps)
  const uniqueGaps = [...new Set(gapsAddressed)]

  const lines: string[] = ['Reasoning:']
  lines.push(`- Strategies used: ${passes.map((p) => p.strategy.toUpperCase()).join(' → ')}`)
  lines.push(`- Final confidence: ${(best.confidenceDelta * 100).toFixed(0)}%`)

  if (uniqueGaps.length > 0) {
    lines.push(`- Gaps identified: ${uniqueGaps.slice(0, 3).join('; ')}`)
  }

  // Include best pass output summary (first 300 chars)
  const outputSummary = best.output.substring(0, 300)
  if (outputSummary.length > 0) {
    lines.push(`- Analysis: ${outputSummary}${best.output.length > 300 ? '...' : ''}`)
  }

  return lines.join('\n')
}

function formatCrossModel(results: CortexAnalysis['crossModelResults']): string {
  if (results.length === 0) return ''

  const result = results[0]
  if (!result || result.modelName === 'none') return ''

  const lines: string[] = ['Cross-Model Verification:']
  lines.push(`- Model: ${result.modelName} | Agreement: ${(result.agreementWithPrimary * 100).toFixed(0)}%`)

  if (result.uniqueInsights.length > 0) {
    lines.push(`- Unique insights: ${result.uniqueInsights.slice(0, 2).join('; ')}`)
  }

  if (result.contradictions.length > 0) {
    lines.push(`- Contradictions: ${result.contradictions.slice(0, 2).join('; ')}`)
  }

  return lines.join('\n')
}

function formatKnowledge(knowledge: CortexAnalysis['synthesizedKnowledge']): string {
  const lines: string[] = ['Knowledge:']

  const totalInsights = knowledge.ragInsights.length + knowledge.webInsights.length + knowledge.graphInsights.length
  lines.push(`- ${knowledge.combinedSummary}`)

  if (totalInsights > 0) {
    const topInsights = [
      ...knowledge.ragInsights.slice(0, 1),
      ...knowledge.webInsights.slice(0, 1),
      ...knowledge.graphInsights.slice(0, 1),
    ]
    if (topInsights.length > 0) {
      lines.push(`- Top: ${topInsights.join('; ')}`)
    }
  }

  if (knowledge.contradictions.length > 0) {
    lines.push(`- Contradictions: ${knowledge.contradictions[0]}`)
  }

  return lines.join('\n')
}

function formatSubQueries(subQueries: CortexAnalysis['subQueries']): string {
  return [
    'Decomposed Queries:',
    ...subQueries.map((sq) => `- [${sq.type}] ${sq.query}`),
  ].join('\n')
}
