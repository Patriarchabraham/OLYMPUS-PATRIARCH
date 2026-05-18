import type { ResearchSource, SourceComparison } from './types.js'

/**
 * Compare how multiple sources relate on specific claims.
 */
export function compareSources(sources: ResearchSource[]): SourceComparison[] {
  const comparisons: SourceComparison[] = []
  if (sources.length < 2) return comparisons

  // Extract claims from snippets (sentences with factual language)
  const claimPatterns = [
    /\b(is|are|was|were|has|have|had)\s+([^.!?\n]{10,80})/gi,
    /\b(can|will|should|does|supports)\s+([^.!?\n]{10,80})/gi,
  ]

  const allClaims: { claim: string; url: string; snippet: string }[] = []

  for (const source of sources) {
    const text = source.fetchedContent ?? source.snippet
    for (const pattern of claimPatterns) {
      let match: RegExpExecArray | null
      const localPattern = new RegExp(pattern.source, pattern.flags)
      while ((match = localPattern.exec(text)) !== null) {
        const claimText = match[0].trim()
        if (claimText.length > 15 && claimText.length < 200) {
          allClaims.push({
            claim: claimText,
            url: source.url,
            snippet: source.snippet,
          })
        }
      }
    }
  }

  // Group similar claims by keyword overlap
  const processedClaims = new Set<number>()

  for (let i = 0; i < allClaims.length; i++) {
    if (processedClaims.has(i)) continue

    const baseClaim = allClaims[i]
    const relatedClaims = [baseClaim]

    const baseWords = new Set(
      baseClaim.claim.toLowerCase().split(/\s+/).filter(w => w.length > 3)
    )

    for (let j = i + 1; j < allClaims.length; j++) {
      if (processedClaims.has(j)) continue

      const otherClaim = allClaims[j]
      const otherWords = new Set(
        otherClaim.claim.toLowerCase().split(/\s+/).filter(w => w.length > 3)
      )

      // Calculate Jaccard similarity
      const intersection = [...baseWords].filter(w => otherWords.has(w)).length
      const union = new Set([...baseWords, ...otherWords]).size
      const similarity = union > 0 ? intersection / union : 0

      if (similarity > 0.4) {
        relatedClaims.push(otherClaim)
        processedClaims.add(j)
      }
    }

    processedClaims.add(i)

    if (relatedClaims.length >= 2) {
      const sourceEntries = relatedClaims.map(c => ({
        url: c.url,
        agrees: true, // Simplified: same-topic claims from different sources are treated as agreeing
        quote: c.claim,
      }))

      const uniqueUrls = new Set(sourceEntries.map(s => s.url))

      // Determine consensus level
      let consensus: SourceComparison['consensus']
      if (uniqueUrls.size >= 3) {
        consensus = 'strong'
      } else if (uniqueUrls.size === 2) {
        consensus = 'moderate'
      } else {
        consensus = 'weak'
      }

      comparisons.push({
        claim: baseClaim.claim,
        sources: sourceEntries,
        consensus,
      })
    }
  }

  return comparisons.slice(0, 20) // Limit output
}

/**
 * Fact-check a specific claim against available sources.
 */
