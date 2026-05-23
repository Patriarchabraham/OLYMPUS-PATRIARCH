/**
 * Quantum Collapse — Real wave function collapse via Born rule measurement.
 *
 * In quantum mechanics, measurement causes the wave function to collapse
 * probabilistically. The probability of each outcome is given by the Born rule:
 *   P(measure |i⟩) = |αᵢ|²
 *
 * After measurement, the state vector collapses to the observed basis state:
 *   |ψ⟩ → |i⟩  with probability |αᵢ|²
 *
 * This is not a metaphor. When a real quantum computer measures a qubit,
 * this exact mathematical operation occurs. We simulate it faithfully.
 */

import { randomUUID } from 'crypto'
import { StateVector } from './stateVector.js'
import { QuantumCircuit } from './circuit.js'
import { sample, sampleShots } from './measurement.js'
import type {
  QuantumReasoningState,
  EntanglementLink,
  CollapseResult,
  QuantumConfig,
} from './types.js'

/**
 * Attempt quantum collapse — measure the state and get a definite outcome.
 * Uses the Born rule: P(i) = |αᵢ|² to determine which state is selected.
 * Returns null if confidence threshold is not met.
 */
export function collapse(
  states: QuantumReasoningState[],
  entanglements: EntanglementLink[],
  config: QuantumConfig,
): CollapseResult | null {
  if (states.length === 0) return null

  // Check dimensional coverage
  const coveredDimensions = new Set(states.map(s => s.dimension))
  const uncoveredDimensions = config.dimensions.filter(d => !coveredDimensions.has(d))
  if (uncoveredDimensions.length > 0) return null

  // Build a quantum circuit that encodes all states as amplitudes
  // Number of qubits needed: ceil(log2(states.length))
  const numQubits = Math.max(2, Math.ceil(Math.log2(states.length)))
  const circuit = new QuantumCircuit(numQubits)

  // Encode each state's confidence as an amplitude
  // Higher confidence → larger amplitude → higher measurement probability
  const amplitudes = states.map(s => Math.sqrt(s.confidence))
  const norm = Math.sqrt(amplitudes.reduce((s, a) => s + a * a, 0))

  // Apply entanglement bonuses: states with more entanglement links get boosted
  const entanglementBoosts = new Map<string, number>()
  for (const link of entanglements) {
    entanglementBoosts.set(link.stateA, (entanglementBoosts.get(link.stateA) ?? 0) + link.concurrence * 0.1)
    entanglementBoosts.set(link.stateB, (entanglementBoosts.get(link.stateB) ?? 0) + link.concurrence * 0.1)
  }

  // Create custom state vector with amplitudes proportional to confidence
  const size = 1 << numQubits
  const stateAmplitudes = Array.from({ length: size }, (_, i) => {
    if (i < states.length) {
      const boost = entanglementBoosts.get(states[i]!.id) ?? 0
      const rawAmplitude = Math.sqrt(states[i]!.confidence + boost)
      return { re: rawAmplitude / norm, im: 0 }
    }
    return { re: 0, im: 0 }
  })

  const superpositionState = StateVector.fromAmplitudes(stateAmplitudes)

  // Born rule measurement — sample from the probability distribution
  const measurementResult = sample(superpositionState)

  // Find which reasoning state corresponds to the measured basis state
  const measuredIndex = measurementResult.value
  if (measuredIndex >= states.length) return null

  const collapsedState = states[measuredIndex]!
  const bornProbability = measurementResult.probability

  // Check if collapse meets threshold
  if (collapsedState.confidence < config.collapseThreshold) {
    return null
  }

  // Get runner-ups (states with high measurement probability)
  const probs = superpositionState.probabilities()
  const ranked = states
    .map((s, i) => ({ state: s, prob: probs[i] ?? 0 }))
    .sort((a, b) => b.prob - a.prob)

  const runnerUps = ranked
    .filter(r => r.state.id !== collapsedState.id)
    .slice(0, 3)
    .map(r => r.state)

  const collapseReason = buildCollapseReason(
    collapsedState,
    bornProbability,
    entanglements,
    coveredDimensions.size,
  )

  return {
    id: `collapse_${randomUUID().slice(0, 8)}`,
    collapsedState,
    measurement: measurementResult.qubits.map(q => ({
      qubit: q.qubit,
      outcome: q.outcome,
      probability: q.probability,
    })),
    finalQuantumState: measurementResult.collapsedState,
    bornProbability,
    runnerUps,
    confidence: collapsedState.confidence,
    dimensionsEvaluated: coveredDimensions.size,
    entanglementsFound: entanglements.length,
    collapseReason,
    timestamp: Date.now(),
  }
}

