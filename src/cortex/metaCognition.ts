/**
 * MetaCognition — Pre-analysis of queries to determine optimal strategy.
 * Uses heuristic keyword analysis, length, and structure detection.
 * No LLM calls required — pure TypeScript logic.
 */

import type { MetaInsight, MetaInsightType, QueryType } from './types.js'

/** Domain keyword sets for classification */
const DOMAIN_KEYWORDS: Record<string, string[]> = {
  debugging: ['bug', 'error', 'crash', 'fix', 'broken', 'stack trace', 'exception', 'debug', 'traceback', 'segfault', 'fault', 'issue', 'regression'],
  architectural: ['architecture', 'design', 'pattern', 'structure', 'refactor', 'module', 'system', 'component', 'layer', 'microservice', 'monolith', 'diagram'],
  creative: ['create', 'generate', 'design', 'build', 'implement', 'prototype', 'idea', 'brainstorm', 'creative', 'novel', 'innovative'],
  procedural: ['how to', 'steps', 'guide', 'install', 'setup', 'configure', 'deploy', 'tutorial', 'process', 'workflow'],
  optimization: ['optimize', 'performance', 'speed', 'faster', 'slow', 'latency', 'memory', 'cpu', 'bottleneck', 'efficient', 'improve'],
  verification: ['verify', 'test', 'validate', 'check', 'ensure', 'correct', 'assert', 'confirm', 'prove'],
  factual: ['what is', 'who', 'when', 'where', 'which', 'how many', 'does', 'is it'],
  analytical: ['why', 'compare', 'analyze', 'difference', 'trade-off', 'pros and cons', 'evaluate', 'assess', 'impact'],
}

/** Complexity indicators */
const COMPLEXITY_INDICATORS = {
  high: ['multiple', 'complex', 'integrate', 'end-to-end', 'full-stack', 'distributed', 'concurrent', 'parallel', 'microservice', 'multi-'],
  medium: ['several', 'combine', 'refactor', 'migrate', 'upgrade', 'redesign', 'restructure'],
}

/**
 * Analyze a query and produce meta-insights about its nature and optimal handling.
 */
export async function analyzeQuery(query: string): Promise<MetaInsight[]> {
  const insights: MetaInsight[] = []
  const lower = query.toLowerCase()
  const wordCount = query.split(/\s+/).length

  // 1. Query complexity
  insights.push(analyzeComplexity(lower, wordCount))

  // 2. Domain detection
  insights.push(detectDomain(lower))

  // 3. Missing context detection
  const missingCtx = detectMissingContext(lower, wordCount)
  if (missingCtx) insights.push(missingCtx)

  // 4. Bias detection
  const bias = detectBias(lower)
  if (bias) insights.push(bias)

  // 5. Optimal strategy recommendation
  insights.push(recommendStrategy(lower, wordCount, insights))

  // 6. Capability gap detection
  const gap = detectCapabilityGap(lower)
  if (gap) insights.push(gap)

  return insights
}

/** Detect query complexity level */
function analyzeComplexity(lower: string, wordCount: number): MetaInsight {
  let level: 'simple' | 'medium' | 'complex' | 'extreme'
  let confidence: number

  const hasHighIndicators = COMPLEXITY_INDICATORS.high.some((kw) => lower.includes(kw))
  const hasMediumIndicators = COMPLEXITY_INDICATORS.medium.some((kw) => lower.includes(kw))
  const hasMultipleQuestions = (lower.match(/\?/g) || []).length > 2
  const hasConjunctions = /\band\b|\bor\b|\balso\b|\bplus\b/.test(lower)

  if (wordCount > 50 || (hasHighIndicators && hasMultipleQuestions)) {
    level = 'extreme'
    confidence = 0.9
  } else if (wordCount > 25 || hasHighIndicators || (hasMediumIndicators && hasMultipleQuestions)) {
    level = 'complex'
    confidence = 0.8
  } else if (wordCount > 10 || hasMediumIndicators || hasConjunctions) {
    level = 'medium'
    confidence = 0.7
  } else {
    level = 'simple'
    confidence = 0.85
  }

  return {
    type: 'query_complexity',
    description: `Query complexity: ${level} (${wordCount} words, ${(lower.match(/\?/g) || []).length} questions)`,
    action: level === 'extreme'
      ? 'Decompose into sub-queries; use multi-pass reasoning with ToT'
      : level === 'complex'
        ? 'Consider decomposition; apply CoT then ToT if needed'
        : level === 'medium'
          ? 'Single-pass CoT with reflection if confidence low'
          : 'Direct single-pass CoT sufficient',
    priority: level === 'extreme' ? 'critical' : level === 'complex' ? 'high' : level === 'medium' ? 'medium' : 'low',
    confidence,
  }
}

