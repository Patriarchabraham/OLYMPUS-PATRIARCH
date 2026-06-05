/**
 * Arbitraries — type-aware generators with shrinking.
 *
 * Generates random values of specific types and can shrink them
 * toward simpler candidates for minimal counterexample finding.
 */

import type { Arbitrary, Generated } from './types.js'

// ─── Pseudo-random number generator (mulberry32) ──────────────────────

/**
 * Mulberry32 PRNG — fast, deterministic, excellent distribution.
 */
export function mulberry32(seed: number): () => number {
	let state = seed | 0
	return () => {
		state = (state + 0x6D2B79F5) | 0
		let t = Math.imul(state ^ (state >>> 15), 1 | state)
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296
	}
}

// ─── Primitive Arbitraries ─────────────────────────────────────────────

/** Arbitrary for integers in [min, max] */
export const integer = (min = -1000, max = 1000): Arbitrary<number> => ({
	name: `integer(${min}, ${max})`,
	generate(seed: number, _size: number): Generated<number> {
		const rng = mulberry32(seed)
		const range = max - min + 1
		const value = Math.floor(rng() * range) + min
		return { value, seed, complexity: 1 }
	},
	shrink(value: number): number[] {
		const candidates: number[] = []
		if (value > 0) {
			candidates.push(0, Math.floor(value / 2), value - 1)
		} else if (value < 0) {
			candidates.push(0, Math.ceil(value / 2), value + 1)
		}
		return candidates.filter((c) => c !== value)
	},
})

/** Arbitrary for numbers (including floats) */
export const float = (min = -1000, max = 1000): Arbitrary<number> => ({
	name: `float(${min}, ${max})`,
	generate(seed: number, _size: number): Generated<number> {
		const rng = mulberry32(seed)
		const value = min + rng() * (max - min)
		return { value, seed, complexity: 1 }
	},
	shrink(value: number): number[] {
		const candidates: number[] = [0]
		if (value > 0) candidates.push(value / 2)
		if (value < 0) candidates.push(value / 2)
		return candidates.filter((c) => c !== value)
	},
})

/** Arbitrary for booleans */
export const boolean: Arbitrary<boolean> = {
	name: 'boolean',
	generate(seed: number, _size: number): Generated<boolean> {
		const rng = mulberry32(seed)
		return { value: rng() < 0.5, seed, complexity: 1 }
	},
	shrink(_value: boolean): boolean[] {
		return [false]
	},
}

/** Arbitrary for strings with configurable character set */
export const string = (maxLength = 20, charset?: string): Arbitrary<string> => {
	const chars = charset ?? 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 !@#$%'
	return {
		name: `string(maxLength=${maxLength})`,
		generate(seed: number, size: number): Generated<string> {
			const rng = mulberry32(seed)
			const len = Math.floor(rng() * Math.min(maxLength, size + 1))
			let result = ''
			for (let i = 0; i < len; i++) {
				result += chars[Math.floor(rng() * chars.length)]
			}
			return { value: result, seed, complexity: len }
		},
		shrink(value: string): string[] {
			const candidates: string[] = ['']
			if (value.length > 1) {
				candidates.push(value.slice(0, Math.floor(value.length / 2)))
				candidates.push(value.slice(1))
				candidates.push(value.slice(0, -1))
			}
			return candidates.filter((c) => c !== value)
		},
	}
}

/** Arbitrary for arrays of a given element type */
export function array<T>(elementArb: Arbitrary<T>, maxLength = 10): Arbitrary<T[]> {
	return {
		name: `array(${elementArb.name})`,
		generate(seed: number, size: number): Generated<T[]> {
			const rng = mulberry32(seed)
			const len = Math.floor(rng() * Math.min(maxLength, size + 1))
			const values: T[] = []
			for (let i = 0; i < len; i++) {
				const elemSeed = mulberry32(seed + i + 1)()
				const generated = elementArb.generate(elemSeed, Math.max(1, size / 2))
				values.push(generated.value)
			}
			return { value: values, seed, complexity: len }
		},
		shrink(value: T[]): T[][] {
			const candidates: T[][] = [[]]
			if (value.length > 1) {
				candidates.push(value.slice(0, Math.floor(value.length / 2)))
				candidates.push(value.slice(1))
				candidates.push(value.slice(0, -1))
			}
			// Also try shrinking individual elements
			for (let i = 0; i < Math.min(value.length, 3); i++) {
				const elemShrinks = elementArb.shrink(value[i])
				for (const shrunk of elemShrinks.slice(0, 2)) {
					const copy = [...value]
					copy[i] = shrunk
					candidates.push(copy)
				}
			}
			return candidates.filter((c) => JSON.stringify(c) !== JSON.stringify(value))
		},
	}
}

/** Arbitrary that always returns a constant value */
export function constant<T>(value: T): Arbitrary<T> {
	return {
		name: `constant(${JSON.stringify(value)})`,
		generate(seed: number, _size: number): Generated<T> {
			return { value, seed, complexity: 0 }
		},
		shrink(_value: T): T[] {
			return []
		},
	}
}

/** Arbitrary that picks from a set of values */
export function oneof<T>(...arbs: Arbitrary<T>[]): Arbitrary<T> {
	return {
		name: `oneof(${arbs.map((a) => a.name).join(', ')})`,
		generate(seed: number, size: number): Generated<T> {
			const rng = mulberry32(seed)
			const idx = Math.floor(rng() * arbs.length)
			const gen = arbs[idx].generate(seed + idx, size)
			return { ...gen, seed }
		},
		shrink(value: T): T[] {
			const allShrinks: T[] = []
			for (const arb of arbs) {
				allShrinks.push(...arb.shrink(value))
			}
			return [...new Set(allShrinks)]
		},
	}
}

/** Arbitrary for tuples (fixed-length arrays with different types per element) */
export function tuple<T extends unknown[]>(
	...arbs: { [K in keyof T]: Arbitrary<T[K]> }
): Arbitrary<T> {
	return {
		name: `tuple(${arbs.map((a) => a.name).join(', ')})`,
		generate(seed: number, size: number): Generated<T> {
			const values = arbs.map((arb, i) =>
				arb.generate(mulberry32(seed + i + 1)(), Math.max(1, size / arbs.length)).value
			) as T
			return { value: values, seed, complexity: arbs.length }
		},
		shrink(value: T): T[] {
			const candidates: T[] = []
			for (let i = 0; i < value.length; i++) {
				const shrinks = arbs[i].shrink(value[i])
				for (const shrunk of shrinks.slice(0, 3)) {
					const copy = [...value] as T
					copy[i] = shrunk
					candidates.push(copy)
				}
			}
			return candidates.filter((c) => JSON.stringify(c) !== JSON.stringify(value))
		},
	}
}
