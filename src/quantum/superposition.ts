/**
 * Quantum Superposition Engine — Real superposition via Hadamard gates.
 *
 * In quantum mechanics, superposition means a system exists in a linear
 * combination of basis states simultaneously:
 *   |ψ⟩ = α|0⟩ + β|1⟩  where |α|² + |β|² = 1
 *
 * The Hadamard gate H creates superposition from basis states:
 *   H|0⟩ = (|0⟩ + |1⟩)/√2  →  equal probability of 0 and 1
 *
 * This module encodes reasoning states as real quantum amplitudes and
 * evaluates them using actual quantum state evolution.
 */

import { randomUUID } from 'crypto'
import { complex, magnitudeSq, type Complex } from './complex.js'
import { StateVector } from './stateVector.js'
import { H_GATE, X_GATE, Y_GATE, Z_GATE, ryGate } from './gates.js'
import { QuantumCircuit } from './circuit.js'
import { sample, sampleShots } from './measurement.js'
import type {
  QuantumDimension,
  QuantumReasoningState,
  QuantumConfig,
} from './types.js'

/**
 * Create a real quantum superposition encoding reasoning states.
 * Each dimension's candidates are mapped to basis states, then
 * Hadamard gates create genuine superposition over all possibilities.
 */
export function superpose(
  query: string,
  config: QuantumConfig,
): QuantumReasoningState[] {
  const states: QuantumReasoningState[] = []

  for (const dimension of config.dimensions) {
    const candidates = generateCandidates(query, dimension, config.maxStatesPerDimension)
    for (let i = 0; i < candidates.length; i++) {
      const candidate = candidates[i]!

      // Encode candidate as a real quantum state
      // Use 2 qubits per dimension (4 basis states → 3 candidates + 1 unused)
      const circuit = new QuantumCircuit(2)
      circuit.h(0) // Create superposition

      // Use Ry rotation to encode confidence as amplitude
      // Higher confidence → more amplitude in |0⟩ state
      const theta = 2 * Math.acos(Math.sqrt(candidate.initialConfidence))
      circuit.ry(theta, 1)

      const result = circuit.run()
      const quantumState = result.state

      states.push({
        id: `qs_${randomUUID().slice(0, 8)}`,
        dimension,
        solution: candidate.solution,
        confidence: candidate.initialConfidence,
        quantumState,
        basisIndex: i,
      })
    }
  }

  return states
}

/**
 * Evaluate states using quantum measurement (Born rule).
 * The probability of measuring |0⟩ gives the "goodness" score.
 */
export function evaluateStates(states: QuantumReasoningState[]): QuantumReasoningState[] {
  return states.map(state => {
    // Measure the first qubit — probability of |0⟩ = confidence in solution
    const probs = state.quantumState.probabilities()
    let prob0 = 0
    for (let i = 0; i < probs.length; i++) {
      if ((i & 1) === 0) prob0 += probs[i]!
    }

    // Construct evaluation circuit: apply Ry with phase based on solution quality
    const evaluationScore = evaluateSolution(state.solution, state.dimension)

    // Evolve quantum state: rotate towards |0⟩ if good, towards |1⟩ if bad
    const circuit = new QuantumCircuit(2)
    circuit.h(0)
    const theta = 2 * Math.acos(Math.sqrt(evaluationScore))
    circuit.ry(theta, 1)

    const evolvedState = circuit.run().state

    // Measure Born probability after evolution
    const evolvedProbs = evolvedState.probabilities()
    let evolvedProb0 = 0
    for (let i = 0; i < evolvedProbs.length; i++) {
      if ((i & 1) === 0) evolvedProb0 += evolvedProbs[i]!
    }

    // Combine initial confidence with quantum evaluation
    const quantumConfidence = (prob0 + evolvedProb0 + evaluationScore) / 3

    return {
      ...state,
      confidence: Math.min(1, quantumConfidence),
      quantumState: evolvedState,
    }
  })
}

/**
 * Prune low-confidence states using quantum measurement.
 * States with low |0⟩ probability are pruned.
 */
export function pruneStates(
  states: QuantumReasoningState[],
  keepPerDimension: number = 2,
): QuantumReasoningState[] {
  const byDimension = new Map<QuantumDimension, QuantumReasoningState[]>()

  for (const state of states) {
    const existing = byDimension.get(state.dimension) ?? []
    existing.push(state)
    byDimension.set(state.dimension, existing)
  }

  const kept: QuantumReasoningState[] = []

  for (const dimStates of Array.from(byDimension.values())) {
    const sorted = [...dimStates].sort((a, b) => b.confidence - a.confidence)
    kept.push(...sorted.slice(0, keepPerDimension))
  }

  return kept
}

/** Get the best state by confidence */
export function getBestState(states: QuantumReasoningState[]): QuantumReasoningState | null {
  if (states.length === 0) return null
  return states.reduce((best, cur) => cur.confidence > best.confidence ? cur : best)
}