/**
 * Force collapse even if threshold is not met.
 * Uses the same Born rule measurement but ignores the confidence check.
 */
export function forceCollapse(
  states: QuantumReasoningState[],
  entanglements: EntanglementLink[],
  config: QuantumConfig,
): CollapseResult {
  if (states.length === 0) {
    // Create minimal fallback
    const fallbackCircuit = new QuantumCircuit(1).h(0)
    const fallbackState = fallbackCircuit.run().state
    const fallback: QuantumReasoningState = {
      id: 'qs_fallback',
      dimension: 'correctness',
      solution: 'Insufficient data for quantum collapse — fallback to standard reasoning',
      confidence: 0.5,
      quantumState: fallbackState,
      basisIndex: 0,
    }
    return {
      id: `collapse_forced_${randomUUID().slice(0, 8)}`,
      collapsedState: fallback,
      measurement: [],
      finalQuantumState: fallbackState,
      bornProbability: 1,
      runnerUps: [],
      confidence: 0.5,
      dimensionsEvaluated: 0,
      entanglementsFound: 0,
      collapseReason: 'Forced collapse — insufficient states for threshold-based collapse',
      timestamp: Date.now(),
    }
  }

  // Same Born rule measurement, no threshold check
  const numQubits = Math.max(2, Math.ceil(Math.log2(states.length)))
  const size = 1 << numQubits
  const norm = Math.sqrt(states.reduce((s, st) => s + st.confidence, 0))

  const amplitudes = Array.from({ length: size }, (_, i) => {
    if (i < states.length) {
      const rawAmplitude = Math.sqrt(states[i]!.confidence)
      return { re: rawAmplitude / norm, im: 0 }
    }
    return { re: 0, im: 0 }
  })

  const superpositionState = StateVector.fromAmplitudes(amplitudes)
  const measurementResult = sample(superpositionState)
  const measuredIndex = Math.min(measurementResult.value, states.length - 1)
  const collapsedState = states[measuredIndex]!

  const probs = superpositionState.probabilities()
  const ranked = states
    .map((s, i) => ({ state: s, prob: probs[i] ?? 0 }))
    .sort((a, b) => b.prob - a.prob)

  const runnerUps = ranked
    .filter(r => r.state.id !== collapsedState.id)
    .slice(0, 3)
    .map(r => r.state)

  return {
    id: `collapse_forced_${randomUUID().slice(0, 8)}`,
    collapsedState,
    measurement: measurementResult.qubits.map(q => ({
      qubit: q.qubit,
      outcome: q.outcome,
      probability: q.probability,
    })),
    finalQuantumState: measurementResult.collapsedState,
    bornProbability: measurementResult.probability,
    runnerUps,
    confidence: collapsedState.confidence,
    dimensionsEvaluated: new Set(states.map(s => s.dimension)).size,
    entanglementsFound: entanglements.length,
    collapseReason: `Forced collapse (Born rule P=${(measurementResult.probability * 100).toFixed(1)}%) — ${collapsedState.dimension} dimension`,
    timestamp: Date.now(),
  }
}

function buildCollapseReason(
  state: QuantumReasoningState,
  bornProb: number,
  entanglements: EntanglementLink[],
  dimensionsEvaluated: number,
): string {
  const parts: string[] = []
  parts.push(`Born rule measurement: state |${state.basisIndex}⟩ with P=${(bornProb * 100).toFixed(1)}%`)
  parts.push(`${state.dimension} dimension, confidence ${(state.confidence * 100).toFixed(1)}%`)

  const stateEntanglements = entanglements.filter(
    e => e.stateA === state.id || e.stateB === state.id,
  )
  if (stateEntanglements.length > 0) {
    const avgConcurrence = stateEntanglements.reduce((s, e) => s + e.concurrence, 0) / stateEntanglements.length
    parts.push(`${stateEntanglements.length} entanglement links (avg concurrence ${avgConcurrence.toFixed(2)})`)
  }

  parts.push(`evaluated across ${dimensionsEvaluated} dimensions`)
  return parts.join(', ')
}
