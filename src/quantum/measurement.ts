/**
 * Quantum Measurement — Born rule, projective measurement, and sampling.
 *
 * In quantum mechanics, measurement is the process by which a quantum state
 * "collapses" to a definite outcome. The probability of each outcome is given
 * by the Born rule: P(i) = |⟨i|ψ⟩|² = |αᵢ|².
 *
 * This is not a metaphor — these are the exact mathematical rules that govern
 * real quantum computers. When IBM Quantum measures a qubit, this is the math
 * that determines what value you read.
 *
 * Key concepts:
 * - Born rule: P(outcome i) = |amplitude_i|²
 * - Projective measurement: state collapses to the measured subspace
 * - Shot-based sampling: run measurement N times to estimate probability distribution
 */

import { magnitudeSq } from './complex.js'
import type { Complex } from './complex.js'
import { StateVector } from './stateVector.js'
import { H_GATE, X_GATE, Y_GATE, Z_GATE } from './gates.js'

/** Outcome of measuring a single qubit */
export interface QubitMeasurement {
  /** Which qubit was measured */
  qubit: number
  /** Measurement outcome: 0 or 1 */
  outcome: 0 | 1
  /** Probability of this outcome (before measurement) */
  probability: number
}

/** Full measurement result for a multi-qubit state */
export interface MeasurementResult {
  /** The measured bitstring (e.g., "101" for qubits 2,1,0 = 1,0,1) */
  bitstring: string
  /** The integer value of the bitstring */
  value: number
  /** Probability of this specific outcome */
  probability: number
  /** Per-qubit outcomes */
  qubits: QubitMeasurement[]
  /** State after collapse */
  collapsedState: StateVector
}

/** Histogram from repeated measurements (shots) */
export interface ShotHistogram {
  /** Map of bitstring → count */
  counts: Map<string, number>
  /** Map of bitstring → estimated probability */
  probabilities: Map<string, number>
  /** Total shots */
  totalShots: number
  /** Most frequent outcome */
  mode: string
  /** Shannon entropy of the distribution */
  entropy: number
}

/**
 * Sample a single measurement from a quantum state using the Born rule.
 * Each basis state |i⟩ has probability |αᵢ|² of being observed.
 */
export function sample(state: StateVector): MeasurementResult {
  const probs = state.probabilities()
  const rand = Math.random()

  // Cumulative sampling — find which basis state "lands"
  let cumulative = 0
  let measuredIndex = 0
  for (let i = 0; i < probs.length; i++) {
    cumulative += probs[i]!
    if (rand <= cumulative) {
      measuredIndex = i
      break
    }
  }

  // Build per-qubit outcomes
  const qubits: QubitMeasurement[] = []
  for (let q = 0; q < state.numQubits; q++) {
    const bit = (measuredIndex >> q) & 1
    // Calculate marginal probability for this qubit being in state |bit⟩
    let marginalProb = 0
    for (let i = 0; i < probs.length; i++) {
      if (((i >> q) & 1) === bit) {
        marginalProb += probs[i]!
      }
    }
    qubits.push({ qubit: q, outcome: bit as 0 | 1, probability: marginalProb })
  }

  const bitstring = measuredIndex.toString(2).padStart(state.numQubits, '0')
  const collapsed = collapseToBasisState(state, measuredIndex)

  return {
    bitstring,
    value: measuredIndex,
    probability: probs[measuredIndex]!,
    qubits,
    collapsedState: collapsed,
  }
}

/**
 * Run N shots (repeated measurements) to build a probability histogram.
 * This is exactly what real quantum computers do — they run the circuit
 * many times and count the outcomes.
 */
export function sampleShots(state: StateVector, numShots: number = 1024): ShotHistogram {
  const counts = new Map<string, number>()

  for (let s = 0; s < numShots; s++) {
    const result = sample(state)
    counts.set(result.bitstring, (counts.get(result.bitstring) ?? 0) + 1)
  }

  // Convert to probabilities
  const probabilities = new Map<string, number>()
  let mode = ''
  let modeCount = 0
  for (const bs of Array.from(counts.keys())) {
    const count = counts.get(bs)!
    const p = count / numShots
    probabilities.set(bs, p)
    if (count > modeCount) {
      modeCount = count
      mode = bs
    }
  }

  // Shannon entropy
  let entropy = 0
  const probValues = Array.from(probabilities.values())
  for (const p of probValues) {
    if (p > 0) entropy -= p * Math.log2(p)
  }

  return { counts, probabilities, totalShots: numShots, mode, entropy }
}

