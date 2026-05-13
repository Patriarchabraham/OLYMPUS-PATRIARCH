import { randomUUID } from 'crypto'
import type { ReasoningChain, ReasoningStep, GenerateFn } from './types.js'

const DECOMPOSITION_PROMPT = `Decompose the following problem into a sequence of logical reasoning steps.
For each step, provide:
- type: one of "analysis", "decomposition", "hypothesis", "verification", "synthesis"
- content: the reasoning for this step
- confidence: your confidence in this step (0.0 to 1.0)

Format your response as a JSON array of objects with "type", "content", and "confidence" fields.
End with a final conclusion after the array, prefixed with "CONCLUSION: ".

Problem: `

const STEP_REFINEMENT_PROMPT = `Given the previous reasoning step:
"""
{previous}
"""

And the original problem:
"""
{query}
"""

What is the next logical step? Provide a single JSON object with "type", "content", and "confidence" fields.`

function defaultGenerateFn(_prompt: string): Promise<string> {
  return Promise.resolve(
    JSON.stringify([
      { type: 'analysis', content: 'Analyzing the query to identify key components and requirements', confidence: 0.9 },
      { type: 'decomposition', content: 'Breaking down the problem into manageable sub-problems', confidence: 0.85 },
      { type: 'hypothesis', content: 'Formulating an approach based on the decomposition', confidence: 0.8 },
      { type: 'verification', content: 'Validating the approach against the original requirements', confidence: 0.85 },
    ]) + '\nCONCLUSION: The problem has been analyzed through a structured chain of reasoning.'
  )
}

function parseSteps(raw: string): { steps: ReasoningStep[]; conclusion: string } {
  const steps: ReasoningStep[] = []
  let conclusion = ''

  const conclusionMatch = raw.match(/CONCLUSION:\s*(.+)/s)
  if (conclusionMatch) {
    conclusion = conclusionMatch[1]!.trim()
  }

  // Try to extract JSON array
  const jsonMatch = raw.match(/\[[\s\S]*?\]/)
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]) as Array<{
        type?: string
        content?: string
        confidence?: number
      }>
      const validTypes = new Set(['analysis', 'decomposition', 'hypothesis', 'verification', 'synthesis'])
      for (const item of parsed) {
        steps.push({
          id: randomUUID(),
          type: validTypes.has(item.type ?? '') ? item.type as ReasoningStep['type'] : 'analysis',
          content: item.content ?? '',
          confidence: Math.max(0, Math.min(1, item.confidence ?? 0.5)),
        })
      }
    } catch {
      // If JSON parsing fails, create a single step from the raw text
      steps.push({
        id: randomUUID(),
        type: 'analysis',
        content: raw.replace(/CONCLUSION:.*$/s, '').trim(),
        confidence: 0.5,
      })
    }
  }

  if (!conclusion && steps.length > 0) {
    conclusion = steps[steps.length - 1]!.content
  }

  return { steps, conclusion }
}

export async function runChainOfThought(
  query: string,
  context?: string,
  generateFn?: GenerateFn,
): Promise<ReasoningChain> {
  const generate = generateFn ?? defaultGenerateFn
  const startTime = Date.now()

  // Build the prompt with optional context
  const fullQuery = context ? `Context: ${context}\n\n${query}` : query
  const prompt = DECOMPOSITION_PROMPT + fullQuery

  const raw = await generate(prompt)
  const { steps, conclusion } = parseSteps(raw)

  // If we got very few steps, try to refine with follow-up
  if (steps.length < 2) {
    const refinementPrompt = STEP_REFINEMENT_PROMPT
      .replace('{previous}', steps[0]?.content ?? 'initial analysis')
      .replace('{query}', fullQuery)
    const refinement = await generate(refinementPrompt)
    const refined = parseSteps(refinement)
    steps.push(...refined.steps)
    if (!conclusion && refined.conclusion) {
      // use refined conclusion
    }
  }

  // Calculate overall confidence as weighted average
  const overallConfidence = steps.length > 0
    ? steps.reduce((sum, s) => sum + s.confidence, 0) / steps.length
    : 0.5

  return {
    id: randomUUID(),
    strategy: 'cot',
    query,
    steps,
    conclusion: conclusion || 'Analysis complete through chain-of-thought reasoning.',
    confidence: overallConfidence,
    durationMs: Date.now() - startTime,
    timestamp: Date.now(),
  }
}
