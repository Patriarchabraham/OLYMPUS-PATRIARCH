import { randomUUID } from 'crypto'
import type {
  ResearchSource,
  ResearchResult,
  DeepResearchConfig,
  SearchFn,
  FetchFn,
} from './types.js'

const DEFAULT_MAX_SOURCES = 20
const DEFAULT_MAX_DEPTH = 3
const DEFAULT_CREDIBILITY_THRESHOLD = 0.3

// Well-known high-credibility domains
const HIGH_CREDIBILITY_DOMAINS = new Set([
  'github.com', 'stackoverflow.com', 'docs.python.org', 'developer.mozilla.org',
  'nodejs.org', 'typescriptlang.org', 'react.dev', 'nextjs.org', 'vuejs.org',
  'angular.io', 'rust-lang.org', 'go.dev', 'docs.rs', 'crates.io',
  'arxiv.org', 'doi.org', 'nature.com', 'science.org',
  'wikipedia.org', 'wikimedia.org',
  'ieee.org', 'acm.org', 'springer.com',
  'microsoft.com', 'google.com', 'apple.com', 'aws.amazon.com',
  'cloud.google.com', 'azure.microsoft.com',
  'npmjs.com', 'pypi.org', 'rubygems.org',
])

const LOW_CREDIBILITY_DOMAINS = new Set([
  'pinterest.com', 'reddit.com', 'twitter.com', 'x.com',
  'facebook.com', 'instagram.com', 'tiktok.com',
])

function getDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return ''
  }
}

/**
 * Break a complex query into multiple focused sub-queries.
 */
export function generateSubQueries(query: string): string[] {
  const subQueries: string[] = [query]

  // Extract key terms by removing stop words
  const stopWords = new Set([
    'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'shall', 'can', 'need', 'dare', 'ought',
    'used', 'to', 'of', 'in', 'for', 'on', 'with', 'at', 'by', 'from',
    'as', 'into', 'through', 'during', 'before', 'after', 'above', 'below',
    'between', 'out', 'off', 'over', 'under', 'again', 'further', 'then',
    'once', 'and', 'but', 'or', 'nor', 'not', 'so', 'yet', 'both',
    'either', 'neither', 'each', 'every', 'all', 'any', 'few', 'more',
    'most', 'other', 'some', 'such', 'no', 'only', 'own', 'same', 'than',
    'too', 'very', 'just', 'because', 'if', 'when', 'where', 'how', 'what',
    'which', 'who', 'whom', 'this', 'that', 'these', 'those', 'it', 'its',
  ])

  const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 2 && !stopWords.has(w))

  // Generate "how to" variant
  if (!query.toLowerCase().startsWith('how')) {
    subQueries.push(`how to ${words.slice(0, 5).join(' ')}`)
  }

  // Generate "what is" variant
  if (!query.toLowerCase().startsWith('what')) {
    subQueries.push(`what is ${words.slice(0, 4).join(' ')}`)
  }

  // Generate best practices variant
  if (!query.toLowerCase().includes('best practice')) {
    subQueries.push(`${words.slice(0, 4).join(' ')} best practices`)
  }

  // Generate comparison variant
  if (words.length >= 2) {
    subQueries.push(`${words[0]} vs ${words[1]} comparison`)
  }

  // Generate tutorial variant
  subQueries.push(`${words.slice(0, 4).join(' ')} tutorial guide`)

  return [...new Set(subQueries)]
}

/**
 * Assess credibility of a source based on domain and content signals.
 * Returns a score from 0 to 1.
 */
export function evaluateSource(source: ResearchSource): number {
  let score = 0.5 // baseline

  const domain = getDomain(source.url)

  // Domain credibility
  if (HIGH_CREDIBILITY_DOMAINS.has(domain)) {
    score += 0.3
  } else if (LOW_CREDIBILITY_DOMAINS.has(domain)) {
    score -= 0.2
  }

  // HTTPS bonus
  if (source.url.startsWith('https://')) {
    score += 0.05
  }

  // Content length signal (longer content tends to be more substantive)
  const contentLength = (source.fetchedContent ?? source.snippet).length
  if (contentLength > 5000) score += 0.1
  else if (contentLength > 1000) score += 0.05

  // Title quality (longer, more descriptive titles)
  if (source.title.length > 20 && source.title.length < 200) {
    score += 0.05
  }

  // Relevance score contributes
  score += source.relevanceScore * 0.1

  return Math.max(0, Math.min(1, score))
}

/**
 * Synthesize findings from multiple sources into a coherent summary.
 */
export function synthesizeFindings(sources: ResearchSource[], query: string): string {
  if (sources.length === 0) {
    return `No sources found for query: "${query}"`
  }

  const ranked = [...sources]
    .sort((a, b) => (b.credibilityScore + b.relevanceScore) - (a.credibilityScore + a.relevanceScore))

  const sections: string[] = []
  sections.push(`# Research: ${query}\n`)

  const topSources = ranked.slice(0, 10)

  sections.push('## Key Sources')
  for (const src of topSources) {
    sections.push(`- **${src.title}** (${src.url}) — credibility: ${(src.credibilityScore * 100).toFixed(0)}%`)
  }

  sections.push('\n## Synthesis')
  const snippets = topSources.map(s => s.snippet).filter(Boolean)

  if (snippets.length > 0) {
    sections.push(snippets.join('\n\n'))
  }

  // Include deeper content from top 3 sources
  const deepSources = ranked
    .filter(s => s.fetchedContent && s.fetchedContent.length > 100)
    .slice(0, 3)

  if (deepSources.length > 0) {
    sections.push('\n## Detailed Findings')
    for (const src of deepSources) {
      const content = src.fetchedContent!
      const excerpt = content.length > 2000
        ? content.slice(0, 2000) + '...'
        : content
      sections.push(`### From ${src.title}\n${excerpt}`)
    }
  }

  return sections.join('\n')
}

