import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { randomUUID } from 'crypto'
import { EffectivenessTracker } from './effectivenessTracker.js'
import { PatternLearner } from './patternLearner.js'
import { ToolOptimizer } from './toolOptimizer.js'
import { PromptEvolver } from './promptEvolver.js'
import type {
  InteractionRecord,
  Pattern,
  PromptEvolution,
  ToolUsageStats,
  EvolutionReport,
  ToolRecommendation,
  EvolutionConfig,
} from './types.js'

const DEFAULT_CONFIG: EvolutionConfig = {
  maxInteractions: 5000,
  minSampleSize: 3,
  evolutionIntervalMs: 30 * 60 * 1000, // 30 minutes
  maxPatterns: 50,
  dataDir: '',
}

interface SerializedState {
  interactions: InteractionRecord[]
  patterns: Pattern[]
  promptEvolutions: [string, PromptEvolution][]
  toolStats: [string, ToolUsageStats][]
  lastEvolutionTimestamp: number
  evolutionCount: number
}

export class EvolutionEngine {
  private config: EvolutionConfig
  private tracker: EffectivenessTracker
  private learner: PatternLearner
  private optimizer: ToolOptimizer
  private evolver: PromptEvolver
  private lastEvolutionTimestamp = 0
  private evolutionCount = 0
  private dirty = false

  private constructor(config: EvolutionConfig) {
    this.config = config
    this.tracker = new EffectivenessTracker()
    this.learner = new PatternLearner()
    this.optimizer = new ToolOptimizer()
    this.evolver = new PromptEvolver()
  }

  static async init(dataDir?: string): Promise<EvolutionEngine> {
    const dir = dataDir ?? ''
    const config = { ...DEFAULT_CONFIG, dataDir: dir }
    const engine = new EvolutionEngine(config)

    if (dir) {
      await engine.load()
    }

    return engine
  }

  trackInteraction(record: Omit<InteractionRecord, 'id'>): InteractionRecord {
    const full: InteractionRecord = {
      ...record,
      id: randomUUID(),
    }

    this.tracker.recordInteraction(full)
    this.tracker.pruneOlderThan(this.config.maxInteractions)
    this.dirty = true

    return full
  }

  async evolve(): Promise<{
    patternsLearned: number
    promptEvolutions: number
    toolInsights: string[]
  }> {
    const interactions = this.tracker.getInteractions()

    // Learn patterns
    const newPatterns = this.learner.updatePatterns(interactions)

    // Update tool optimizer data
    this.optimizer.setInteractions(interactions)

    // Analyze tool combinations
    const comboResults = this.optimizer.analyzeToolCombinations()
    const toolInsights: string[] = []
    for (const [combo, data] of comboResults) {
      if (data.rate >= 0.8 && data.uses >= 3) {
        toolInsights.push(`Strong combination: ${combo} (${(data.rate * 100).toFixed(0)}% success, ${data.uses} uses)`)
      }
    }

    // Identify underperforming tools
    const underperformers = this.optimizer.identifyUnderperformingTools()
    for (const { tool, successRate, uses } of underperformers) {
      toolInsights.push(`Underperforming: ${tool} (${(successRate * 100).toFixed(0)}% success, ${uses} uses)`)
    }

    // Evolve prompts (only for sections that have enough data)
    let promptEvolutionCount = 0
    if (interactions.length >= 10) {
      // We don't evolve specific prompts here — that's done via evolvePrompt()
      // with explicit section names. Just count existing evolutions.
      promptEvolutionCount = this.evolver.getEvolutions().length
    }

    this.lastEvolutionTimestamp = Date.now()
    this.evolutionCount++
    this.dirty = true

    return {
      patternsLearned: newPatterns.length,
      promptEvolutions: promptEvolutionCount,
      toolInsights,
    }
  }

  getRecommendations(query: string): {
    strategy: string | null
    tools: ToolRecommendation[]
    pattern: Pattern | null
  } {
    const pattern = this.learner.matchPattern(query)
    const tools = this.optimizer.recommendToolsForTask(query)

    let strategy: string | null = null
    if (pattern) {
      strategy = pattern.recommendedStrategy
    }

    // Also consider recent trends
    const trends = this.tracker.getRecentTrends(24 * 60 * 60 * 1000) // last 24h
    if (!strategy && trends.topStrategies.length > 0) {
      strategy = trends.topStrategies[0]!
    }

    return { strategy, tools, pattern }
  }

