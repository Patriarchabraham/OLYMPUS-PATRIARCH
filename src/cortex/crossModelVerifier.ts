/**
 * CrossModelVerifier — Verifies primary model output against a second model.
 * Uses Jaccard similarity for agreement scoring. Returns null result if not configured.
 */

import type { CrossModelResult } from './types.js'

/**
 * Verify primary model output by comparing with a second model's response.
 * If no verification model is configured, returns a null-like result with high confidence.
 */
export async function verify(
  query: string,
  primaryOutput: string,
  verificationModel?: string,
): Promise<CrossModelResult> {
  const startTime = Date.now()

  // If no verification model, return skip result
  if (!verificationModel) {
    return {
      modelName: 'none',
      provider: 'none',
      response: '',
      confidence: 0.8,
      agreementWithPrimary: 1.0,
      uniqueInsights: [],
      contradictions: [],
      durationMs: Date.now() - startTime,
    }
  }

  try {
    // Route to verification model via existing provider system
    const verificationResponse = await callVerificationModel(query, verificationModel)

    // Compare outputs
    const agreement = computeJaccardSimilarity(primaryOutput, verificationResponse)
    const { uniqueInsights, contradictions } = extractDifferences(primaryOutput, verificationResponse)

    return {
      modelName: verificationModel,
      provider: 'configured',
      response: verificationResponse,
      confidence: agreement > 0.6 ? 0.8 : agreement > 0.3 ? 0.6 : 0.4,
      agreementWithPrimary: agreement,
      uniqueInsights,
      contradictions,
      durationMs: Date.now() - startTime,
    }
  } catch (err) {
    return {
      modelName: verificationModel,
      provider: 'error',
      response: '',
      confidence: 0.5,
      agreementWithPrimary: 0.5,
      uniqueInsights: [],
      contradictions: [`Verification failed: ${err instanceof Error ? err.message : String(err)}`],
      durationMs: Date.now() - startTime,
    }
  }
}

/**
 * Call verification model. Placeholder — will be wired to actual provider in Phase 4 integration.
 */
async function callVerificationModel(query: string, _model: string): Promise<string> {
  // This will be replaced with actual provider routing in integration phase.
  // For now, return a structured placeholder indicating verification was attempted.
  return `Verification analysis for: ${query.substring(0, 200)}. Cross-model verification pending provider wiring.`
}

/**
 * Compute Jaccard similarity between two texts (word-level).
 */
function computeJaccardSimilarity(a: string, b: string): number {
  const setA = new Set(tokenize(a))
  const setB = new Set(tokenize(b))

  if (setA.size === 0 && setB.size === 0) return 1.0
  if (setA.size === 0 || setB.size === 0) return 0.0

  let intersection = 0
  for (const word of setA) {
    if (setB.has(word)) intersection++
  }

  const union = setA.size + setB.size - intersection
  return union > 0 ? intersection / union : 0
}

/**
 * Tokenize text into lowercase words for comparison.
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 3) // Skip short words
}

/**
 * Extract unique insights and contradictions between two model outputs.
 */
function extractDifferences(primary: string, secondary: string): {
  uniqueInsights: string[]
  contradictions: string[]
} {
  const primarySentences = splitSentences(primary)
  const secondarySentences = splitSentences(secondary)
  const uniqueInsights: string[] = []
  const contradictions: string[] = []

  const primaryTerms = new Set(primarySentences.flatMap((s) => tokenize(s)))
  const negationPattern = /\bnot\b|\bnever\b|\bcannot\b|\bno\b|\bunable\b|\bimpossible\b/i

  for (const sentence of secondarySentences) {
    const terms = tokenize(sentence)
    const overlap = terms.filter((t) => primaryTerms.has(t))
    const overlapRatio = terms.length > 0 ? overlap.length / terms.length : 0

    if (overlapRatio < 0.3 && sentence.length > 20) {
      uniqueInsights.push(truncate(sentence, 150))
    } else if (negationPattern.test(sentence) && overlapRatio > 0.4) {
      contradictions.push(truncate(sentence, 150))
    }
  }

  return {
    uniqueInsights: uniqueInsights.slice(0, 5),
    contradictions: contradictions.slice(0, 5),
  }
}

/**
 * Split text into sentences.
 */
function splitSentences(text: string): string[] {
  return text
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 10)
}

function truncate(str: string, maxLen: number): string {
  return str.length <= maxLen ? str : str.substring(0, maxLen) + '...'
}
