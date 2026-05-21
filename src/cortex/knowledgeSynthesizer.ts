/**
 * KnowledgeSynthesizer — Fuses knowledge from RAG, WebIntel, and Knowledge Graph.
 * Gracefully handles missing modules (returns empty arrays).
 */

import type { SynthesizedKnowledge } from './types.js'

interface KnowledgeSource {
  name: string
  insights: string[]
  available: boolean
}

/**
 * Synthesize knowledge from multiple sources for a given query.
 * @param query The query to gather knowledge for
 * @param depth 0=off, 1=basic, 2=deep
 */
export async function synthesize(query: string, depth: number): Promise<SynthesizedKnowledge> {
  if (depth === 0) {
    return emptySynthesis(0)
  }

  // Collect from all available sources
  const sources = await collectSources(query, depth)

  // Identify contradictions between sources
  const contradictions = findContradictions(sources)

  // Identify knowledge gaps
  const knowledgeGaps = identifyGaps(query, sources)

  // Build combined summary
  const combinedSummary = buildSummary(sources, contradictions, knowledgeGaps)

  return {
    ragInsights: sources.find((s) => s.name === 'rag')?.insights ?? [],
    webInsights: sources.find((s) => s.name === 'web')?.insights ?? [],
    graphInsights: sources.find((s) => s.name === 'graph')?.insights ?? [],
    contradictions,
    knowledgeGaps,
    combinedSummary,
    depth,
  }
}

/**
 * Collect insights from all available knowledge sources.
 */
async function collectSources(query: string, depth: number): Promise<KnowledgeSource[]> {
  const sources: KnowledgeSource[] = []

  // Try RAG engine
  try {
    const ragModule = await import('../knowledge/ragEngine.js')
    const ragEngine = ragModule.getRAGEngine?.()
    if (ragEngine) {
      const results = await ragEngine.query(query, { topK: depth >= 2 ? 10 : 5 })
      sources.push({
        name: 'rag',
        insights: (results as any).map?.((r: { content: string }) => r.content) ?? [],
        available: true,
      })
    } else {
      sources.push({ name: 'rag', insights: [], available: false })
    }
  } catch {
    sources.push({ name: 'rag', insights: [], available: false })
  }

  // Try WebIntel
  try {
    const webintelModule = await import('../webintel/deepResearch.js')
    const research = await webintelModule.research(query, depth)
    sources.push({
      name: 'web',
      insights: research.keyFindings ?? [],
      available: true,
    })
  } catch {
    sources.push({ name: 'web', insights: [], available: false })
  }

  // Try Knowledge Graph
  try {
    const graphModule = await import('../knowledge/knowledgeGraph.js')
    const relatedNodes = graphModule.queryGraph?.(graphModule.buildGraph([]), query)
    if (relatedNodes && relatedNodes.length > 0) {
      sources.push({
        name: 'graph',
        insights: relatedNodes.map((r: { name: string; type: string }) => `${r.type}: ${r.name}`),
        available: true,
      })
    } else {
      sources.push({ name: 'graph', insights: [], available: false })
    }
  } catch {
    sources.push({ name: 'graph', insights: [], available: false })
  }

  return sources
}

/**
 * Find contradictions between knowledge sources.
 */
function findContradictions(sources: KnowledgeSource[]): string[] {
  const contradictions: string[] = []
  const allInsights = sources.flatMap((s) => s.insights.map((i) => ({ source: s.name, insight: i })))

  // Simple contradiction detection: look for negation patterns
  for (let i = 0; i < allInsights.length; i++) {
    for (let j = i + 1; j < allInsights.length; j++) {
      const a = allInsights[i]
      const b = allInsights[j]
      if (a.source === b.source) continue

      // Check if one insight negates another
      if (areContradictory(a.insight, b.insight)) {
        contradictions.push(`[${a.source}] "${truncate(a.insight, 80)}" vs [${b.source}] "${truncate(b.insight, 80)}"`)
      }
    }
  }

  return contradictions.slice(0, 5)
}

