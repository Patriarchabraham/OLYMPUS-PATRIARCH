import { randomUUID } from 'crypto'
import type { InteractionRecord, PromptEvolution } from './types.js'

interface PromptSection {
  name: string
  content: string
  generation: number
  history: PromptEvolution[]
}

export class PromptEvolver {
  private sections = new Map<string, PromptSection>()

  constructor(existing?: PromptEvolution[]) {
    if (existing) {
      const bySection = new Map<string, PromptEvolution[]>()
      for (const evo of existing) {
        const list = bySection.get(evo.sectionName) ?? []
        list.push(evo)
        bySection.set(evo.sectionName, list)
      }

      for (const [name, evolutions] of bySection) {
        const latest = evolutions.reduce((a, b) => (a.generation > b.generation ? a : b))
        this.sections.set(name, {
          name,
          content: latest.evolvedPrompt,
          generation: latest.generation,
          history: evolutions,
        })
      }
    }
  }

  getEvolutions(): PromptEvolution[] {
    const result: PromptEvolution[] = []
    for (const section of this.sections.values()) {
      result.push(...section.history)
    }
    return result
  }

  evolvePrompt(
    sectionName: string,
    currentPrompt: string,
    interactions: InteractionRecord[],
  ): string {
    if (interactions.length < 5) return currentPrompt

    const section = this.sections.get(sectionName) ?? {
      name: sectionName,
      content: currentPrompt,
      generation: 0,
      history: [],
    }

    // Analyze what makes interactions successful
    const successes = interactions.filter(r => r.success)
    const failures = interactions.filter(r => !r.success)

    if (successes.length < 3) return currentPrompt

    // Extract principles from successful interactions
    const successPatterns = this.extractSuccessPrinciples(successes)
    const failurePatterns = this.extractFailureAntiPatterns(failures)

    // Generate evolved prompt
    let evolved = currentPrompt

    // Add learned guidelines
    if (successPatterns.length > 0) {
      evolved += '\n\n## Learned Effective Patterns\n'
      for (const pattern of successPatterns.slice(0, 5)) {
        evolved += `- ${pattern}\n`
      }
    }

    // Add anti-patterns to avoid
    if (failurePatterns.length > 0) {
      evolved += '\n## Patterns to Avoid\n'
      for (const pattern of failurePatterns.slice(0, 3)) {
        evolved += `- ${pattern}\n`
      }
    }

    // Refine existing instructions based on feedback
    evolved = this.refineInstructions(evolved, successes, failures)

    // Record evolution
    const evolution: PromptEvolution = {
      id: randomUUID(),
      sectionName,
      originalPrompt: currentPrompt,
      evolvedPrompt: evolved,
      generation: section.generation + 1,
      effectivenessScore: this.evaluatePromptQuality(evolved, interactions),
      timestamp: Date.now(),
    }

    section.content = evolved
    section.generation = evolution.generation
    section.history.push(evolution)

    // Keep only last 10 generations
    if (section.history.length > 10) {
      section.history = section.history.slice(-10)
    }

    this.sections.set(sectionName, section)
    return evolved
  }

  generatePromptVariant(prompt: string): string {
    // Create a variation by restructuring the prompt
    const lines = prompt.split('\n').filter(l => l.trim())

    // Shuffle non-essential lines while keeping structure
    const headerLines = lines.filter(l => l.startsWith('#'))
    const bulletLines = lines.filter(l => l.startsWith('-'))
    const otherLines = lines.filter(l => !l.startsWith('#') && !l.startsWith('-'))

    // Reorder bullets (prioritize different aspects)
    const shuffledBullets = this.prioritizeBullets(bulletLines)

    return [
      ...headerLines.slice(0, 1),
      '',
      ...otherLines.slice(0, 2),
      ...shuffledBullets,
      ...headerLines.slice(1),
      ...otherLines.slice(2),
    ].join('\n')
  }

