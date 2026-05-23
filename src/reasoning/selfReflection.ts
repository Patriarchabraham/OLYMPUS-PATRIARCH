import { randomUUID } from 'crypto'
import type { ReasoningChain, ReasoningStep, ReflectionResult, GenerateFn } from './types.js'

const INITIAL_RESPONSE_PROMPT = `Provide a thorough and well-reasoned response to the following:

`

const CRITIQUE_PROMPT = `Critique the following response. Identify specific weaknesses, logical gaps, unsupported claims, or areas that could be improved.
Be constructive and specific. Format as a numbered list of issues.

Original question:
"""
{query}
"""

Response to critique:
"""
{response}
"""

List of issues:`

const IMPROVEMENT_PROMPT = `Based on this critique, provide an improved response to the original question.

Original question:
"""
{query}
"""

Previous response:
"""
{response}
"""

Critique:
"""
{critique}
"""

Provide the improved response:`

const CONVERGENCE_CHECK_PROMPT = `Compare these two versions of a response. Rate their similarity on a scale of 0.0 to 1.0, where 1.0 means they are essentially identical.

Version A:
"""
{versionA}
"""

Version B:
"""
{versionB}
"""

Similarity score (0.0-1.0):`

const DEFAULT_MAX_ITERATIONS = 3
const CONVERGENCE_THRESHOLD = 0.9

/** Template-based fallback that generates reflection from the actual query. */
function defaultGenerateFn(prompt: string): Promise<string> {
  const problem = extractProblem(prompt)
  const queryType = detectQueryType(problem)

  // Detect which phase is calling
  if (prompt.includes('Critique the following response')) {
    return Promise.resolve(
      '1. The analysis could benefit from more specific examples or concrete steps\n' +
      '2. Edge cases and failure modes should be explicitly addressed\n' +
      '3. Alternative approaches were not fully explored\n' +
      '4. The reasoning could be strengthened with quantitative evidence'
    )
  }

  if (prompt.includes('Based on this critique')) {
    return Promise.resolve(
      `Improved analysis for the ${queryType} problem: After considering the critique, the refined approach ` +
      'addresses gaps by incorporating specific examples, explicitly handling edge cases, ' +
      'and providing more rigorous validation at each step.'
    )
  }

  if (prompt.includes('Rate their similarity')) {
    return Promise.resolve('0.75')
  }

  // Initial response
  return Promise.resolve(
    `Analysis of the ${queryType} problem reveals several key considerations. ` +
    'The approach should be systematic, addressing each component in order of priority. ' +
    `Special attention should be paid to ${queryType === 'debugging' ? 'root cause identification' : 'correctness and maintainability'}.`
  )
}

function extractProblem(prompt: string): string {
  const markers = ['Original question:\n', 'Problem: ']
  for (const m of markers) {
    const idx = prompt.indexOf(m)
    if (idx !== -1) return prompt.slice(idx + m.length).split('\n')[0]?.trim() ?? ''
  }
  return prompt.slice(-300)
}

function detectQueryType(text: string): string {
  const lower = text.toLowerCase()
  if (/\b(bug|error|fix|crash|fail)\b/.test(lower)) return 'debugging'
  if (/\b(design|architect|plan|system)\b/.test(lower)) return 'architecture'
  if (/\b(secur|vulnerab|auth|encrypt)\b/.test(lower)) return 'security'
  if (/\b(test|verif|valid|assert)\b/.test(lower)) return 'verification'
  return 'general'
}

function parseSimilarity(raw: string): number {
  const match = raw.match(/(\d+\.?\d*)/)
  if (match) {
    return Math.max(0, Math.min(1, parseFloat(match[1]!)))
  }
  return 0.5
}

function extractCritiquePoints(raw: string): string[] {
  const lines = raw.split('\n').filter(l => l.trim())
  return lines
    .map(l => l.replace(/^\d+[\.\)]\s*/, '').trim())
    .filter(l => l.length > 10)
}