/**
 * Check if two insights contradict each other (heuristic).
 */
function areContradictory(a: string, b: string): boolean {
  const lowerA = a.toLowerCase()
  const lowerB = b.toLowerCase()

  // Negation patterns
  const negationWords = ['not', "doesn't", 'cannot', "can't", 'never', 'no', 'unable', 'impossible']
  const aHasNegation = negationWords.some((w) => lowerA.includes(w))
  const bHasNegation = negationWords.some((w) => lowerB.includes(w))

  if (aHasNegation !== bHasNegation) {
    // One has negation, other doesn't — check if they share key terms
    const aTerms = extractKeyTerms(lowerA)
    const bTerms = extractKeyTerms(lowerB)
    const overlap = aTerms.filter((t) => bTerms.includes(t))
    return overlap.length >= 2
  }

  return false
}

/**
 * Extract key terms from text for comparison.
 */
function extractKeyTerms(text: string): string[] {
  const stopWords = new Set(['the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'shall', 'can', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below', 'between', 'out', 'off', 'over', 'under', 'again', 'further', 'then', 'once', 'and', 'but', 'or', 'nor', 'not', 'so', 'yet', 'both', 'either', 'neither', 'each', 'every', 'all', 'any', 'few', 'more', 'most', 'other', 'some', 'such', 'no', 'only', 'own', 'same', 'than', 'too', 'very', 'just', 'because', 'if', 'when', 'where', 'how', 'what', 'which', 'who', 'whom', 'this', 'that', 'these', 'those'])

  return text
    .split(/\s+/)
    .map((w) => w.replace(/[^a-z0-9]/g, ''))
    .filter((w) => w.length > 3 && !stopWords.has(w))
}

/**
 * Identify knowledge gaps based on query and available sources.
 */
function identifyGaps(query: string, sources: KnowledgeSource[]): string[] {
  const gaps: string[] = []

  const availableCount = sources.filter((s) => s.available).length
  const totalInsights = sources.reduce((sum, s) => sum + s.insights.length, 0)

  if (availableCount === 0) {
    gaps.push('No knowledge sources available — response will rely solely on model knowledge')
  }

  if (totalInsights === 0 && availableCount > 0) {
    gaps.push('Available knowledge sources returned no relevant results for this query')
  }

  const queryTerms = extractKeyTerms(query.toLowerCase())
  const allInsightTerms = sources.flatMap((s) => s.insights.flatMap((i) => extractKeyTerms(i.toLowerCase())))
  const uncoveredTerms = queryTerms.filter((t) => !allInsightTerms.includes(t))

  if (uncoveredTerms.length > 0) {
    gaps.push(`Key query terms not covered by knowledge sources: ${uncoveredTerms.slice(0, 5).join(', ')}`)
  }

  return gaps
}

/**
 * Build a combined summary from all sources.
 */
function buildSummary(sources: KnowledgeSource[], contradictions: string[], gaps: string[]): string {
  const parts: string[] = []

  const availableSources = sources.filter((s) => s.available)
  parts.push(`Knowledge synthesis from ${availableSources.length} source(s)`)

  for (const source of availableSources) {
    if (source.insights.length > 0) {
      parts.push(`[${source.name}]: ${source.insights.length} relevant insights`)
    }
  }

  if (contradictions.length > 0) {
    parts.push(`${contradictions.length} contradiction(s) detected between sources`)
  }

  if (gaps.length > 0) {
    parts.push(`Gaps: ${gaps.join('; ')}`)
  }

  return parts.join('. ') + '.'
}

function emptySynthesis(depth: number): SynthesizedKnowledge {
  return {
    ragInsights: [],
    webInsights: [],
    graphInsights: [],
    contradictions: [],
    knowledgeGaps: [],
    combinedSummary: 'Knowledge synthesis disabled (depth=0)',
    depth,
  }
}

function truncate(str: string, maxLen: number): string {
  return str.length <= maxLen ? str : str.substring(0, maxLen) + '...'
}
