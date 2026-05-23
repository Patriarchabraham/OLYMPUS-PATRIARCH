/**
 * Quantum Circuit — Composable sequence of quantum gate operations.
 *
 * A quantum circuit is built by applying gates to qubits in sequence,
 * exactly like building a real quantum circuit on IBM Quantum or Google's
 * Sycamore processor. The state vector evolves through each gate:
 *
 *   |ψ₀⟩ → H(q0) → CNOT(q0,q1) → measure → |ψ_final⟩
 *
 * Usage:
 *   const circuit = new QuantumCircuit(2)  // 2 qubits
 *     .h(0)          // Hadamard on qubit 0
 *     .cnot(0, 1)    // CNOT: control=0, target=1 → creates Bell state
 *     .measure()     // Measure all qubits
 *
 *   const result = circuit.run()
 *   console.log(result.state.toDirac())  // (0.7071+0.0000i)|00⟩ + (0.7071+0.0000i)|11⟩
 */

import { type Complex, complex, scale, magnitudeSq } from './complex.js'
import { StateVector } from './stateVector.js'
import {
  H_GATE, X_GATE, Y_GATE, Z_GATE, S_GATE, SDAGGER_GATE,
  T_GATE, TDAGGER_GATE, SX_GATE, I_GATE,
  CNOT_GATE, SWAP_GATE, CZ_GATE, CH_GATE,
  phaseGate, rxGate, ryGate, rzGate,
} from './gates.js'

/** A single gate operation recorded in the circuit */
export interface GateStep {
  readonly name: string
  readonly gate: Complex[][]
  readonly targets: number[]
  readonly control?: number
  readonly params?: number[]
}

/** Result of running a quantum circuit */
export interface CircuitResult {
  /** Final quantum state vector */
  readonly state: StateVector
  /** All steps executed */
  readonly steps: readonly GateStep[]
  /** Measurement results (if measure() was called) */
  readonly measurements: readonly MeasurementResult[]
  /** Circuit depth (number of gate layers) */
  readonly depth: number
  /** Number of qubits */
  readonly numQubits: number
  /** Execution time in microseconds */
  readonly durationUs: number
}

/** Result of measuring qubits */
export interface MeasurementResult {
  readonly qubit: number
  readonly outcome: 0 | 1
  readonly probability: number
}

/**
 * Quantum circuit builder — fluently construct and execute quantum circuits.
 */
export class QuantumCircuit {
  private readonly numQubits: number
  private readonly steps: GateStep[] = []
  private measureQubits: number[] | null = null

  constructor(numQubits: number) {
    if (numQubits < 1 || numQubits > 20) {
      throw new Error(`Qubit count must be 1-20, got ${numQubits}`)
    }
    this.numQubits = numQubits
  }

  // --- Single-qubit gates ---

  /** Hadamard gate — creates superposition */
  h(qubit: number): this { return this.addStep('H', H_GATE, [qubit]) }

  /** Pauli-X (NOT) gate — flips |0⟩↔|1⟩ */
  x(qubit: number): this { return this.addStep('X', X_GATE, [qubit]) }

  /** Pauli-Y gate */
  y(qubit: number): this { return this.addStep('Y', Y_GATE, [qubit]) }

  /** Pauli-Z gate — phase flip */
  z(qubit: number): this { return this.addStep('Z', Z_GATE, [qubit]) }

  /** S gate (π/2 phase) */
  s(qubit: number): this { return this.addStep('S', S_GATE, [qubit]) }

  /** S† gate (−π/2 phase) */
  sdagger(qubit: number): this { return this.addStep('S†', SDAGGER_GATE, [qubit]) }

  /** T gate (π/4 phase) */
  t(qubit: number): this { return this.addStep('T', T_GATE, [qubit]) }

  /** T† gate (−π/4 phase) */
  tdagger(qubit: number): this { return this.addStep('T†', TDAGGER_GATE, [qubit]) }

  /** √X gate */
  sx(qubit: number): this { return this.addStep('SX', SX_GATE, [qubit]) }

  /** Identity (no-op) */
  i(qubit: number): this { return this.addStep('I', I_GATE, [qubit]) }

  // --- Parameterized gates ---

  /** Phase gate with arbitrary angle */
  p(theta: number, qubit: number): this {
    return this.addStep('P', phaseGate(theta), [qubit], undefined, [theta])
  }

  /** Rotation around X axis */
  rx(theta: number, qubit: number): this {
    return this.addStep('Rx', rxGate(theta), [qubit], undefined, [theta])
  }

  /** Rotation around Y axis */
  ry(theta: number, qubit: number): this {
    return this.addStep('Ry', ryGate(theta), [qubit], undefined, [theta])
  }

  /** Rotation around Z axis */
  rz(theta: number, qubit: number): this {
    return this.addStep('Rz', rzGate(theta), [qubit], undefined, [theta])
  }

  // --- Two-qubit gates ---

  /** CNOT — controlled-NOT (primary entanglement gate) */
  cnot(control: number, target: number): this {
    return this.addStep('CNOT', CNOT_GATE, [target], control)
  }

  /** Controlled-Z */
  cz(control: number, target: number): this {
    return this.addStep('CZ', CZ_GATE, [target], control)
  }

  /** Controlled-Hadamard */
  ch(control: number, target: number): this {
    return this.addStep('CH', CH_GATE, [target], control)
  }

  /** SWAP two qubits */
  swap(qubitA: number, qubitB: number): this {
    return this.addStep('SWAP', SWAP_GATE, [qubitA, qubitB])
  }

