/**
 * MultiPassReasoner — Iterative reasoning across strategies (CoT → ToT → Reflect).
 * Uses GenerateFn callback pattern compatible with existing reasoning module.
 */

import type { DecomposedQuery, ReasoningPass, ReasoningStrategy } from './types.js'
import type { GenerateFn } from '../reasoning/types.js'

/** Default placeholder generate function for when no LLM is connected */
const placeholderGenerate: GenerateFn = async (prompt: string): Promise<string> => {
  // Heuristic analysis without LLM
  const words = prompt.split(/\s+/)
  const hasQuestion = prompt.includes('?')
  const hasCode = /```|function|class|import|export/.test(prompt)
  const wordCount = words.length

  const parts: string[] = []
  parts.push(`Analysis of ${wordCount}-word ${hasCode ? 'code-related' : 'conceptual'} query.`)

  if (hasQuestion) {
    parts.push('Query identified as interrogative — extracting core question.')
  }

  if (hasCode) {
    parts.push('Code patterns detected — applying structural analysis.')
  }

  parts.push(`Key concepts identified: ${words.slice(0, Math.min(10, words.length)).join(', ')}.`)
  parts.push('Initial assessment: requires deeper analysis across multiple dimensions.')

  return parts.join(' ')
}

/**
 * Run multi-pass reasoning on a query, escalating strategy if confidence is low.
 *
 * Flow: CoT → (if low confidence) ToT → (if still low) Self-Reflection
 */
export async function reason(
  query: string,
  subQueries: DecomposedQuery[],
  maxPasses: number,
  generateFn?: GenerateFn,
): Promise<ReasoningPass[]> {
  const generate = generateFn ?? placeholderGenerate
  const passes: ReasoningPass[] = []

  // Combine sub-queries into full context
  const fullContext = subQueries.length > 1
    ? `${query}\n\nSub-queries:\n${subQueries.map((sq) => `- [${sq.type}] ${sq.query}`).join('\n')}`
    : query

  // Pass 1: Chain-of-thought
  const pass1 = await runPass(1, 'cot', fullContext, generate, [])
  passes.push(pass1)

  // Pass 2: Tree-of-thought on gaps (if needed)
  if (pass1.confidenceDelta < 0.7 && maxPasses >= 2) {
    const gapContext = buildGapContext(fullContext, pass1)
    const pass2 = await runPass(2, 'tot', gapContext, generate, [pass1])
    passes.push(pass2)

    // Pass 3: Self-reflection on all previous (if still needed)
    if (pass2.confidenceDelta < 0.7 && maxPasses >= 3) {
      const reflectContext = buildReflectContext(fullContext, passes)
      const pass3 = await runPass(3, 'reflect', reflectContext, generate, passes)
      passes.push(pass3)
    }
  }

  return passes
}

/**
 * Run a single reasoning pass using the specified strategy.
 */
async function runPass(
  passNumber: number,
  strategy: ReasoningStrategy,
  input: string,
  generate: GenerateFn,
  previousPasses: ReasoningPass[],
): Promise<ReasoningPass> {
  const startTime = Date.now()

  const prompt = buildStrategyPrompt(strategy, input, previousPasses)
  const output = await generate(prompt)

  const gaps = extractGaps(output)
  const confidenceDelta = estimateConfidence(output, strategy)
  const refinement = describeRefinement(strategy, passNumber, previousPasses)

  return {
    passNumber,
    strategy,
    input,
    output,
    gaps,
    refinement,
    confidenceDelta,
    durationMs: Date.now() - startTime,
  }
}

/**
 * Build a strategy-specific prompt for the LLM.
 */
function buildStrategyPrompt(strategy: ReasoningStrategy, input: string, previous: ReasoningPass[]): string {
  switch (strategy) {
    case 'cot':
      return `Think step by step through this problem. Break down your reasoning into clear logical steps.\n\n${input}\n\nProvide your analysis, identify any gaps in understanding, and state your confidence level (0-1).`

    case 'tot':
      return `Explore multiple distinct approaches to this problem. For each approach:\n1. Describe the approach\n2. Evaluate its strengths and weaknesses\n3. Rate its likelihood of success (0-1)\n\nPrevious analysis gaps: ${previous.map((p) => p.gaps.join(', ')).join('; ') || 'none'}\n\n${input}\n\nAfter exploring approaches, recommend the best one and identify remaining unknowns.`

    case 'reflect':
      return `Critically review the following analyses and identify improvements:\n\n${previous.map((p) => `[${p.strategy.toUpperCase()} Pass ${p.passNumber}]: ${p.output}`).join('\n\n')}\n\nOriginal query: ${input}\n\nProvide:\n1. Critique of previous analyses\n2. Improved synthesis\n3. Remaining gaps\n4. Confidence level (0-1)`

    case 'ensemble':
      return `Provide a comprehensive multi-perspective analysis:\n\n${input}\n\nConsider:\n- Technical correctness\n- Edge cases and failure modes\n- Alternative approaches\n- Trade-offs\n\nEnd with a confidence score (0-1) and list of remaining unknowns.`

    default:
      return `Analyze the following thoroughly:\n\n${input}`
  }
}

/**
 * Build context for ToT pass focusing on gaps from CoT.
 */
function buildGapContext(originalQuery: string, previousPass: ReasoningPass): string {
  const gaps = previousPass.gaps.length > 0
    ? `Key gaps from initial analysis:\n${previousPass.gaps.map((g) => `- ${g}`).join('\n')}`
    : 'No explicit gaps identified in initial analysis.'
  return `${originalQuery}\n\n${gaps}\n\nExplore alternative approaches to address these gaps.`
}

/**
 * Build context for reflection pass incorporating all previous passes.
 */
function buildReflectContext(originalQuery: string, passes: ReasoningPass[]): string {
  const summaries = passes.map((p) =>
    `[Pass ${p.passNumber} (${p.strategy})]: ${p.output.substring(0, 500)}...\nGaps: ${p.gaps.join(', ') || 'none'}\nConfidence: ${p.confidenceDelta.toFixed(2)}`
  ).join('\n\n')

  return `${originalQuery}\n\nPrevious analyses:\n${summaries}\n\nCritically evaluate all analyses above. Identify contradictions, synthesize findings, and provide a final refined analysis.`
}

/**
 * Extract gap indicators from LLM output.
 */
function extractGaps(output: string): string[] {
  const gaps: string[] = []
  const lower = output.toLowerCase()

  // Detect explicit gap statements
  const gapPatterns = [
    /(?:unknown|unclear|uncertain|not sure|uncertain)(?:\s+about)?\s+([^.?\n]+)/gi,
    /(?:gap|missing|lack(?:ing)?|need\s+(?:more|to\s+know))\s+([^.?\n]+)/gi,
    /(?:however|but|limitation|caveat)[:\s]+([^.?\n]+)/gi,
  ]

  for (const pattern of gapPatterns) {
    let match: RegExpExecArray | null
    while ((match = pattern.exec(lower)) !== null) {
      const gap = match[1]?.trim()
      if (gap && gap.length > 5 && gap.length < 200) {
        gaps.push(gap)
      }
    }
  }

  return gaps.slice(0, 5) // Cap at 5 gaps
}

/**
 * Estimate confidence from output text.
 */
function estimateConfidence(output: string, _strategy: ReasoningStrategy): number {
  const lower = output.toLowerCase()

  // Look for explicit confidence statements
  const explicitMatch = lower.match(/confidence[:\s]+(\d+\.?\d*)/i)
  if (explicitMatch) {
    const val = parseFloat(explicitMatch[1])
    return val <= 1 ? val : val / 100
  }

  // Heuristic: count certainty vs uncertainty indicators
  const certaintyWords = (lower.match(/\bcertain|definitive|clear|confident|established|proven|verified\b/g) || []).length
  const uncertaintyWords = (lower.match(/\buncertain|unclear|maybe|possibly|might|could|perhaps|unknown\b/g) || []).length
  const total = certaintyWords + uncertaintyWords

  if (total === 0) return 0.5

  const baseConfidence = certaintyWords / total
  // Longer, more detailed outputs tend to be more thorough
  const lengthBonus = Math.min(output.length / 1000, 0.15)

  return Math.min(baseConfidence + lengthBonus, 1)
}

/**
 * Describe what this pass refines compared to previous.
 */
function describeRefinement(strategy: ReasoningStrategy, passNumber: number, previous: ReasoningPass[]): string {
  if (passNumber === 1) {
    return 'Initial chain-of-thought analysis establishing baseline understanding'
  }

  const prevGaps = previous.flatMap((p) => p.gaps)
  const gapSummary = prevGaps.length > 0 ? `; addressing ${prevGaps.length} identified gaps` : ''

  switch (strategy) {
    case 'tot':
      return `Exploring alternative thought paths to find better solutions${gapSummary}`
    case 'reflect':
      return `Critical self-reflection on ${previous.length} previous passes${gapSummary}`
    case 'ensemble':
      return `Multi-perspective ensemble analysis combining all insights${gapSummary}`
    default:
      return `Additional ${strategy} pass for refinement${gapSummary}`
  }
}
