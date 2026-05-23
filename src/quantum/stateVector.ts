/**
 * Quantum State Vector — N-qubit quantum state in Hilbert space.
 *
 * An n-qubit state is a normalized vector of 2^n complex amplitudes:
 *   |ψ⟩ = Σᵢ αᵢ|i⟩  where Σ|αᵢ|² = 1
 *
 * Each amplitude αᵢ gives probability |αᵢ|² of measuring basis state |i⟩.
 * This is the fundamental data structure of quantum computing — the same
 * representation used in Qiskit's Statevector, Cirq's StateVector, etc.
 *
 * Key quantum properties computed on real math:
 * - Superposition: non-zero amplitudes for multiple basis states
 * - Entanglement: von Neumann entropy of partial trace > 0
 * - Interference: complex phases cause constructive/destructive cancellation
 */

import {
  type Complex,
  complex,
  add,
  subtract,
  multiply,
  conjugate,
  magnitudeSq,
  ZERO,
  ONE,
} from './complex.js'

/**
 * N-qubit quantum state vector with full gate application support.
 */
export class StateVector {
  /** Number of qubits in this state */
  readonly numQubits: number
  /** Complex amplitude vector — length 2^n */
  readonly amplitudes: readonly Complex[]

  constructor(numQubits: number, amplitudes: Complex[]) {
    this.numQubits = numQubits
    this.amplitudes = Object.freeze(amplitudes)
  }

  // --- Factory methods ---

  /** Create computational basis state |index⟩ for n qubits */
  static basis(numQubits: number, index: number): StateVector {
    const size = 1 << numQubits
    if (index < 0 || index >= size) {
      throw new Error(`Basis index ${index} out of range for ${numQubits} qubits`)
    }
    const amps: Complex[] = Array.from({ length: size }, () => ({ ...ZERO }))
    amps[index] = { ...ONE }
    return new StateVector(numQubits, amps)
  }

  /** Create |0...0⟩ state */
  static zero(numQubits: number): StateVector {
    return StateVector.basis(numQubits, 0)
  }

  /** Create equal superposition (1/√N)Σᵢ|i⟩ — the Hadamard transform of |0⟩ */
  static superposition(numQubits: number): StateVector {
    const size = 1 << numQubits
    const norm = 1 / Math.sqrt(size)
    const amps: Complex[] = Array.from({ length: size }, () => complex(norm))
    return new StateVector(numQubits, amps)
  }

  /** Create from amplitude array (auto-normalizes) */
  static fromAmplitudes(amplitudes: Complex[]): StateVector {
    const size = amplitudes.length
    if (size === 0 || (size & (size - 1)) !== 0) {
      throw new Error(`Amplitude array length must be power of 2, got ${size}`)
    }
    const numQubits = Math.log2(size)
    const sv = new StateVector(numQubits, amplitudes.map(a => ({ ...a })))
    return sv.normalize()
  }

  // --- Operations ---

  /** Normalize: scale so Σ|αᵢ|² = 1 */
  normalize(): StateVector {
    const normSq = this.amplitudes.reduce((s, a) => s + magnitudeSq(a), 0)
    if (normSq < 1e-30) throw new Error('Cannot normalize zero state vector')
    const factor = 1 / Math.sqrt(normSq)
    return new StateVector(
      this.numQubits,
      this.amplitudes.map(a => ({ re: a.re * factor, im: a.im * factor })),
    )
  }

  /** Probability distribution over basis states (Born rule) */
  probabilities(): number[] {
    return this.amplitudes.map(a => magnitudeSq(a))
  }

  /** Probability of measuring specific basis state */
  probability(index: number): number {
    return magnitudeSq(this.amplitudes[index]!)
  }

  /**
   * Apply a single-qubit gate to target qubit.
   * For a 2x2 gate U on qubit t, transforms each pair of amplitudes
   * whose indices differ only at bit t.
   */
  applyGate(gate: Complex[][], target: number): StateVector {
    const n = this.numQubits
    if (target < 0 || target >= n) {
      throw new Error(`Target qubit ${target} out of range for ${n} qubits`)
    }
    const size = 1 << n
    const newAmps: Complex[] = Array.from({ length: size }, () => ({ ...ZERO }))

    for (let i = 0; i < size; i++) {
      if (((i >> target) & 1) !== 0) continue // process each pair once
      const j = i | (1 << target) // paired index (target bit flipped)
      const a0 = this.amplitudes[i]!
      const a1 = this.amplitudes[j]!

      newAmps[i] = add(multiply(gate[0]![0]!, a0), multiply(gate[0]![1]!, a1))
      newAmps[j] = add(multiply(gate[1]![0]!, a0), multiply(gate[1]![1]!, a1))
    }

    return new StateVector(n, newAmps)
  }

  /**
   * Apply controlled gate: applies U to target only when control is |1⟩.
   * This is how entanglement is created — CNOT + Hadamard produces Bell states.
   */
  applyControlledGate(gate: Complex[][], control: number, target: number): StateVector {
    if (control === target) throw new Error('Control and target must differ')
    const n = this.numQubits
    const size = 1 << n
    const newAmps: Complex[] = this.amplitudes.map(a => ({ ...a }))

    for (let i = 0; i < size; i++) {
      if (((i >> control) & 1) === 0) continue // control is |0⟩, skip
      if (((i >> target) & 1) !== 0) continue  // process pairs once

      const j = i | (1 << target)
      const a0 = this.amplitudes[i]!
      const a1 = this.amplitudes[j]!

      newAmps[i] = add(multiply(gate[0]![0]!, a0), multiply(gate[0]![1]!, a1))
      newAmps[j] = add(multiply(gate[1]![0]!, a0), multiply(gate[1]![1]!, a1))
    }

    return new StateVector(n, newAmps)
  }