/** Detect primary domain of the query */
function detectDomain(lower: string): MetaInsight {
  const scores: Record<string, number> = {}
  let bestDomain = 'analytical'
  let bestScore = 0

  for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
    let score = 0
    for (const kw of keywords) {
      if (lower.includes(kw)) score++
    }
    scores[domain] = score
    if (score > bestScore) {
      bestScore = score
      bestDomain = domain
    }
  }

  return {
    type: 'domain_detection',
    description: `Primary domain: ${bestDomain}${bestScore > 2 ? ' (strong signal)' : bestScore > 0 ? ' (moderate signal)' : ' (heuristic guess)'}`,
    action: `Apply ${bestDomain}-optimized reasoning patterns`,
    priority: bestScore > 2 ? 'high' : 'medium',
    confidence: Math.min(0.5 + bestScore * 0.1, 0.95),
  }
}

/** Detect missing context that would improve the answer */
function detectMissingContext(lower: string, wordCount: number): MetaInsight | null {
  const missing: string[] = []

  // Check for vague references
  if (/\bit\b|\bthis\b|\bthat\b|\bthese\b|\bthose\b/.test(lower) && wordCount < 15) {
    missing.push('Vague pronoun references without clear antecedent')
  }

  // Check for missing version/platform context
  if (/install|setup|configure|error|bug/.test(lower) && !/version|v\d|windows|linux|mac|node|python|java/.test(lower)) {
    missing.push('Missing version or platform specification')
  }

  // Check for code without language context
  if (/function|class|method|variable|type|interface|module/.test(lower) && !/typescript|javascript|python|java|rust|go|c\+\+|ruby/.test(lower)) {
    missing.push('Missing programming language context')
  }

  // Check for missing error details
  if (/error|bug|crash|fail|broken/.test(lower) && !/error message|stack trace|log|output|code \d/.test(lower)) {
    missing.push('Missing error details (message, stack trace, or logs)')
  }

  if (missing.length === 0) return null

  return {
    type: 'missing_context',
    description: `Missing context detected: ${missing.join('; ')}`,
    action: `Request clarification on: ${missing.join(', ')}`,
    priority: missing.length >= 2 ? 'high' : 'medium',
    confidence: 0.7,
  }
}

/** Detect potential bias in the query */
function detectBias(lower: string): MetaInsight | null {
  const biasPatterns = [
    { pattern: /\b(best|worst|always|never|obviously|clearly|definitely)\b/i, type: 'absolutist language' },
    { pattern: /\bshould\b.*\b(because|since)\b/i, type: 'assumed causation' },
    { pattern: /\beveryone (knows|says|agrees)\b/i, type: 'appeal to consensus' },
  ]

  const detected: string[] = []
  for (const { pattern, type } of biasPatterns) {
    if (pattern.test(lower)) detected.push(type)
  }

  if (detected.length === 0) return null

  return {
    type: 'bias_detection',
    description: `Potential bias detected: ${detected.join(', ')}`,
    action: 'Apply critical analysis; verify assumptions independently',
    priority: 'medium',
    confidence: 0.6,
  }
}

/** Recommend optimal reasoning strategy */
function recommendStrategy(lower: string, wordCount: number, previousInsights: MetaInsight[]): MetaInsight {
  const complexity = previousInsights.find((i) => i.type === 'query_complexity')
  const domain = previousInsights.find((i) => i.type === 'domain_detection')

  let strategy: string
  let reason: string

  const isCreative = domain?.description.includes('creative') ?? false
  const isDebugging = domain?.description.includes('debugging') ?? false
  const isExtreme = complexity?.description.includes('extreme') ?? false

  if (isExtreme) {
    strategy = 'ensemble'
    reason = 'Extreme complexity benefits from multiple strategy combination'
  } else if (isCreative) {
    strategy = 'tot'
    reason = 'Creative queries benefit from exploring multiple thought paths'
  } else if (isDebugging) {
    strategy = 'cot'
    reason = 'Debugging benefits from linear chain-of-thought analysis'
  } else if (wordCount > 30) {
    strategy = 'tot'
    reason = 'Long queries suggest multiple facets worth exploring in parallel'
  } else {
    strategy = 'cot'
    reason = 'Standard chain-of-thought for moderate complexity'
  }

  return {
    type: 'optimal_strategy',
    description: `Recommended strategy: ${strategy}`,
    action: `Start with ${strategy}; escalate to reflect or ensemble if confidence below threshold`,
    priority: 'high',
    confidence: 0.75,
  }
}

/** Detect if the query asks for something beyond current capabilities */
function detectCapabilityGap(lower: string): MetaInsight | null {
  const gapPatterns = [
    { pattern: /\breal[- ]?time\b.*\bstream/i, gap: 'Real-time streaming may require specialized infrastructure' },
    { pattern: /\bimage|video|audio|media\b.*\bgenerat/i, gap: 'Media generation requires external service integration' },
    { pattern: /\bdeploy|production\b.*\bcluster|kubernetes/i, gap: 'Production cluster deployment requires infra access' },
  ]

  for (const { pattern, gap } of gapPatterns) {
    if (pattern.test(lower)) {
      return {
        type: 'capability_gap',
        description: gap,
        action: 'Flag limitation; suggest alternative approach if available',
        priority: 'medium',
        confidence: 0.6,
      }
    }
  }

  return null
}
