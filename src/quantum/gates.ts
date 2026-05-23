/**
 * Standard Quantum Gates — Unitary operations for quantum circuits.
 *
 * Each gate is a unitary matrix: U†U = I (preserves normalization).
 * These are the real quantum gates used in every quantum computer:
 * - IBM Quantum, Google Sycamore, IonQ, Rigetti — they all use these exact matrices.
 *
 * Single-qubit gates: 2×2 matrices acting on one qubit.
 * Two-qubit gates: 4×4 matrices for entanglement and interaction.
 * Rotation gates: parameterized gates for continuous control.
 */

import { complex, type Complex, expi, conjugate, multiply, add } from './complex.js'

// ============================================================
// Single-qubit gates (2×2 unitary matrices)
// ============================================================

/** Identity: I = [[1,0],[0,1]] — does nothing */
export const I_GATE: Complex[][] = [
  [complex(1), complex(0)],
  [complex(0), complex(1)],
]

/** Pauli-X (NOT/bit-flip): X|0⟩ = |1⟩, X|1⟩ = |0⟩ */
export const X_GATE: Complex[][] = [
  [complex(0), complex(1)],
  [complex(1), complex(0)],
]

/** Pauli-Y: Y = [[0,-i],[i,0]] — rotation by π around Y axis */
export const Y_GATE: Complex[][] = [
  [complex(0), complex(0, -1)],
  [complex(0, 1), complex(0)],
]

/** Pauli-Z (phase-flip): Z|0⟩ = |0⟩, Z|1⟩ = -|1⟩ */
export const Z_GATE: Complex[][] = [
  [complex(1), complex(0)],
  [complex(0), complex(-1)],
]

/**
 * Hadamard: H = (1/√2)[[1,1],[1,-1]]
 * Creates superposition: H|0⟩ = (|0⟩+|1⟩)/√2, H|1⟩ = (|0⟩-|1⟩)/√2
 * This is the gate that makes quantum computing quantum.
 */
export const H_GATE: Complex[][] = [
  [complex(1 / Math.sqrt(2)), complex(1 / Math.sqrt(2))],
  [complex(1 / Math.sqrt(2)), complex(-1 / Math.sqrt(2))],
]

/** S gate (π/2 phase): S = [[1,0],[0,i]] */
export const S_GATE: Complex[][] = [
  [complex(1), complex(0)],
  [complex(0), complex(0, 1)],
]

/** S† gate (−π/2 phase): S† = [[1,0],[0,−i]] */
export const SDAGGER_GATE: Complex[][] = [
  [complex(1), complex(0)],
  [complex(0), complex(0, -1)],
]

/** T gate (π/4 phase) — needed for universal quantum computation */
export const T_GATE: Complex[][] = [
  [complex(1), complex(0)],
  [complex(0), expi(Math.PI / 4)],
]

/** T† gate (−π/4 phase) */
export const TDAGGER_GATE: Complex[][] = [
  [complex(1), complex(0)],
  [complex(0), expi(-Math.PI / 4)],
]

/** Square root of X (SX): SX = (1/2)[[1+i, 1-i],[1-i, 1+i]] */
export const SX_GATE: Complex[][] = [
  [complex(0.5, 0.5), complex(0.5, -0.5)],
  [complex(0.5, -0.5), complex(0.5, 0.5)],
]

// ============================================================
// Parameterized rotation gates
// ============================================================

/** Phase gate: P(θ) = [[1,0],[0,e^(iθ)]] */
export function phaseGate(theta: number): Complex[][] {
  return [
    [complex(1), complex(0)],
    [complex(0), expi(theta)],
  ]
}

/** Rotation around X: Rx(θ) = [[cos(θ/2), -i·sin(θ/2)], [-i·sin(θ/2), cos(θ/2)]] */
export function rxGate(theta: number): Complex[][] {
  const c = Math.cos(theta / 2)
  const s = Math.sin(theta / 2)
  return [
    [complex(c), complex(0, -s)],
    [complex(0, -s), complex(c)],
  ]
}

/** Rotation around Y: Ry(θ) = [[cos(θ/2), -sin(θ/2)], [sin(θ/2), cos(θ/2)]] */
export function ryGate(theta: number): Complex[][] {
  const c = Math.cos(theta / 2)
  const s = Math.sin(theta / 2)
  return [
    [complex(c), complex(-s)],
    [complex(s), complex(c)],
  ]
}

