/**
 * QuantumEngine — Orchestrator for real quantum computing operations.
 *
 * Full pipeline using actual quantum mechanics:
 * 1. SUPERPOSE: Encode LLM-generated candidates as complex amplitudes via Hadamard gates
 * 2. EVALUATE: Score via Born rule probability measurement
 * 3. PRUNE: Keep highest-probability states
 * 4. ENTANGLE: Create Bell states between correlated dimensions, measure concurrence
 * 5. PROPAGATE: Boost confidence proportional to real entanglement strength
 * 6. COLLAPSE: Born rule projective measurement → definite solution
 * 7. TUNNEL: Discrete-time quantum walk for barrier bypass
 *
 * Requires an LLM generator (`setGenerateFn`) to produce real candidates and
 * scores; without it `process()` degrades honestly rather than fabricating.
 *
 * Usage:
 *   const engine = new QuantumEngine()
 *   engine.setGenerateFn(generateFn)
 *   const analysis = await engine.process("How to design a secure, fast API?")
 *   console.log(analysis.collapseResult?.collapsedState.solution)
 *   console.log(`Born probability: ${analysis.collapseResult?.bornProbability}`)
 *   console.log(`Entanglement concurrence: ${analysis.entanglements[0]?.concurrence}`)
 */

import { randomUUID } from 'node:crypto'
import type { GenerateFn } from '../reasoning/types.js'
import { collapse, forceCollapse } from './collapse.js'
import { entangle, generateCrossInsights, propagateConfidence } from './entanglement.js'
import { evaluateStates, pruneStates, superpose } from './superposition.js'
import { detectBarriers, tunnel } from './tunneling.js'
import type {
	CollapseResult,
	EntanglementLink,
	QuantumAnalysis,
	QuantumConfig,
	QuantumReasoningState,
	TunnelResult,
} from './types.js'
import { DEFAULT_QUANTUM_CONFIG } from './types.js'

// Module-level state surfaced to /status (src/utils/mythosStatus.ts). Best-effort:
// reflects this process's quantum usage, set when an engine is wired/run.
let quantumOpsCount = 0
let quantumGenerateFnWired = false

/** Number of real quantum analyses completed in this process. */
export function getQuantumOpsCount(): number {
	return quantumOpsCount
}

/** Whether any QuantumEngine has had an LLM generator wired in this process. */
export function isQuantumGenerateFnWired(): boolean {
	return quantumGenerateFnWired
}

export class QuantumEngine {
	private config: QuantumConfig
	private analysisHistory: QuantumAnalysis[] = []
	private patternMemory: Map<string, number> = new Map()
	private generateFn?: GenerateFn

	constructor(config?: Partial<QuantumConfig>) {
		this.config = { ...DEFAULT_QUANTUM_CONFIG, ...config }
	}

	/**
	 * Wire the LLM-backed generator. Without it, `process()` degrades honestly
	 * (returns a placeholder analysis) rather than fabricating candidates.
	 * Mirrors `CortexEngine.setGenerateFn`; called by the orchestrator and the
	 * `/quantum` command during initialization.
	 */
	setGenerateFn(fn: GenerateFn): void {
		this.generateFn = fn
		quantumGenerateFnWired = true
	}

	/**
	 * Process a query through the full quantum pipeline.
	 * Each step uses real quantum operations on state vectors with complex
	 * amplitudes. Degrades honestly (empty, `degraded: true`) when no generator
	 * is wired or the LLM returned no usable candidates.
	 */
	async process(query: string): Promise<QuantumAnalysis> {
		const startTime = Date.now()

		// Honest degradation: no LLM wired → no real candidates. Do not fabricate.
		if (!this.generateFn) {
			return this.degradedAnalysis(query, startTime)
		}

		// Step 1: Superpose — encode LLM candidates as real quantum amplitudes
		let states = await superpose(query, this.config, this.generateFn)
		if (states.length === 0) {
			// The LLM returned nothing usable for any dimension — degrade honestly.
			return this.degradedAnalysis(query, startTime)
		}

		// Step 2: Evaluate — score via quantum measurement (Born rule)
		states = await evaluateStates(states, query, this.generateFn)

		// Step 3: Prune — keep highest-probability states
		states = pruneStates(states, 2)

		// Step 4: Entangle — create real Bell states, measure concurrence
		const entanglements: EntanglementLink[] = entangle(states, this.config.entanglementThreshold)

		// Step 5: Propagate — boost via real entanglement strength
		states = propagateConfidence(states, entanglements)

		// Step 6: Collapse — Born rule projective measurement
		let collapseResult: CollapseResult | null = collapse(states, entanglements, this.config)

		// Step 7: Tunnel — quantum walk if barriers exist
		let tunnelResults: TunnelResult[] = []
		const barriers = detectBarriers(states)
		if (barriers.length > 0 && this.config.tunnelingEnabled) {
			tunnelResults = tunnel(query, barriers, this.config.maxTunnelAttempts)

			// If tunneling found paths, retry collapse
			if (!collapseResult && tunnelResults.some((t) => t.confidence > 0.6)) {
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
			dimensionsCovered: Array.from(new Set(states.map((s) => s.dimension))),
			circuitResult: null,
			durationMs: Date.now() - startTime,
			timestamp: Date.now(),
		}

		quantumOpsCount++
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
		const analysis = this.analysisHistory.find((a) => a.id === analysisId)
		if (!analysis) return

		const multiplier = success ? 1.1 : 0.9
		for (const entanglement of analysis.entanglements) {
			const current = this.patternMemory.get(entanglement.sharedPattern) ?? 0.5
			this.patternMemory.set(entanglement.sharedPattern, Math.min(1, current * multiplier))
		}
	}

	// --- Internal ---

	/** Build a placeholder analysis used when the LLM is unavailable or empty. */
	private degradedAnalysis(query: string, startTime: number): QuantumAnalysis {
		const analysis: QuantumAnalysis = {
			id: `qa_${randomUUID().slice(0, 8)}`,
			query,
			states: [],
			entanglements: [],
			collapseResult: null,
			tunnelResults: [],
			confidence: 0,
			dimensionsCovered: [],
			circuitResult: null,
			durationMs: Date.now() - startTime,
			timestamp: Date.now(),
			degraded: true,
		}
		this.recordAnalysis(analysis)
		return analysis
	}

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