export function factCheck(
  claim: string,
  sources: ResearchSource[],
): { verified: boolean; confidence: number; evidence: string[] } {
  if (sources.length === 0) {
    return { verified: false, confidence: 0, evidence: [] }
  }

  const claimWords = new Set(
    claim.toLowerCase().split(/\s+/).filter(w => w.length > 3)
  )

  const evidence: string[] = []
  let supportingScore = 0
  let totalWeight = 0

  for (const source of sources) {
    const text = (source.fetchedContent ?? source.snippet).toLowerCase()
    const textWords = new Set(text.split(/\s+/))

    // Count how many claim words appear in the source
    const overlap = [...claimWords].filter(w => textWords.has(w)).length
    const overlapRatio = claimWords.size > 0 ? overlap / claimWords.size : 0

    if (overlapRatio > 0.3) {
      // Find the most relevant sentence
      const sentences = text.split(/[.!?]+/).filter(Boolean)
      let bestSentence = ''
      let bestOverlap = 0

      for (const sentence of sentences) {
        const sentWords = new Set(sentence.split(/\s+/))
        const sentOverlap = [...claimWords].filter(w => sentWords.has(w)).length
        if (sentOverlap > bestOverlap) {
          bestOverlap = sentOverlap
          bestSentence = sentence.trim()
        }
      }

      if (bestSentence) {
        evidence.push(`[${source.title}]: ${bestSentence}`)
      }

      const weight = source.credibilityScore
      supportingScore += overlapRatio * weight
      totalWeight += weight
    }
  }

  const confidence = totalWeight > 0
    ? Math.min(supportingScore / totalWeight, 1)
    : 0

  return {
    verified: confidence > 0.5 && evidence.length >= 2,
    confidence,
    evidence: evidence.slice(0, 5),
  }
}

/**
 * Synthesize a coherent summary from multiple sources.
 */
export function synthesize(sources: ResearchSource[], query: string): string {
  if (sources.length === 0) {
    return `No information available for: "${query}"`
  }

  const ranked = rankSources(sources)
  const sections: string[] = []

  sections.push(`## Summary: ${query}\n`)

  // Collect unique sentences from top sources
  const seenSentences = new Set<string>()
  const uniqueSentences: string[] = []

  for (const source of ranked.slice(0, 8)) {
    const text = source.fetchedContent ?? source.snippet
    const sentences = text
      .split(/[.!?]+/)
      .map(s => s.trim())
      .filter(s => s.length > 20 && s.length < 300)

    for (const sentence of sentences) {
      const normalized = sentence.toLowerCase().replace(/\s+/g, ' ')
      if (!seenSentences.has(normalized)) {
        seenSentences.add(normalized)
        uniqueSentences.push(sentence)
      }
    }
  }

  // Take the most informative sentences
  const keySentences = uniqueSentences.slice(0, 15)
  sections.push(keySentences.join('. ') + '.')

  // Source attribution
  sections.push('\n### Sources')
  for (const src of ranked.slice(0, 10)) {
    sections.push(`- ${src.title} (${src.url})`)
  }

  return sections.join('\n')
}

/**
 * Rank sources by combined credibility and relevance score.
 */
export function rankSources(sources: ResearchSource[]): ResearchSource[] {
  return [...sources].sort((a, b) => {
    const scoreA = a.credibilityScore * 0.6 + a.relevanceScore * 0.4
    const scoreB = b.credibilityScore * 0.6 + b.relevanceScore * 0.4
    return scoreB - scoreA
  })
}

/**
 * Extract key findings from sources.
 */
export function extractKeyFindings(sources: ResearchSource[]): string[] {
  const findings: string[] = []
  const seen = new Set<string>()

  for (const source of sources) {
    const text = source.fetchedContent ?? source.snippet

    // Extract sentences that look like findings/conclusions
    const sentences = text
      .split(/[.!?]+/)
      .map(s => s.trim())
      .filter(s => s.length > 30 && s.length < 200)

    for (const sentence of sentences) {
      const normalized = sentence.toLowerCase().replace(/\s+/g, ' ')
      if (seen.has(normalized)) continue
      seen.add(normalized)

      // Prioritize sentences with factual language
      if (
        /\b(found|showed|revealed|indicates|suggests|demonstrates|confirmed|proved)\b/i.test(sentence) ||
        /\b(is|are|was|were)\s+\d+/i.test(sentence) ||
        /\b(percent|%|increase|decrease|improve|reduce)\b/i.test(sentence)
      ) {
        findings.push(sentence)
      }
    }

    if (findings.length >= 10) break
  }

  return findings.slice(0, 10)
}
