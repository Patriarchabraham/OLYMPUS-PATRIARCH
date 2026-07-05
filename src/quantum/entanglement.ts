/**
 * Quantum Entanglement Engine — Real entanglement via Bell states and concurrence.
 *
 * In quantum mechanics, entanglement is a physical phenomenon where two particles
 * share a quantum state such that measuring one instantly determines the other,
 * regardless of distance. Mathematically, the joint state cannot be factored:
 *   |ψ⟩ ≠ |a⟩ ⊗ |b⟩  (non-separable)
 *
 * Entanglement is measured by:
 * - Concurrence: C = 0 (separable) to C = 1 (maximally entangled Bell state)
 * - Von Neumann entropy: S = 0 (product state) to S = log₂(d) (maximally entangled)
 *
 * This module creates real Bell states (|00⟩+|11⟩)/√2 using Hadamard + CNOT
 * and measures actual entanglement between reasoning dimensions.
 */

import { randomUUID } from 'node:crypto'
import { cosineSimilarity, generateEmbeddings } from '../knowledge/embeddings.js'
import { QuantumCircuit } from './circuit.js'
import type { StateVector } from './stateVector.js'
import type { EntanglementLink, QuantumDimension, QuantumReasoningState } from './types.js'

/**
 * Create real entanglement between reasoning states.
 * For each pair of dimensions, builds a quantum circuit that creates
 * a partially entangled state proportional to their correlation strength.
 *
 * When `embeddings` is provided (stateId → vector), dimension-pair correlation
 * is measured by cosine similarity over those embeddings — a far richer signal
 * than the keyword-overlap fallback. The map is computed once upstream by
 * `computeStateEmbeddings` so each pair is an O(1) lookup.
 */
export function entangle(
	states: QuantumReasoningState[],
	threshold: number = 0.1,
	embeddings?: Map<string, number[]>,
): EntanglementLink[] {
	const links: EntanglementLink[] = []

	// Pair states from different dimensions
	for (let i = 0; i < states.length; i++) {
		for (let j = i + 1; j < states.length; j++) {
			const stateA = states[i]!
			const stateB = states[j]!

			if (stateA.dimension === stateB.dimension) continue

			// Calculate correlation based on solution similarity
			const correlation = calculateCorrelation(
				stateA.solution,
				stateB.solution,
				embeddings?.get(stateA.id),
				embeddings?.get(stateB.id),
			)
			if (correlation < 0.2) continue // Skip weakly correlated pairs

			// Create real entangled state via Bell circuit
			// Use Ry rotation to encode correlation as entanglement strength
			// When correlation = 1, we get a maximally entangled Bell state
			const theta = Math.acos(1 - correlation) // angle encodes correlation
			const entangledState = createEntangledState(theta)

			// Measure real concurrence
			const concurrence = entangledState.concurrence()

			if (concurrence < threshold) continue

			// Measure real von Neumann entropy
			const entropy = entangledState.entanglementEntropy([0]) // trace out qubit 0

			// Find shared pattern
			const sharedPattern = findSharedPattern(stateA.solution, stateB.solution)

			links.push({
				id: `ent_${randomUUID().slice(0, 8)}`,
				stateA: stateA.id,
				stateB: stateB.id,
				dimensionA: stateA.dimension,
				dimensionB: stateB.dimension,
				concurrence,
				entropy,
				entangledState,
				sharedPattern,
			})
		}
	}

	return links
}

/**
 * Embed every state's solution once, keyed by state id, so `entangle` can score
 * pairs by cosine similarity. Uses the auto-detected embedding provider (OpenAI
 * → Ollama → local TF-IDF). Returns an empty map on any failure, which makes
 * `entangle` transparently fall back to keyword overlap.
 */
export async function computeStateEmbeddings(
	states: QuantumReasoningState[],
): Promise<Map<string, number[]>> {
	const embeddings = new Map<string, number[]>()
	if (states.length === 0) return embeddings
	try {
		const vectors = await generateEmbeddings(states.map((s) => s.solution))
		for (let i = 0; i < states.length; i++) {
			const vec = vectors[i]
			if (vec) embeddings.set(states[i]!.id, vec)
		}
	} catch {
		// Embeddings unavailable → empty map → caller falls back to keyword overlap.
	}
	return embeddings
}

/**
 * Propagate confidence through entanglement links.
 * Uses quantum interference: entangled states have correlated outcomes,
 * so high confidence in one dimension boosts the other through amplitude sharing.
 */
export function propagateConfidence(
	states: QuantumReasoningState[],
	links: EntanglementLink[],
): QuantumReasoningState[] {
	const stateMap = new Map(states.map((s) => [s.id, s]))

	for (const link of links) {
		const stateA = stateMap.get(link.stateA)
		const stateB = stateMap.get(link.stateB)
		if (!stateA || !stateB) continue

		// Propagation strength proportional to real concurrence
		const boost = link.concurrence * 0.08

		if (stateA.confidence > stateB.confidence) {
			stateB.confidence = Math.min(1, stateB.confidence + boost)
		} else {
			stateA.confidence = Math.min(1, stateA.confidence + boost)
		}
	}

	return Array.from(stateMap.values())
}