/**
 * Identify contradictions between sources.
 */
export function identifyContradictions(sources: ResearchSource[]): string[] {
  const contradictions: string[] = []

  // Look for opposing language patterns in snippets
  const opposingPatterns: [RegExp, RegExp, string][] = [
    [/\b(is|are|was|were)\s+(safe|secure|recommended|best)\b/i,
     /\b(is|are|was|were)\s+(unsafe|insecure|not recommended|worst|deprecated)\b/i,
     'safety assessment'],
    [/\b(supports|supports\s+only)\b/i,
     /\b(does\s+not\s+support|lacks\s+support)\b/i,
     'feature support'],
    [/\b(faster|more\s+efficient|better\s+performance)\b/i,
     /\b(slower|less\s+efficient|worse\s+performance)\b/i,
     'performance comparison'],
    [/\b(recommended|should\s+use|best\s+practice)\b/i,
     /\b(not\s+recommended|should\s+avoid|anti-pattern)\b/i,
     'recommendation'],
  ]

  for (const [positive, negative, label] of opposingPatterns) {
    const positiveSources = sources.filter(s => positive.test(s.snippet))
    const negativeSources = sources.filter(s => negative.test(s.snippet))

    if (positiveSources.length > 0 && negativeSources.length > 0) {
      const posTitles = positiveSources.map(s => s.title).join(', ')
      const negTitles = negativeSources.map(s => s.title).join(', ')
      contradictions.push(
        `${label}: "${posTitles}" vs "${negTitles}"`
      )
    }
  }

  return contradictions
}

/**
 * Default no-op search function.
 */
const defaultSearchFn: SearchFn = async (_query: string) => []

/**
 * Default no-op fetch function.
 */
const defaultFetchFn: FetchFn = async (_url: string) => ''

/**
 * Perform deep research on a query.
 *
 * @param query - The research query
 * @param depth - Research depth (1=quick, 2=moderate, 3=exhaustive)
 * @param config - Optional configuration with pluggable search/fetch functions
 */
export async function research(
  query: string,
  depth: number = 2,
  config: DeepResearchConfig = {},
): Promise<ResearchResult> {
  const startTime = Date.now()
  const {
    searchFn = defaultSearchFn,
    fetchFn = defaultFetchFn,
    maxSources = DEFAULT_MAX_SOURCES,
    maxDepth = DEFAULT_MAX_DEPTH,
    credibilityThreshold = DEFAULT_CREDIBILITY_THRESHOLD,
  } = config

  const effectiveDepth = Math.min(depth, maxDepth)
  const allSources: ResearchSource[] = []

  // Level 1: Primary search
  const subQueries = effectiveDepth >= 2
    ? generateSubQueries(query)
    : [query]

  for (const subQuery of subQueries) {
    try {
      const results = await searchFn(subQuery)
      allSources.push(...results)
    } catch {
      // Continue with what we have
    }
  }

  // Deduplicate by URL
  const seenUrls = new Set<string>()
  const uniqueSources = allSources.filter(s => {
    if (seenUrls.has(s.url)) return false
    seenUrls.add(s.url)
    return true
  })

  // Evaluate credibility for each source
  for (const source of uniqueSources) {
    source.credibilityScore = evaluateSource(source)
  }

  // Level 2+: Fetch content for top sources
  if (effectiveDepth >= 2) {
    const topSources = uniqueSources
      .filter(s => s.credibilityScore >= credibilityThreshold)
      .sort((a, b) => b.credibilityScore - a.credibilityScore)
      .slice(0, effectiveDepth >= 3 ? maxSources : 5)

    await Promise.allSettled(
      topSources.map(async (source) => {
        try {
          source.fetchedContent = await fetchFn(source.url)
          source.fetchTimestamp = Date.now()
        } catch {
          // Keep source without fetched content
        }
      }),
    )
  }

  // Filter by credibility threshold
  const credibleSources = uniqueSources
    .filter(s => s.credibilityScore >= credibilityThreshold)
    .sort((a, b) => (b.credibilityScore + b.relevanceScore) - (a.credibilityScore + a.relevanceScore))
    .slice(0, maxSources)

  // Synthesize
  const synthesis = synthesizeFindings(credibleSources, query)

  // Extract key findings
  const keyFindings = credibleSources
    .slice(0, 5)
    .map(s => s.snippet)
    .filter(Boolean)

  // Identify contradictions
  const contradictions = identifyContradictions(credibleSources)

  // Calculate overall confidence
  const avgCredibility = credibleSources.length > 0
    ? credibleSources.reduce((sum, s) => sum + s.credibilityScore, 0) / credibleSources.length
    : 0
  const sourceCountBoost = Math.min(credibleSources.length / 10, 0.2)
  const confidence = Math.min(avgCredibility + sourceCountBoost, 1)

  return {
    id: randomUUID(),
    query,
    sources: credibleSources,
    synthesis,
    keyFindings,
    contradictions,
    confidence,
    durationMs: Date.now() - startTime,
    timestamp: Date.now(),
  }
}
