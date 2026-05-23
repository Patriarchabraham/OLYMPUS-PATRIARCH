/**
 * Quantum Supreme Module — Real quantum computing for Mythos Patriarch.
 *
 * This module implements actual quantum mechanics simulation:
 * - Complex number arithmetic for quantum amplitudes
 * - N-qubit state vectors in Hilbert space
 * - Standard quantum gates (Hadamard, Pauli, CNOT, rotations)
 * - Born rule measurement and projective collapse
 * - Entanglement measured by concurrence and von Neumann entropy
 * - Discrete-time quantum walks for tunneling
 *
 * The same mathematics used in Qiskit, Cirq, and PennyLane —
 * just implemented in TypeScript for the reasoning engine.
 *
 * Usage:
 *   import { QuantumEngine } from '../quantum/index.js'
 *   const engine = new QuantumEngine()
 *   const result = await engine.process(query)
 *   console.log(result.collapseResult?.collapsedState.solution)
 */

// Core quantum computing primitives
export { Complex, complex, ZERO, ONE, IMAG, add, multiply, conjugate, magnitude, magnitudeSq, expi, phase, scale, divide, subtract, approxEqual, format, innerProduct, tensorProduct } from './complex.js'
export { StateVector } from './stateVector.js'
export {
  I_GATE, X_GATE, Y_GATE, Z_GATE, H_GATE,
  S_GATE, SDAGGER_GATE, T_GATE, TDAGGER_GATE, SX_GATE,
  CNOT_GATE, SWAP_GATE, CZ_GATE, CH_GATE,
  phaseGate, rxGate, ryGate, rzGate,
  composeGates, dagger, gateTensorProduct, isUnitary,
} from './gates.js'
export { QuantumCircuit, bellStateCircuit, ghzStateCircuit, wStateCircuit, qftCircuit } from './circuit.js'
export type { GateStep, CircuitResult, MeasurementResult as CircuitMeasurement } from './circuit.js'
export { sample, sampleShots, measureQubits, expectationValue, measureX, measureY, measureZ } from './measurement.js'
export type { QubitMeasurement, MeasurementResult, ShotHistogram } from './measurement.js'

// Application layer — quantum reasoning engine
export { QuantumEngine } from './quantumEngine.js'
export { superpose, evaluateStates, pruneStates, getBestState } from './superposition.js'
export { entangle, propagateConfidence, findClusters, generateCrossInsights } from './entanglement.js'
export { collapse, forceCollapse } from './collapse.js'
export { detectBarriers, tunnel } from './tunneling.js'

// Types
export type {
  QuantumDimension,
  QuantumReasoningState,
  EntanglementLink,
  CollapseResult,
  TunnelResult,
  QuantumAnalysis,
  QuantumConfig,
} from './types.js'
export { QUANTUM_DIMENSIONS, DEFAULT_QUANTUM_CONFIG } from './types.js'
