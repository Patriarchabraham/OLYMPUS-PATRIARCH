import { describe, expect, it } from 'vitest'
import { entangle } from './entanglement.js'
import type { QuantumDimension, QuantumReasoningState } from './types.js'

/** Build a minimal state — `entangle` reads id/dimension/solution but not the
 * quantum vector, so we can stub it for correlation-path tests. */
function mkState(id: string, dimension: QuantumDimension, solution: string): QuantumReasoningState {
	return {
		id,
		dimension,
		solution,
		confidence: 0.8,
		quantumState: null as never,
		basisIndex: 0,
	}
}

const hasLink = (links: ReturnType<typeof entangle>, a: string, b: string): boolean =>
	links.some((l) => (l.stateA === a && l.stateB === b) || (l.stateA === b && l.stateB === a))

describe('entangle — semantic correlation (lever 3)', () => {
	it('links dimension pairs by cosine similarity when embeddings are provided', () => {
		const a = mkState('a', 'security', 'add authentication checks')
		const b = mkState('b', 'performance', 'add authentication caching') // topically close to a
		const c = mkState('c', 'ux', 'restyle the welcome screen') // unrelated
		// a≈b (near-parallel vectors); c orthogonal to both.
		const embeddings = new Map<string, number[]>([
			['a', [1, 0, 0]],
			['b', [0.95, 0.05, 0]],
			['c', [0, 0, 1]],
		])

		const links = entangle([a, b, c], 0.0, embeddings)
		expect(hasLink(links, 'a', 'b')).toBe(true) // cosine ≈ 0.95 > 0.2
		expect(hasLink(links, 'a', 'c')).toBe(false) // cosine = 0
		expect(hasLink(links, 'b', 'c')).toBe(false) // cosine = 0
	})

	it('falls back to keyword overlap when embeddings are absent', () => {
		// Two shared keywords ('cache', 'security') → correlation 0.30 > 0.20 gate.
		const a = mkState('a', 'security', 'cache security tokens')
		const b = mkState('b', 'performance', 'cache security checks')
		const c = mkState('c', 'ux', 'redesign the empty state')

		const links = entangle([a, b, c], 0.0)
		expect(hasLink(links, 'a', 'b')).toBe(true) // share cache + security
		expect(hasLink(links, 'a', 'c')).toBe(false)
	})
})