  evaluatePromptQuality(prompt: string, testCases: InteractionRecord[]): number {
    if (testCases.length === 0) return 0.5

    // Heuristic evaluation based on prompt characteristics
    let score = 0.5

    // Specificity: more specific instructions tend to perform better
    const specificPhrases = [
      'always', 'never', 'must', 'should', 'avoid',
      'prefer', 'first', 'then', 'ensure', 'verify',
    ]
    const specificCount = specificPhrases.filter(p => prompt.toLowerCase().includes(p)).length
    score += Math.min(specificCount * 0.03, 0.15)

    // Structure: well-structured prompts with headers perform better
    const headers = (prompt.match(/^#{1,3}\s/gm) ?? []).length
    score += Math.min(headers * 0.02, 0.1)

    // Length sweet spot: not too short, not too long
    const wordCount = prompt.split(/\s+/).length
    if (wordCount >= 50 && wordCount <= 2000) {
      score += 0.05
    } else if (wordCount > 2000) {
      score -= 0.05
    }

    // Grounding in data: if prompt references learned patterns, it's better
    if (prompt.includes('Learned Effective Patterns')) {
      score += 0.1
    }

    // Cap between 0 and 1
    return Math.max(0, Math.min(1, score))
  }

  getEvolvedPrompt(sectionName: string): string | null {
    return this.sections.get(sectionName)?.content ?? null
  }

  rollbackPrompt(sectionName: string, generation: number): string | null {
    const section = this.sections.get(sectionName)
    if (!section) return null

    const target = section.history.find(h => h.generation === generation)
    if (!target) return null

    section.content = target.evolvedPrompt
    section.generation = generation

    return target.evolvedPrompt
  }

  private extractSuccessPrinciples(successes: InteractionRecord[]): string[] {
    const principles: string[] = []

    // Analyze tool combinations that work
    const toolCombos = new Map<string, number>()
    for (const record of successes) {
      const key = record.toolsUsed.sort().join(' -> ')
      if (key) {
        toolCombos.set(key, (toolCombos.get(key) ?? 0) + 1)
      }
    }

    const topCombos = [...toolCombos.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)

    for (const [combo, count] of topCombos) {
      if (count >= 2) {
        principles.push(`Tool sequence ${combo} has been effective (${count} successes)`)
      }
    }

    // Analyze strategies that work
    const strategyCounts = new Map<string, number>()
    for (const record of successes) {
      strategyCounts.set(record.strategy, (strategyCounts.get(record.strategy) ?? 0) + 1)
    }

    const topStrategies = [...strategyCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)

    for (const [strategy, count] of topStrategies) {
      if (count >= 3) {
        principles.push(`Strategy '${strategy}' has high success rate (${count} successes)`)
      }
    }

    // Analyze feedback
    const positiveFeedback = successes.filter(r => r.userFeedback === 'positive')
    if (positiveFeedback.length >= 2) {
      principles.push(`User feedback indicates satisfaction with thorough, step-by-step approaches`)
    }

    return principles
  }

  private extractFailureAntiPatterns(failures: InteractionRecord[]): string[] {
    const antiPatterns: string[] = []

    // Common error types
    const errorTypes = new Map<string, number>()
    for (const record of failures) {
      if (record.errorType) {
        errorTypes.set(record.errorType, (errorTypes.get(record.errorType) ?? 0) + 1)
      }
    }

    for (const [errorType, count] of errorTypes) {
      if (count >= 2) {
        antiPatterns.push(`Avoid patterns that lead to '${errorType}' errors (seen ${count} times)`)
      }
    }

    // Tools associated with failures
    const failTools = new Map<string, number>()
    for (const record of failures) {
      for (const tool of record.toolsUsed) {
        failTools.set(tool, (failTools.get(tool) ?? 0) + 1)
      }
    }

    const riskyTools = [...failTools.entries()]
      .filter(([, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)

    for (const [tool, count] of riskyTools) {
      antiPatterns.push(`Be cautious when relying heavily on ${tool} (${count} failures associated)`)
    }

    return antiPatterns
  }

  private refineInstructions(
    prompt: string,
    successes: InteractionRecord[],
    failures: InteractionRecord[],
  ): string {
    // If failures are significantly faster than successes, add patience guidance
    const avgSuccessDuration = successes.reduce((s, r) => s + r.durationMs, 0) / successes.length
    const avgFailDuration = failures.length > 0
      ? failures.reduce((s, r) => s + r.durationMs, 0) / failures.length
      : 0

    if (avgFailDuration > 0 && avgSuccessDuration > avgFailDuration * 1.5) {
      prompt += '\n\n- Take time to verify results before proceeding — rushing leads to errors'
    }

    // If short queries fail more, add guidance for thoroughness
    const shortQueryFailures = failures.filter(r => r.query.split(/\s+/).length < 5)
    if (shortQueryFailures.length > failures.length * 0.6) {
      prompt += '\n\n- For brief requests, clarify scope before executing'
    }

    return prompt
  }

  private prioritizeBullets(bullets: string[]): string[] {
    if (bullets.length <= 1) return bullets

    // Simple reordering: move "important" keywords closer to the top
    const priorityKeywords = ['always', 'must', 'never', 'critical', 'important', 'ensure']

    return [...bullets].sort((a, b) => {
      const aPriority = priorityKeywords.some(kw => a.toLowerCase().includes(kw)) ? 0 : 1
      const bPriority = priorityKeywords.some(kw => b.toLowerCase().includes(kw)) ? 0 : 1
      return aPriority - bPriority
    })
  }
}