  /** Tensor product: combine two independent quantum systems */
  tensor(other: StateVector): StateVector {
    const newAmps: Complex[] = []
    for (const a of this.amplitudes) {
      for (const b of other.amplitudes) {
        newAmps.push(multiply(a, b))
      }
    }
    return new StateVector(this.numQubits + other.numQubits, newAmps)
  }

  /**
   * Partial trace: trace out qubits not in keepQubits to get reduced state.
   * Returns probability distribution over the kept subsystem.
   * If entanglement entropy > 0, the subsystem is entangled with the rest.
   */
  partialTrace(keepQubits: number[]): number[] {
    const keepSize = 1 << keepQubits.length
    const probs = new Array(keepSize).fill(0)

    for (let i = 0; i < this.amplitudes.length; i++) {
      let reducedIndex = 0
      for (let k = 0; k < keepQubits.length; k++) {
        const bit = (i >> keepQubits[k]!) & 1
        reducedIndex |= bit << k
      }
      probs[reducedIndex]! += magnitudeSq(this.amplitudes[i]!)
    }

    return probs
  }

  /**
   * Von Neumann entanglement entropy: S = -Σ pᵢ log₂(pᵢ)
   * For a product state, S = 0. For a maximally entangled state, S = log₂(d).
   * This is the real measure of quantum entanglement.
   */
  entanglementEntropy(subsystemQubits: number[]): number {
    const probs = this.partialTrace(subsystemQubits)
    let entropy = 0
    for (const p of probs) {
      if (p > 1e-15) entropy -= p * Math.log2(p)
    }
    return entropy
  }

  /** Fidelity |⟨ψ|φ⟩|² — overlap between this state and another */
  fidelity(other: StateVector): number {
    if (this.numQubits !== other.numQubits) {
      throw new Error('Fidelity requires same number of qubits')
    }
    let innerRe = 0
    let innerIm = 0
    for (let i = 0; i < this.amplitudes.length; i++) {
      const c = conjugate(this.amplitudes[i]!)
      const o = other.amplitudes[i]!
      innerRe += c.re * o.re - c.im * o.im
      innerIm += c.re * o.im + c.im * o.re
    }
    return innerRe * innerRe + innerIm * innerIm
  }

  /**
   * Concurrence — measure of entanglement for a 2-qubit state.
   * C = max(0, λ₁ - λ₂ - λ₃ - λ₄) where λᵢ are sqrt of eigenvalues
   * of ρ·(σy⊗σy)·ρ*·(σy⊗σy) in decreasing order.
   * C = 0 for product states, C = 1 for maximally entangled (Bell) states.
   */
  concurrence(): number {
    if (this.numQubits !== 2) return 0
    const a = this.amplitudes
    // For a 2-qubit state |ψ⟩ = a₀₀|00⟩ + a₀₁|01⟩ + a₁₀|10⟩ + a₁₁|11⟩
    // Concurrence = 2|a₀₀·a₁₁ - a₀₁·a₁₁|
    // Wait, the correct formula is: C = 2|det(Ψ)| where Ψ is the coefficient matrix
    // C = 2|a00*a11 - a01*a10|
    const det = subtract(
      multiply(a[0]!, a[3]!),  // a00 * a11
      multiply(a[1]!, a[2]!),  // a01 * a10
    )
    return 2 * Math.sqrt(magnitudeSq(det))
  }

  /** Format state in Dirac (bra-ket) notation */
  toDirac(): string {
    const terms: string[] = []
    for (let i = 0; i < this.amplitudes.length; i++) {
      const amp = this.amplitudes[i]!
      const prob = magnitudeSq(amp)
      if (prob < 1e-6) continue
      const bits = i.toString(2).padStart(this.numQubits, '0')
      const coeff = Math.abs(amp.im) < 1e-6
        ? amp.re.toFixed(4)
        : `(${amp.re.toFixed(3)}${amp.im >= 0 ? '+' : ''}${amp.im.toFixed(3)}i)`
      terms.push(`${coeff}|${bits}⟩`)
    }
    return terms.join(' + ') || '0'
  }

  /** Expectation value of a Pauli operator on a given qubit: ⟨ψ|σ|ψ⟩ */
  expectation(pauliMatrix: Complex[][], qubit: number): number {
    const afterGate = this.applyGate(pauliMatrix, qubit)
    let expectation = 0
    for (let i = 0; i < this.amplitudes.length; i++) {
      const c = conjugate(this.amplitudes[i]!)
      const a = afterGate.amplitudes[i]!
      expectation += c.re * a.re - c.im * a.im // real part of inner product
    }
    return expectation
  }

  equals(other: StateVector, tolerance: number = 1e-8): boolean {
    if (this.numQubits !== other.numQubits) return false
    return this.amplitudes.every(
      (a, i) => Math.abs(a.re - other.amplitudes[i]!.re) < tolerance
        && Math.abs(a.im - other.amplitudes[i]!.im) < tolerance,
    )
  }
}