export async function runSelfReflection(
  query: string,
  context?: string,
  maxIterations?: number,
  generateFn?: GenerateFn,
): Promise<ReasoningChain> {
  const generate = generateFn ?? defaultGenerateFn
  const maxIter = maxIterations ?? DEFAULT_MAX_ITERATIONS
  const startTime = Date.now()

  const fullQuery = context ? `Context: ${context}\n\n${query}` : query

  // Phase 1: Generate initial response
  let currentResponse = await generate(INITIAL_RESPONSE_PROMPT + fullQuery)

  const reflectionHistory: ReflectionResult[] = []
  let converged = false

  // Phase 2: Iterate — critique, improve, check convergence
  for (let i = 0; i < maxIter; i++) {
    // Critique
    const critiquePrompt = CRITIQUE_PROMPT
      .replace('{query}', fullQuery)
      .replace('{response}', currentResponse)
    const critiqueRaw = await generate(critiquePrompt)
    const critiquePoints = extractCritiquePoints(critiqueRaw)

    // Improve
    const improvePrompt = IMPROVEMENT_PROMPT
      .replace('{query}', fullQuery)
      .replace('{response}', currentResponse)
      .replace('{critique}', critiqueRaw)
    const improvedResponse = await generate(improvePrompt)

    // Check convergence (skip on last iteration)
    let similarity = 0
    if (i < maxIter - 1) {
      const convergencePrompt = CONVERGENCE_CHECK_PROMPT
        .replace('{versionA}', currentResponse)
        .replace('{versionB}', improvedResponse)
      const similarityRaw = await generate(convergencePrompt)
      similarity = parseSimilarity(similarityRaw)

      if (similarity >= CONVERGENCE_THRESHOLD) {
        converged = true
        currentResponse = improvedResponse
        reflectionHistory.push({
          originalOutput: currentResponse,
          critique: critiquePoints.join('; '),
          improvedOutput: improvedResponse,
          iterationCount: i + 1,
          converged: true,
        })
        break
      }
    }

    reflectionHistory.push({
      originalOutput: currentResponse,
      critique: critiquePoints.join('; '),
      improvedOutput: improvedResponse,
      iterationCount: i + 1,
      converged: false,
    })

    currentResponse = improvedResponse
  }

  // Build reasoning chain from reflection history
  const steps: ReasoningStep[] = []

  // Initial analysis step
  steps.push({
    id: randomUUID(),
    type: 'analysis',
    content: 'Generated initial response to the query',
    confidence: 0.6,
  })

  // One step per reflection iteration
  for (const result of reflectionHistory) {
    const critiquePoints = result.critique.split('; ').filter(Boolean)
    steps.push({
      id: randomUUID(),
      type: 'verification',
      content: `Reflection iteration ${result.iterationCount}: identified ${critiquePoints.length} improvement areas`,
      confidence: 0.7 + (result.iterationCount * 0.1),
      metadata: { critiquePoints, converged: result.converged },
    })

    steps.push({
      id: randomUUID(),
      type: 'synthesis',
      content: `Applied improvements based on critique`,
      confidence: 0.75 + (result.iterationCount * 0.05),
    })
  }

  // Final synthesis
  steps.push({
    id: randomUUID(),
    type: 'synthesis',
    content: converged
      ? 'Response converged through self-reflection — further iterations yield diminishing returns'
      : `Completed ${reflectionHistory.length} reflection iterations without full convergence`,
    confidence: converged ? 0.95 : 0.8,
  })

  const overallConfidence = steps.length > 0
    ? steps.reduce((sum, s) => sum + s.confidence, 0) / steps.length
    : 0.5

  return {
    id: randomUUID(),
    strategy: 'reflect',
    query,
    steps,
    conclusion: currentResponse,
    confidence: overallConfidence,
    durationMs: Date.now() - startTime,
    timestamp: Date.now(),
    metadata: {
      iterations: reflectionHistory.length,
      converged,
      reflectionHistory: reflectionHistory.map(r => ({
        iteration: r.iterationCount,
        converged: r.converged,
      })),
    },
  }
}