/**
 * Collapse state to a specific basis state |index⟩.
 * This is projective measurement — the state vector becomes |index⟩ with
 * amplitude 1 and all others 0.
 */
export function collapseToBasisState(state: StateVector, index: number): StateVector {
  return StateVector.basis(state.numQubits, index)
}

/**
 * Partial measurement: measure only specific qubits and collapse them,
 * leaving the rest in their (possibly entangled) state.
 */
export function measureQubits(
  state: StateVector,
  qubits: number[],
): { outcomes: QubitMeasurement[]; collapsedState: StateVector } {
  let currentState = state
  const outcomes: QubitMeasurement[] = []

  // Measure qubits one at a time (sequential projective measurement)
  for (const q of qubits) {
    const result = sample(currentState)
    const qubitResult = result.qubits.find(r => r.qubit === q)!
    outcomes.push(qubitResult)

    // Collapse: zero out amplitudes incompatible with this outcome, renormalize
    currentState = projectQubit(currentState, q, qubitResult.outcome)
  }

  return { outcomes, collapsedState: currentState }
}

/**
 * Expectation value of an observable (Pauli matrix) on a qubit.
 * ⟨ψ|O|ψ⟩ = Σ |αᵢ|² · eigenvalue(i) for the observable.
 */
export function expectationValue(
  state: StateVector,
  observable: Complex[][],
  qubit: number,
): number {
  return state.expectation(observable, qubit)
}

/**
 * Measure in a specific basis (not just computational Z basis).
 * For example, measuring in the X basis (Hadamard basis) reveals
 * phase information that Z-basis measurement cannot see.
 */
export function measureInBasis(
  state: StateVector,
  qubit: number,
  basisMatrix: Complex[][],
): QubitMeasurement {
  // Rotate into measurement basis then measure in Z
  const rotated = state.applyGate(basisMatrix, qubit)
  const probs = rotated.probabilities()

  let prob0 = 0
  for (let i = 0; i < probs.length; i++) {
    if (((i >> qubit) & 1) === 0) prob0 += probs[i]!
  }

  const outcome: 0 | 1 = Math.random() < prob0 ? 0 : 1
  return { qubit, outcome, probability: outcome === 0 ? prob0 : 1 - prob0 }
}

/** Convenience: measure in X basis (Hadamard) */
export function measureX(state: StateVector, qubit: number): QubitMeasurement {
  // To measure in X basis, apply H then measure in Z
  return measureInBasis(state, qubit, H_GATE)
}

/** Convenience: measure in Y basis */
export function measureY(state: StateVector, qubit: number): QubitMeasurement {
  // To measure in Y basis, apply HS† then measure in Z
  const rotated = state.applyGate(H_GATE, qubit)
  const sDagger: Complex[][] = [
    [{ re: 1, im: 0 }, { re: 0, im: 0 }],
    [{ re: 0, im: 0 }, { re: 0, im: -1 }],
  ]
  return measureInBasis(rotated, qubit, sDagger)
}

/** Convenience: measure in Z basis (standard computational basis) */
export function measureZ(state: StateVector, qubit: number): QubitMeasurement {
  const zBasis: Complex[][] = [
    [{ re: 1, im: 0 }, { re: 0, im: 0 }],
    [{ re: 0, im: 0 }, { re: 1, im: 0 }],
  ]
  return measureInBasis(state, qubit, zBasis)
}

// --- Internal ---

/** Project a qubit to a specific outcome, zeroing incompatible amplitudes */
function projectQubit(state: StateVector, qubit: number, outcome: number): StateVector {
  const size = 1 << state.numQubits
  const amps = state.amplitudes.map(a => ({ ...a }))
  let normSq = 0

  for (let i = 0; i < size; i++) {
    if (((i >> qubit) & 1) !== outcome) {
      amps[i] = { re: 0, im: 0 }
    } else {
      normSq += magnitudeSq(amps[i]!)
    }
  }

  if (normSq < 1e-30) return state

  const factor = 1 / Math.sqrt(normSq)
  for (let i = 0; i < size; i++) {
    amps[i] = { re: amps[i]!.re * factor, im: amps[i]!.im * factor }
  }

  return new StateVector(state.numQubits, amps)
}