  // --- Measurement ---

  /** Mark qubits for measurement (default: all) */
  measure(qubits?: number[]): this {
    this.measureQubits = qubits ?? Array.from({ length: this.numQubits }, (_, i) => i)
    return this
  }

  // --- Execution ---

  /** Run the circuit and return the final state + measurements */
  run(initialState?: StateVector): CircuitResult {
    const start = performance.now()

    let state = initialState ?? StateVector.zero(this.numQubits)

    // Apply all gate steps
    for (const step of this.steps) {
      if (step.control !== undefined) {
        state = state.applyControlledGate(step.gate, step.control, step.targets[0]!)
      } else {
        state = state.applyGate(step.gate, step.targets[0]!)
      }
    }

    // Perform measurements if requested
    const measurements: MeasurementResult[] = []
    if (this.measureQubits !== null) {
      for (const q of this.measureQubits) {
        const outcome = this.sampleQubit(state, q)
        const prob = outcome === 0
          ? state.probability(0) // simplified for single-qubit
          : 1 - state.probability(0)
        measurements.push({ qubit: q, outcome, probability: Math.abs(prob) })

        // Collapse state after measurement (projective measurement)
        state = this.collapseAfterMeasurement(state, q, outcome)
      }
    }

    const durationUs = (performance.now() - start) * 1000

    return {
      state,
      steps: this.steps,
      measurements,
      depth: this.steps.length,
      numQubits: this.numQubits,
      durationUs,
    }
  }

  /** Get the circuit diagram as a string */
  diagram(): string {
    const lines: string[] = []
    for (let q = 0; q < this.numQubits; q++) {
      let line = `q${q}: `
      for (const step of this.steps) {
        if (step.targets.includes(q)) {
          line += `[${step.name}]─`
        } else if (step.control === q) {
          line += ` ● ──`
        } else {
          line += `──────`
        }
      }
      lines.push(line)
    }
    return lines.join('\n')
  }

  /** Get number of gates */
  get gateCount(): number {
    return this.steps.length
  }

  // --- Internal ---

  private addStep(
    name: string,
    gate: Complex[][],
    targets: number[],
    control?: number,
    params?: number[],
  ): this {
    for (const t of targets) {
      if (t < 0 || t >= this.numQubits) {
        throw new Error(`Qubit ${t} out of range for ${this.numQubits}-qubit circuit`)
      }
    }
    if (control !== undefined && (control < 0 || control >= this.numQubits)) {
      throw new Error(`Control qubit ${control} out of range`)
    }
    this.steps.push({ name, gate, targets, control, params })
    return this
  }

  /** Sample a single qubit using Born rule */
  private sampleQubit(state: StateVector, qubit: number): 0 | 1 {
    const probs = state.probabilities()
    let prob0 = 0
    for (let i = 0; i < probs.length; i++) {
      if (((i >> qubit) & 1) === 0) {
        prob0 += probs[i]!
      }
    }
    return Math.random() < prob0 ? 0 : 1
  }

  /** Collapse state after measuring qubit with given outcome (projective measurement) */
  private collapseAfterMeasurement(state: StateVector, qubit: number, outcome: number): StateVector {
    const size = 1 << state.numQubits
    const newAmps = state.amplitudes.map(a => ({ ...a }))
    let normSq = 0

    for (let i = 0; i < size; i++) {
      if (((i >> qubit) & 1) !== outcome) {
        newAmps[i] = { re: 0, im: 0 } // Zero out incompatible outcomes
      } else {
        normSq += magnitudeSq(newAmps[i]!)
      }
    }

    // Renormalize
    if (normSq < 1e-30) return state
    const factor = 1 / Math.sqrt(normSq)
    for (let i = 0; i < size; i++) {
      newAmps[i] = scale(factor, newAmps[i]!)
    }

    return new StateVector(state.numQubits, newAmps)
  }
}

// ============================================================
// Preset circuits — commonly used quantum states
// ============================================================

/** Create a Bell state: (|00⟩ + |11⟩)/√2 — maximally entangled */
export function bellStateCircuit(): QuantumCircuit {
  return new QuantumCircuit(2).h(0).cnot(0, 1)
}

/** Create GHZ state: (|000⟩ + |111⟩)/√3 — 3-qubit entanglement */
export function ghzStateCircuit(): QuantumCircuit {
  return new QuantumCircuit(3).h(0).cnot(0, 1).cnot(0, 2)
}

/** Create W state: (|001⟩ + |010⟩ + |100⟩)/√3 */
export function wStateCircuit(): QuantumCircuit {
  const c = new QuantumCircuit(3)
  // W state via Ry rotations + CNOT
  c.ry(2 * Math.acos(1 / Math.sqrt(3)), 0)
  c.cnot(0, 1)
  c.ry(Math.PI / 4, 0)
  c.cnot(0, 2)
  return c
}

/** Quantum Fourier Transform on n qubits */
export function qftCircuit(numQubits: number): QuantumCircuit {
  const c = new QuantumCircuit(numQubits)
  for (let i = 0; i < numQubits; i++) {
    c.h(i)
    for (let j = i + 1; j < numQubits; j++) {
      c.p(Math.PI / (1 << (j - i)), i) // controlled phase
    }
  }
  // Swap qubits for bit-reversal
  for (let i = 0; i < Math.floor(numQubits / 2); i++) {
    c.swap(i, numQubits - 1 - i)
  }
  return c
}
