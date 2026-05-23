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

/** Template-based fallback that analyzes the actual query. */
function defaultGenerateFn(prompt: string): Promise<string> {
  // Inline smart template to avoid circular/async import at module load
  return smartTemplateFallback(prompt)
}

/**
 * Smart template-based CoT fallback using actual query content.
 */
function smartTemplateFallback(prompt: string): Promise<string> {
  const problem = extractProblem(prompt)
  const keywords = extractTopKeywords(problem)
  const queryType = detectQueryType(problem)

  const steps = [
    {
      type: 'analysis',
      content: `Identified query type as "${queryType}" with key components: ${keywords.slice(0, 5).join(', ') || 'general inquiry'}`,
      confidence: 0.85,
    },
    {
      type: 'decomposition',
      content: `Breaking down the ${queryType} problem into core sub-tasks based on identified requirements and constraints`,
      confidence: 0.80,
    },
    {
      type: 'hypothesis',
      content: `Formulating approach for ${queryType}: address each component systematically`,
      confidence: 0.75,
    },
    {
      type: 'verification',
      content: `Validating approach against original requirements: checking completeness and edge cases`,
      confidence: 0.80,
    },
  ]

  const conclusion = `The ${queryType} problem has been analyzed. Key insight: focus on ${keywords[0] || 'the primary concern'} as the starting point.`

  return Promise.resolve(JSON.stringify(steps) + '\nCONCLUSION: ' + conclusion)
}

function extractProblem(prompt: string): string {
  const idx = prompt.indexOf('Problem: ')
  if (idx !== -1) return prompt.slice(idx + 9).trim()
  const parts = prompt.split('\n\n').filter(Boolean)
  return parts[parts.length - 1]?.trim() ?? prompt.slice(-500)
}

function detectQueryType(text: string): string {
  const lower = text.toLowerCase()
  if (/\b(bug|error|fix|crash|fail)\b/.test(lower)) return 'debugging'
  if (/\b(design|architect|plan|system|structure)\b/.test(lower)) return 'architecture'
  if (/\b(perform|speed|optim|fast|slow)\b/.test(lower)) return 'performance'
  if (/\b(secur|vulnerab|auth|encrypt)\b/.test(lower)) return 'security'
  if (/\b(test|verif|valid|assert)\b/.test(lower)) return 'verification'
  if (/\b(implement|build|create|add)\b/.test(lower)) return 'implementation'
  return 'general'
}

function extractTopKeywords(text: string): string[] {
  const stopWords = new Set(['the','a','an','is','are','was','were','be','been','have','has','had','do','does','did','will','would','could','should','to','of','in','for','on','with','at','by','from','as','into','through','and','or','if','not','this','that','it','i','me','my','we','our','you','your','but','about'])
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/)
    .filter(w => w.length > 2 && !stopWords.has(w))
    .filter((w, i, a) => a.indexOf(w) === i)
    .slice(0, 10)
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