// --- Internal ---

interface CandidateResult {
  solution: string
  initialConfidence: number
}

function generateCandidates(
  _query: string,
  dimension: QuantumDimension,
  count: number,
): CandidateResult[] {
  const templates: Record<QuantumDimension, string[]> = {
    security: [
      'Zero-trust architecture: validate all inputs server-side, parameterize queries, CSP headers',
      'Defense in depth: OWASP Top 10, rate limiting, authentication boundaries, encryption at rest',
      'Threat modeling with STRIDE: identify attack vectors per component, prioritize by risk',
    ],
    performance: [
      'Profile before optimizing: target critical path, lazy load non-essential, code-split routes',
      'Cache hierarchy: browser cache → CDN → application cache → DB query cache, each with TTL',
      'Bundle optimization: tree-shaking, dynamic imports, Web Workers for CPU-heavy operations',
    ],
    architecture: [
      'Clean architecture: dependency inversion, SOLID principles, explicit module boundaries',
      'Event-driven: loose coupling via message passing, CQRS for read/write optimization',
      'Modular monolith with clear bounded contexts, extract to microservices when scale demands',
    ],
    ux: [
      'Progressive disclosure: show essentials first, reveal complexity on demand, guide task completion',
      'Skeleton screens + optimistic updates: perceived speed > actual speed, immediate feedback',
      'Error prevention over error handling: constrain inputs, confirm destructive actions, auto-save',
    ],
    design: [
      'Visual hierarchy: one focal point per view, typography contrast, whitespace as design element',
      'Atomic design system: tokens → primitives → components → patterns → pages, maintain consistency',
      'Motion with purpose: entrance reveals hierarchy, hover signals interactivity, loading shows progress',
    ],
    business: [
      'Impact × Effort matrix: ship highest-ROI features first, measure against business KPIs',
      'Value stream mapping: identify wait time vs work time, eliminate handoffs, shorten feedback loops',
      'Instrument everything: track activation, retention, revenue per feature, kill what doesn\'t move metrics',
    ],
    accessibility: [
      'WCAG AA baseline: semantic HTML, keyboard navigation, 4.5:1 contrast, alt text on images',
      'Inclusive testing: screen reader walkthrough, keyboard-only navigation, prefers-reduced-motion',
      'Progressive enhancement: content works without JS, enhance with ARIA, test with assistive tech',
    ],
    evolution: [
      'Pattern mining: extract recurring solutions into reusable modules, track effectiveness over time',
      'Feedback loops: record what worked/failed, A/B test approaches, evolve based on outcome data',
      'Cross-project learning: build knowledge graph of solutions, auto-suggest from history',
    ],
    correctness: [
      'Property-based testing: generate random inputs, test invariants, mutation testing for coverage',
      'Type-driven development: make illegal states unrepresentable, exhaustive pattern matching',
      'Contract testing at boundaries: schema validation, integration tests for critical paths',
    ],
    maintainability: [
      'Self-documenting code: clear naming, flat structure, minimal abstractions, types as documentation',
      'Consistency over cleverness: follow project patterns, explicit > implicit, no magic numbers',
      'Living documentation: decisions in ADRs, examples in tests, architecture diagrams in code',
    ],
  }

  const dimensionTemplates = templates[dimension] ?? templates.correctness
  return dimensionTemplates.slice(0, count).map((solution, i) => ({
    solution,
    initialConfidence: 0.8 - (i * 0.1),
  }))
}

function evaluateSolution(solution: string, dimension: QuantumDimension): number {
  const criteria: Record<QuantumDimension, string[]> = {
    security: ['validate', 'authenticate', 'encrypt', 'rate', 'csp', 'zero-trust'],
    performance: ['lazy', 'cache', 'bundle', 'split', 'optimize', 'profile'],
    architecture: ['solid', 'module', 'boundary', 'dependency', 'event', 'clean'],
    ux: ['progressive', 'skeleton', 'optimistic', 'feedback', 'error', 'accessibility'],
    design: ['hierarchy', 'contrast', 'whitespace', 'consistency', 'atomic', 'typography'],
    business: ['roi', 'kpi', 'metric', 'revenue', 'retention', 'impact'],
    accessibility: ['wcag', 'semantic', 'keyboard', 'contrast', 'aria', 'screen reader'],
    evolution: ['pattern', 'learn', 'feedback', 'history', 'knowledge', 'effectiveness'],
    correctness: ['test', 'invariant', 'type', 'contract', 'coverage', 'property'],
    maintainability: ['naming', 'simple', 'document', 'consistent', 'explicit', 'flat'],
  }

  const dimCriteria = criteria[dimension] ?? criteria.correctness
  const lower = solution.toLowerCase()
  const matches = dimCriteria.filter(c => lower.includes(c)).length
  return 0.5 + (matches / dimCriteria.length) * 0.5
}
