/**
 * QueryDecomposer — Breaks complex queries into independent sub-queries.
 * Uses rule-based decomposition: clause detection, keyword splitting, conjunction analysis.
 * No LLM calls — pure TypeScript logic.
 */

import type { DecomposedQuery, QueryType, MetaInsight } from './types.js'

let queryCounter = 0

/**
 * Decompose a query into sub-queries based on complexity insights.
 * Simple queries return a single sub-query; complex queries are split.
 */
export function decompose(query: string, insights: MetaInsight[]): DecomposedQuery[] {
  queryCounter++
  const complexityInsight = insights.find((i) => i.type === 'query_complexity')
  const domainInsight = insights.find((i) => i.type === 'domain_detection')

  // For simple queries, return a single sub-query
  if (complexityInsight?.description.includes('simple')) {
    return [createSubQuery(query, inferType(query, domainInsight), 1, [])]
  }

  // Try clause-based decomposition
  const clauses = splitIntoClauses(query)

  if (clauses.length <= 1) {
    // Try conjunction-based decomposition
    const parts = splitByConjunctions(query)
    if (parts.length <= 1) {
      return [createSubQuery(query, inferType(query, domainInsight), 1, [])]
    }
    return parts.map((part, idx) =>
      createSubQuery(part, inferType(part, domainInsight), parts.length - idx, idx > 0 ? [`q_${queryCounter}_${idx}`] : [])
    )
  }

  // Assign types and dependencies based on clause order
  const subQueries: DecomposedQuery[] = clauses.map((clause, idx) => {
    const type = inferType(clause, domainInsight)
    const dependencies = idx > 0 ? [`q_${queryCounter}_${idx}`] : []
    return createSubQuery(clause, type, clauses.length - idx, dependencies)
  })

  return subQueries
}

/**
 * Split a query into clauses based on punctuation and structural markers.
 */
function splitIntoClauses(query: string): string[] {
  // Split on sentence-ending punctuation followed by a new thought
  const sentenceSplits = query.split(/\.\s+(?=[A-Z])/)
  if (sentenceSplits.length > 1) return sentenceSplits.map((s) => s.trim()).filter((s) => s.length > 0)

  // Split on numbered items
  const numberedMatch = query.match(/(?:^|\n)\s*\d+[.)]\s+.+/g)
  if (numberedMatch && numberedMatch.length > 1) {
    return numberedMatch.map((s) => s.replace(/^\s*\d+[.)]\s*/, '').trim())
  }

  // Split on bullet points
  const bulletMatch = query.match(/(?:^|\n)\s*[-*]\s+.+/g)
  if (bulletMatch && bulletMatch.length > 1) {
    return bulletMatch.map((s) => s.replace(/^\s*[-*]\s*/, '').trim())
  }

  // Split on "and" / "then" / "also" connecting distinct actions
  const actionSplit = query.split(/\s+(?:and then|then also|additionally,?)\s+/i)
  if (actionSplit.length > 1) return actionSplit.map((s) => s.trim()).filter((s) => s.length > 0)

  return [query]
}

/**
 * Split by conjunctions that indicate separate concerns.
 */
function splitByConjunctions(query: string): string[] {
  // Split on "and" that connects independent clauses (heuristic)
  const parts: string[] = []
  let remaining = query

  // Split on ", and " or "; " that separates distinct tasks
  const splits = remaining.split(/,\s+and\s+|;\s+/)

  if (splits.length > 1) {
    return splits.map((s) => s.trim()).filter((s) => s.length > 0)
  }

  return [query]
}

/**
 * Infer the query type from content and domain insight.
 */
function inferType(text: string, domainInsight?: MetaInsight): QueryType {
  const lower = text.toLowerCase()

  // Direct type detection
  if (/what is|who|when|where|which|how many/.test(lower)) return 'factual'
  if (/why|compare|analyze|difference|trade-off|evaluate/.test(lower)) return 'analytical'
  if (/create|generate|design|build|implement|prototype/.test(lower)) return 'creative'
  if (/how to|steps|guide|install|setup|configure|deploy/.test(lower)) return 'procedural'
  if (/verify|test|validate|check|ensure|correct/.test(lower)) return 'verification'
  if (/architecture|design pattern|structure|refactor|module/.test(lower)) return 'architectural'
  if (/bug|error|crash|fix|broken|debug|traceback/.test(lower)) return 'debugging'
  if (/optimize|performance|speed|faster|slow|latency|bottleneck/.test(lower)) return 'optimization'

  // Fall back to domain insight
  if (domainInsight) {
    const desc = domainInsight.description.toLowerCase()
    if (desc.includes('debugging')) return 'debugging'
    if (desc.includes('architectural')) return 'architectural'
    if (desc.includes('creative')) return 'creative'
    if (desc.includes('optimization')) return 'optimization'
    if (desc.includes('procedural')) return 'procedural'
    if (desc.includes('factual')) return 'factual'
    if (desc.includes('verification')) return 'verification'
  }

  return 'analytical'
}

/**
 * Create a single DecomposedQuery.
 */
function createSubQuery(query: string, type: QueryType, priority: number, dependencies: string[]): DecomposedQuery {
  return {
    id: `q_${queryCounter}_${priority}`,
    query,
    type,
    priority,
    dependencies,
  }
}
