/**
 * QuantumEngine — Orchestrator for real quantum computing operations.
 *
 * Full pipeline using actual quantum mechanics:
 * 1. SUPERPOSE: Encode reasoning states as complex amplitudes via Hadamard gates
 * 2. EVALUATE: Score via Born rule probability measurement
 * 3. PRUNE: Keep highest-probability states
 * 4. ENTANGLE: Create Bell states between correlated dimensions, measure concurrence
 * 5. PROPAGATE: Boost confidence proportional to real entanglement strength
 * 6. COLLAPSE: Born rule projective measurement → definite solution
 * 7. TUNNEL: Discrete-time quantum walk for barrier bypass
 *
 * Usage:
 *   const engine = new QuantumEngine()
 *   const analysis = await engine.process("How to design a secure, fast API?")
 *   console.log(analysis.collapseResult?.collapsedState.solution)
 *   console.log(`Born probability: ${analysis.collapseResult?.bornProbability}`)
 *   console.log(`Entanglement concurrence: ${analysis.entanglements[0]?.concurrence}`)
 */

import { randomUUID } from 'crypto'
import type {
  QuantumConfig,
  QuantumAnalysis,
  QuantumReasoningState,
  EntanglementLink,
  CollapseResult,
  TunnelResult,
} from './types.js'
import { DEFAULT_QUANTUM_CONFIG } from './types.js'
import { superpose, evaluateStates, pruneStates, getBestState } from './superposition.js'
import { entangle, propagateConfidence, generateCrossInsights } from './entanglement.js'
import { collapse, forceCollapse } from './collapse.js'
import { detectBarriers, tunnel } from './tunneling.js'

export class QuantumEngine {
  private config: QuantumConfig
  private analysisHistory: QuantumAnalysis[] = []
  private patternMemory: Map<string, number> = new Map()

  constructor(config?: Partial<QuantumConfig>) {
    this.config = { ...DEFAULT_QUANTUM_CONFIG, ...config }
  }

  /**
   * Process a query through the full quantum pipeline.
   * Each step uses real quantum operations on state vectors with complex amplitudes.
   */
  async process(query: string): Promise<QuantumAnalysis> {
    const startTime = Date.now()

    // Step 1: Superpose — encode candidates as real quantum amplitudes
    let states = superpose(query, this.config)

    // Step 2: Evaluate — score via quantum measurement (Born rule)
    states = evaluateStates(states)

    // Step 3: Prune — keep highest-probability states
    states = pruneStates(states, 2)

    // Step 4: Entangle — create real Bell states, measure concurrence
    let entanglements: EntanglementLink[] = entangle(
      states,
      this.config.entanglementThreshold,
    )

    // Step 5: Propagate — boost via real entanglement strength
    states = propagateConfidence(states, entanglements)

    // Step 6: Collapse — Born rule projective measurement
    let collapseResult: CollapseResult | null = collapse(
      states,
      entanglements,
      this.config,
    )

    // Step 7: Tunnel — quantum walk if barriers exist
    let tunnelResults: TunnelResult[] = []
    const barriers = detectBarriers(states)
    if (barriers.length > 0 && this.config.tunnelingEnabled) {
      tunnelResults = tunnel(query, barriers, this.config.maxTunnelAttempts)

      // If tunneling found paths, retry collapse
      if (!collapseResult && tunnelResults.some(t => t.confidence > 0.6)) {
        collapseResult = forceCollapse(states, entanglements, this.config)
      }
    }

    const analysis: QuantumAnalysis = {
      id: `qa_${randomUUID().slice(0, 8)}`,
      query,
      states,
      entanglements,
      collapseResult,
      tunnelResults,
      confidence: collapseResult?.confidence ?? calculateAverageConfidence(states),
      dimensionsCovered: Array.from(new Set(states.map(s => s.dimension))),
      circuitResult: null,
      durationMs: Date.now() - startTime,
      timestamp: Date.now(),
    }

    this.recordAnalysis(analysis)
    return analysis
  }

  getConfig(): QuantumConfig {
    return { ...this.config }
  }

  updateConfig(config: Partial<QuantumConfig>): void {
    this.config = { ...this.config, ...config }
  }

  getHistory(limit: number = 10): QuantumAnalysis[] {
    return this.analysisHistory.slice(-limit)
  }

  getCrossInsights(): string[] {
    if (this.analysisHistory.length === 0) return []
    const latest = this.analysisHistory[this.analysisHistory.length - 1]!
    return generateCrossInsights(latest.entanglements, latest.states)
  }

  getPatternMemory(): Map<string, number> {
    return new Map(this.patternMemory)
  }

  /**
   * Record outcome feedback. Updates pattern memory based on success/failure.
   */
  recordOutcome(analysisId: string, success: boolean): void {
    const analysis = this.analysisHistory.find(a => a.id === analysisId)
    if (!analysis) return

    const multiplier = success ? 1.1 : 0.9
    for (const entanglement of analysis.entanglements) {
      const current = this.patternMemory.get(entanglement.sharedPattern) ?? 0.5
      this.patternMemory.set(
        entanglement.sharedPattern,
        Math.min(1, current * multiplier),
      )
    }
  }

  // --- Internal ---

  private recordAnalysis(analysis: QuantumAnalysis): void {
    this.analysisHistory.push(analysis)
    if (this.analysisHistory.length > 100) {
      this.analysisHistory = this.analysisHistory.slice(-100)
    }
  }
}

function calculateAverageConfidence(states: QuantumReasoningState[]): number {
  if (states.length === 0) return 0
  return states.reduce((sum, s) => sum + s.confidence, 0) / states.length
}
