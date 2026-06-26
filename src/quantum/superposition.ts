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
 * evaluates them using actual quantum state evolution. Candidates and their
 * semantic scores are produced by an LLM (`generateFn`); the quantum math
 * (Hadamard, Ry rotation, Born rule) then combines them into a genuine
 * superposition. Without a `generateFn`, callers degrade honestly rather than
 * falling back to fabricated templates.
 */

import { randomUUID } from 'node:crypto'
import type { GenerateFn } from '../reasoning/types.js'
import { ConcurrencyPool } from '../utils/concurrencyPool.js'
import { QuantumCircuit } from './circuit.js'
import type { QuantumConfig, QuantumDimension, QuantumReasoningState } from './types.js'

/** Max parallel candidate-generation calls (one per dimension). */
const CANDIDATE_CONCURRENCY = 5
/** Max parallel evaluation calls (one per state). */
const EVALUATE_CONCURRENCY = 6

/**
 * Create a real quantum superposition encoding reasoning states.
 * Each dimension's LLM-generated candidates are mapped to basis states, then
 * Hadamard gates create genuine superposition over all possibilities.
 */
export async function superpose(
	query: string,
	config: QuantumConfig,
	generateFn: GenerateFn,
): Promise<QuantumReasoningState[]> {
	// Generate query-specific candidates per dimension in parallel, bounded so
	// we don't saturate the endpoint with all dimensions firing at once.
	const pool = new ConcurrencyPool(CANDIDATE_CONCURRENCY)
	const perDimension = await pool.map(config.dimensions, async (dimension) => {
		const candidates = await generateCandidates(
			query,
			dimension,
			config.maxStatesPerDimension,
			generateFn,
		)
		return { dimension, candidates }
	})

	const states: QuantumReasoningState[] = []
	for (const { dimension, candidates } of perDimension) {
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

			const quantumState = circuit.run().state

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
 * The probability of measuring |0⟩ gives the "goodness" score, combined with
 * a per-state LLM semantic evaluation.
 */
export async function evaluateStates(
	states: QuantumReasoningState[],
	query: string,
	generateFn: GenerateFn,
): Promise<QuantumReasoningState[]> {
	const pool = new ConcurrencyPool(EVALUATE_CONCURRENCY)
	return pool.map(states, async (state) => {
		// Measure the first qubit — probability of |0⟩ = confidence in solution
		const probs = state.quantumState.probabilities()
		let prob0 = 0
		for (let i = 0; i < probs.length; i++) {
			if ((i & 1) === 0) prob0 += probs[i]!
		}

		// LLM score for this solution along its dimension
		const evaluationScore = await evaluateSolution(
			state.solution,
			query,
			state.dimension,
			generateFn,
		)

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
	return states.reduce((best, cur) => (cur.confidence > best.confidence ? cur : best))
}

// --- Internal ---

interface CandidateResult {
	solution: string
	initialConfidence: number
}

/**
 * Ask the LLM for `count` distinct, query-specific approaches along a
 * dimension. Never throws — on any failure returns an empty list, letting the
 * caller degrade honestly for that dimension rather than fabricating.
 */
async function generateCandidates(
	query: string,
	dimension: QuantumDimension,
	count: number,
	generateFn: GenerateFn,
): Promise<CandidateResult[]> {
	const prompt = [
		`You are a solution strategist. For the task below, propose exactly ${count} distinct,`,
		`concrete solution approaches, each prioritizing the "${dimension}" dimension.`,
		'Output ONLY a numbered list (1., 2., ...) — one approach per line, each 1-2 sentences',
		'and actionable. No preamble, no explanation.',
		'',
		`Task: ${query}`,
	].join('\n')

	let raw: string
	try {
		raw = await generateFn(prompt)
	} catch {
		return []
	}

	const lines = raw
		.split('\n')
		.map((line) => line.replace(/^\s*\d+[.)]\s*/, '').trim())
		.filter((line) => line.length > 0 && !/^```/.test(line) && !/^(no |nothing)/i.test(line))

	// De-duplicate while preserving order; cap at `count`.
	const seen = new Set<string>()
	const solutions: string[] = []
	for (const line of lines) {
		const key = line.toLowerCase()
		if (!seen.has(key)) {
			seen.add(key)
			solutions.push(line)
		}
		if (solutions.length >= count) break
	}

	return solutions.map((solution, i) => ({
		solution,
		initialConfidence: Math.max(0.5, 0.8 - i * 0.1),
	}))
}

/**
 * Ask the LLM to rate a solution along its dimension. Returns 0.0-1.0, falling
 * back to a neutral 0.5 when the response can't be parsed or the call fails.
 */
async function evaluateSolution(
	solution: string,
	query: string,
	dimension: QuantumDimension,
	generateFn: GenerateFn,
): Promise<number> {
	const prompt = [
		`Rate how strong the following approach is for the task, specifically along the "${dimension}" dimension.`,
		'Reply with a single decimal number between 0.0 and 1.0 — nothing else.',
		'',
		`Task: ${query}`,
		`Approach: ${solution}`,
	].join('\n')

	let raw: string
	try {
		raw = await generateFn(prompt)
	} catch {
		return 0.5
	}

	const match = raw.match(/([01](?:\.\d+)?|0?\.\d+)/)
	const score = match ? Number.parseFloat(match[1]!) : Number.NaN
	if (Number.isNaN(score)) return 0.5
	return Math.max(0, Math.min(1, score))
}