/**
 * Find clusters of entangled dimensions — groups connected by high concurrence.
 * These are "hot zones" where quantum interference is strongest.
 */
export function findClusters(links: EntanglementLink[]): Map<string, QuantumDimension[]> {
	const clusters = new Map<string, QuantumDimension[]>()
	const assigned = new Set<QuantumDimension>()

	for (const link of links) {
		if (assigned.has(link.dimensionA) && assigned.has(link.dimensionB)) continue

		let clusterKey: string | null = null
		for (const [key, dims] of Array.from(clusters.entries())) {
			if (dims.includes(link.dimensionA) || dims.includes(link.dimensionB)) {
				clusterKey = key
				break
			}
		}

		if (clusterKey) {
			const existing = clusters.get(clusterKey)!
			if (!existing.includes(link.dimensionA)) existing.push(link.dimensionA)
			if (!existing.includes(link.dimensionB)) existing.push(link.dimensionB)
		} else {
			clusterKey = `cluster_${clusters.size}`
			clusters.set(clusterKey, [link.dimensionA, link.dimensionB])
		}

		assigned.add(link.dimensionA)
		assigned.add(link.dimensionB)
	}

	return clusters
}

/**
 * Generate cross-dimensional insights from entanglement data.
 */
export function generateCrossInsights(
	links: EntanglementLink[],
	states: QuantumReasoningState[],
): string[] {
	const stateMap = new Map(states.map((s) => [s.id, s]))
	const insights: string[] = []

	for (const link of links) {
		const stateA = stateMap.get(link.stateA)
		const stateB = stateMap.get(link.stateB)
		if (!stateA || !stateB) continue

		const concurrencePct = (link.concurrence * 100).toFixed(1)
		const entropyBits = link.entropy.toFixed(2)

		insights.push(
			`[${stateA.dimension}↔${stateB.dimension}] ` +
				`"${link.sharedPattern}" — concurrence ${concurrencePct}%, ` +
				`entropy ${entropyBits} bits — ` +
				`optimizing ${stateA.dimension} directly improves ${stateB.dimension} ` +
				`via quantum correlation`,
		)
	}

	return insights
}

// --- Internal ---

/**
 * Create a real entangled state: cos(θ/2)|00⟩ + sin(θ/2)|11⟩
 * When θ = π/2, this is the maximally entangled Bell state (|00⟩+|11⟩)/√2.
 */
function createEntangledState(theta: number): StateVector {
	// Build via quantum circuit: |0⟩ → Ry(θ) → CNOT → entangled state
	const circuit = new QuantumCircuit(2)
	circuit.ry(theta, 0)
	circuit.cnot(0, 1)

	const result = circuit.run()
	return result.state
}

/**
 * Calculate correlation between two solutions.
 *
 * Prefers cosine similarity over pre-computed embeddings (semantic — captures
 * synonymy and topical overlap the keyword list misses) when vectors are
 * available; otherwise falls back to the keyword-overlap heuristic.
 */
function calculateCorrelation(
	solA: string,
	solB: string,
	vecA?: number[],
	vecB?: number[],
): number {
	if (vecA && vecB && vecA.length > 0 && vecA.length === vecB.length) {
		// Cosine similarity is already ~[-1, 1]; fold negatives to 0 (no positive
		// correlation) so they don't register as entanglement.
		return Math.max(0, cosineSimilarity(vecA, vecB))
	}
	return keywordOverlap(solA, solB)
}

/** Keyword-overlap fallback used when embeddings aren't available. */
function keywordOverlap(solA: string, solB: string): number {
	const keywords = [
		'error',
		'test',
		'cache',
		'validate',
		'optimize',
		'security',
		'performance',
		'access',
		'load',
		'render',
		'state',
		'data',
		'user',
		'component',
		'api',
		'query',
		'pattern',
		'module',
		'config',
		'type',
		'async',
		'lazy',
		'safe',
		'secure',
		'fast',
		'simple',
		'clean',
		'modular',
		'scalable',
		'trust',
		'boundary',
		'event',
		'feedback',
		'measure',
	]

	const a = solA.toLowerCase()
	const b = solB.toLowerCase()
	const shared = keywords.filter((k) => a.includes(k) && b.includes(k))

	return Math.min(1, shared.length * 0.15)
}

function findSharedPattern(solA: string, solB: string): string {
	const keywords = [
		'error',
		'test',
		'cache',
		'validate',
		'optimize',
		'security',
		'performance',
		'access',
		'load',
		'render',
		'state',
		'data',
		'user',
		'component',
		'api',
		'query',
		'pattern',
		'module',
	]

	const a = solA.toLowerCase()
	const b = solB.toLowerCase()
	const shared = keywords.filter((k) => a.includes(k) && b.includes(k))
	return shared.length > 0 ? shared.join(', ') : 'structural correlation'
}
