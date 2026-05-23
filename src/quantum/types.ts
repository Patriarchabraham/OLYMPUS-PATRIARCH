/**
 * Quantum Supreme — Type definitions for real quantum computing.
 *
 * These types describe actual quantum mechanical operations:
 * - State vectors with complex amplitudes
 * - Entanglement measured by concurrence and von Neumann entropy
 * - Collapse via Born rule projective measurement
 * - Tunneling via discrete-time quantum walks
 */

import type { Complex } from './complex.js'
import type { StateVector } from './stateVector.js'
import type { CircuitResult, MeasurementResult as CircuitMeasurement } from './circuit.js'

/** A dimension of analysis in the reasoning system */
export type QuantumDimension =
  | 'security'
  | 'performance'
  | 'architecture'
  | 'ux'
  | 'design'
  | 'business'
  | 'accessibility'
  | 'evolution'
  | 'correctness'
  | 'maintainability'

/** All 10 dimensions analyzed simultaneously */
export const QUANTUM_DIMENSIONS: QuantumDimension[] = [
  'security',
  'performance',
  'architecture',
  'ux',
  'design',
  'business',
  'accessibility',
  'evolution',
  'correctness',
  'maintainability',
]

/**
 * A quantum state in the reasoning system.
 * Maps a dimension's analysis to amplitudes in a real quantum state.
 */
export interface QuantumReasoningState {
  /** Unique ID */
  id: string
  /** Which dimension this state represents */
  dimension: QuantumDimension
  /** The reasoning content (analysis, solution) */
  solution: string
  /** Confidence score 0-1 */
  confidence: number
  /** Encoded as quantum amplitudes on a real state vector */
  quantumState: StateVector
  /** Basis state index that encodes this solution */
  basisIndex: number
}

/**
 * Real quantum entanglement between two reasoning states.
 * Measured by concurrence: C = 0 (product) to C = 1 (maximally entangled).
 */
export interface EntanglementLink {
  id: string
  stateA: string
  stateB: string
  dimensionA: QuantumDimension
  dimensionB: QuantumDimension
  /** Concurrence — real entanglement measure (0 = separable, 1 = Bell state) */
  concurrence: number
  /** Von Neumann entropy of the entangled subsystem */
  entropy: number
  /** The shared Bell/partially-entangled state */
  entangledState: StateVector
  /** Correlation pattern that links the dimensions */
  sharedPattern: string
}

/**
 * Result of quantum collapse via Born rule measurement.
 * The wave function collapses probabilistically — same math as real QCs.
 */
export interface CollapseResult {
  id: string
  /** The collapsed (measured) state */
  collapsedState: QuantumReasoningState
  /** The actual quantum measurement result */
  measurement: CircuitMeasurement[]
  /** Final state vector after collapse */
  finalQuantumState: StateVector
  /** Probability of this particular collapse outcome (Born rule) */
  bornProbability: number
  /** Runner-up states that were close */
  runnerUps: QuantumReasoningState[]
  /** Confidence after quantum measurement */
  confidence: number
  /** How many dimensions were covered */
  dimensionsEvaluated: number
  /** Number of entanglement links found */
  entanglementsFound: number
  /** Why this state won */
  collapseReason: string
  timestamp: number
}

/**
 * Quantum tunneling via discrete-time quantum walk.
 * A quantum walk on a graph explores paths in true superposition,
 * finding solutions that classical random walks would miss.
 */
export interface TunnelResult {
  id: string
  /** The barrier being tunneled through */
  barrier: string
  /** Description of the tunnel path found */
  tunnelPath: string
  /** Quantum walk type used */
  tunnelType: 'coined_walk' | 'continuous_walk' | 'grover_search' | 'qaoa'
  /** Confidence in this tunnel path */
  confidence: number
  /** Probability amplification from quantum walk interference */
  interferenceGain: number
  /** Number of quantum walk steps to find the path */
  walkSteps: number
  /** The quantum state after the walk */
  walkState: StateVector
}

/**
 * Full quantum analysis result with real quantum mechanics.
 */
export interface QuantumAnalysis {
  id: string
  query: string
  /** Reasoning states with real quantum encoding */
  states: QuantumReasoningState[]
  /** Real entanglement links with concurrence */
  entanglements: EntanglementLink[]
  /** Collapse via Born rule */
  collapseResult: CollapseResult | null
  /** Quantum walk tunneling results */
  tunnelResults: TunnelResult[]
  /** Overall confidence */
  confidence: number
  /** Dimensions covered */
  dimensionsCovered: QuantumDimension[]
  /** The full quantum circuit result */
  circuitResult: CircuitResult | null
  /** Execution time */
  durationMs: number
  timestamp: number
}

/** Configuration for quantum engine */
export interface QuantumConfig {
  /** Max reasoning states per dimension (default: 3) */
  maxStatesPerDimension: number
  /** Born rule threshold for collapse (default: 0.7) */
  collapseThreshold: number
  /** Minimum concurrence for entanglement detection (default: 0.1) */
  entanglementThreshold: number
  /** Enable quantum walk tunneling (default: true) */
  tunnelingEnabled: boolean
  /** Which dimensions to analyze */
  dimensions: QuantumDimension[]
  /** Max quantum walk steps (default: 20) */
  maxTunnelAttempts: number
  /** Number of measurement shots for sampling (default: 1024) */
  measurementShots: number
}

export const DEFAULT_QUANTUM_CONFIG: QuantumConfig = {
  maxStatesPerDimension: 3,
  collapseThreshold: 0.7,
  entanglementThreshold: 0.1,
  tunnelingEnabled: true,
  dimensions: [...QUANTUM_DIMENSIONS],
  maxTunnelAttempts: 20,
  measurementShots: 1024,
}