  getEvolutionReport(): EvolutionReport {
    const interactions = this.tracker.getInteractions()
    const patterns = this.learner.getPatterns()
    const evolutions = this.evolver.getEvolutions()
    const trends = this.tracker.getRecentTrends(24 * 60 * 60 * 1000)

    const toolInsights: string[] = []
    const underperformers = this.optimizer.identifyUnderperformingTools()
    for (const { tool, successRate } of underperformers) {
      toolInsights.push(`${tool}: ${(successRate * 100).toFixed(0)}% success rate`)
    }

    const comboResults = this.optimizer.analyzeToolCombinations()
    const topCombos = [...comboResults.entries()]
      .sort((a, b) => b[1].rate * b[1].uses - a[1].rate * a[1].uses)
      .slice(0, 3)
    for (const [combo, data] of topCombos) {
      toolInsights.push(`${combo}: ${(data.rate * 100).toFixed(0)}% (${data.uses} uses)`)
    }

    return {
      totalInteractions: interactions.length,
      overallSuccessRate: this.tracker.calculateOverallEffectiveness(),
      patternsLearned: patterns.length,
      promptEvolutions: evolutions.length,
      topPatterns: patterns.slice(0, 5),
      toolInsights,
      evolutionCount: this.evolutionCount,
      lastEvolution: this.lastEvolutionTimestamp,
    }
  }

  evolvePrompt(sectionName: string, currentPrompt: string): string {
    const interactions = this.tracker.getInteractions()
    return this.evolver.evolvePrompt(sectionName, currentPrompt, interactions)
  }

  getEvolvedPrompt(sectionName: string): string | null {
    return this.evolver.getEvolvedPrompt(sectionName)
  }

  // Persistence
  async save(): Promise<void> {
    if (!this.config.dataDir) return

    const dir = join(this.config.dataDir, 'evolution')
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true })
    }

    const interactions = this.tracker.getInteractions()
    const patterns = this.learner.getPatterns()
    const evolutions = this.evolver.getEvolutions()
    const toolStats = this.tracker.getAllToolStats()

    const state: SerializedState = {
      interactions,
      patterns,
      promptEvolutions: evolutions.map(e => [e.sectionName, e] as [string, PromptEvolution]),
      toolStats: [...toolStats.entries()],
      lastEvolutionTimestamp: this.lastEvolutionTimestamp,
      evolutionCount: this.evolutionCount,
    }

    const filePath = join(dir, 'state.json')
    writeFileSync(filePath, JSON.stringify(state), 'utf-8')
    this.dirty = false
  }

  async load(): Promise<void> {
    if (!this.config.dataDir) return

    const filePath = join(this.config.dataDir, 'evolution', 'state.json')
    if (!existsSync(filePath)) return

    try {
      const raw = readFileSync(filePath, 'utf-8')
      const state: SerializedState = JSON.parse(raw)

      // Restore tracker
      this.tracker = new EffectivenessTracker(state.interactions)

      // Restore learner
      this.learner = new PatternLearner(state.patterns)

      // Restore optimizer
      this.optimizer = new ToolOptimizer(state.interactions)

      // Restore evolver
      const evolutions = state.promptEvolutions.map(([, evo]) => evo)
      this.evolver = new PromptEvolver(evolutions)

      this.lastEvolutionTimestamp = state.lastEvolutionTimestamp
      this.evolutionCount = state.evolutionCount
      this.dirty = false
    } catch {
      // Corrupted state — start fresh
    }
  }

  isDirty(): boolean {
    return this.dirty
  }

  getTracker(): EffectivenessTracker {
    return this.tracker
  }

  getLearner(): PatternLearner {
    return this.learner
  }

  getOptimizer(): ToolOptimizer {
    return this.optimizer
  }

  getEvolverInstance(): PromptEvolver {
    return this.evolver
  }
}

// Convenience singleton for global use
let _instance: EvolutionEngine | null = null

export async function getEvolutionEngine(dataDir?: string): Promise<EvolutionEngine> {
  if (!_instance) {
    _instance = await EvolutionEngine.init(dataDir)
  }
  return _instance
}

export function resetEvolutionEngine(): void {
  _instance = null
}