/** Rotation around Z: Rz(θ) = [[e^(-iθ/2), 0], [0, e^(iθ/2)]] */
export function rzGate(theta: number): Complex[][] {
  return [
    [expi(-theta / 2), complex(0)],
    [complex(0), expi(theta / 2)],
  ]
}

// ============================================================
// Two-qubit gates (4×4 unitary matrices)
// ============================================================

/**
 * CNOT (Controlled-NOT): flips target iff control is |1⟩.
 * CNOT + Hadamard creates Bell states — the canonical entangled states.
 * This is the primary entanglement gate.
 */
export const CNOT_GATE: Complex[][] = [
  [complex(1), complex(0), complex(0), complex(0)],
  [complex(0), complex(1), complex(0), complex(0)],
  [complex(0), complex(0), complex(0), complex(1)],
  [complex(0), complex(0), complex(1), complex(0)],
]

/** SWAP: exchanges two qubits */
export const SWAP_GATE: Complex[][] = [
  [complex(1), complex(0), complex(0), complex(0)],
  [complex(0), complex(0), complex(1), complex(0)],
  [complex(0), complex(1), complex(0), complex(0)],
  [complex(0), complex(0), complex(0), complex(1)],
]

/** Controlled-Z: applies Z to target iff control is |1⟩ */
export const CZ_GATE: Complex[][] = [
  [complex(1), complex(0), complex(0), complex(0)],
  [complex(0), complex(1), complex(0), complex(0)],
  [complex(0), complex(0), complex(1), complex(0)],
  [complex(0), complex(0), complex(0), complex(-1)],
]

/** Controlled-Hadamard */
export const CH_GATE: Complex[][] = [
  [complex(1), complex(0), complex(0), complex(0)],
  [complex(0), complex(1), complex(0), complex(0)],
  [complex(0), complex(0), complex(1 / Math.sqrt(2)), complex(1 / Math.sqrt(2))],
  [complex(0), complex(0), complex(1 / Math.sqrt(2)), complex(-1 / Math.sqrt(2))],
]

// ============================================================
// Gate composition utilities
// ============================================================

/** Matrix multiply two gate matrices */
export function composeGates(a: Complex[][], b: Complex[][]): Complex[][] {
  const size = a.length
  const result: Complex[][] = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => complex(0)),
  )
  for (let i = 0; i < size; i++) {
    for (let j = 0; j < size; j++) {
      for (let k = 0; k < size; k++) {
        result[i]![j] = add(result[i]![j]!, multiply(a[i]![k]!, b[k]![j]!))
      }
    }
  }
  return result
}

/** Dagger (conjugate transpose) — the inverse of a unitary gate */
export function dagger(gate: Complex[][]): Complex[][] {
  const size = gate.length
  const result: Complex[][] = Array.from({ length: size }, () =>
    Array.from({ length: size }, () => complex(0)),
  )
  for (let i = 0; i < size; i++) {
    for (let j = 0; j < size; j++) {
      result[i]![j] = conjugate(gate[j]![i]!)
    }
  }
  return result
}

/** Tensor (Kronecker) product of two gate matrices */
export function gateTensorProduct(a: Complex[][], b: Complex[][]): Complex[][] {
  const aSize = a.length
  const bSize = b.length
  const result: Complex[][] = Array.from({ length: aSize * bSize }, () =>
    Array.from({ length: aSize * bSize }, () => complex(0)),
  )
  for (let i = 0; i < aSize * bSize; i++) {
    for (let j = 0; j < aSize * bSize; j++) {
      const ai = Math.floor(i / bSize)
      const aj = Math.floor(j / bSize)
      const bi = i % bSize
      const bj = j % bSize
      result[i]![j] = multiply(a[ai]![aj]!, b[bi]![bj]!)
    }
  }
  return result
}

/** Check if a matrix is approximately unitary (U†U ≈ I) */
export function isUnitary(gate: Complex[][], tolerance: number = 1e-8): boolean {
  const size = gate.length
  const dag = dagger(gate)
  const product = composeGates(dag, gate)
  for (let i = 0; i < size; i++) {
    for (let j = 0; j < size; j++) {
      const expected = i === j ? 1 : 0
      const actual = product[i]![j]!
      if (Math.abs(actual.re - expected) > tolerance || Math.abs(actual.im) > tolerance) {
        return false
      }
    }
  }
  return true
}
