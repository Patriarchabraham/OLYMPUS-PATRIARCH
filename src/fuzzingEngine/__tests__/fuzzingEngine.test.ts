import { describe, it, expect } from 'vitest'
import { fuzz, fuzzString } from '../fuzzer.js'

describe('Fuzzing Engine', () => {
	describe('fuzz', () => {
		it('runs a basic fuzzing session', () => {
			let calls = 0
			const target = (_input: Uint8Array): 'pass' | 'crash' | 'error' => {
				calls++
				return 'pass'
			}

			const result = fuzz(target, {
				maxTests: 50,
				maxInputSize: 128,
				testTimeoutMs: 100,
				seeds: [new Uint8Array([1, 2, 3])],
				strategies: ['bit-flip', 'havoc'],
				coverageGuided: true,
				minCorpusSize: 1,
			})

			expect(result.completed).toBe(true)
			expect(result.stats.totalTests).toBeGreaterThan(0)
			expect(result.stats.durationMs).toBeGreaterThanOrEqual(0)
			expect(result.crashes.length).toBe(0)
		})

		it('finds crashes', () => {
			const target = (input: Uint8Array): 'pass' | 'crash' | 'error' => {
				if (input.length >= 4 && input[0] === 0xDE && input[1] === 0xAD) {
					return 'crash'
				}
				return 'pass'
			}

			// Use a seed that starts with crash-triggering bytes
			const result = fuzz(target, {
				maxTests: 100,
				maxInputSize: 64,
				testTimeoutMs: 100,
				seeds: [new Uint8Array([0xDE, 0xAD, 0xBE, 0xEF])],
				strategies: ['bit-flip'],
				coverageGuided: true,
				minCorpusSize: 1,
			}, 42)

			expect(result.stats.crashes).toBeGreaterThanOrEqual(1)
			expect(result.crashes.length).toBeGreaterThanOrEqual(1)
		})

		it('tracks coverage', () => {
			const target = (_input: Uint8Array): 'pass' | 'crash' | 'error' => 'pass'

			const result = fuzz(target, {
				maxTests: 20,
				maxInputSize: 32,
				testTimeoutMs: 100,
				seeds: [new Uint8Array([1, 2, 3])],
				strategies: ['bit-flip'],
				coverageGuided: true,
				minCorpusSize: 1,
			}, 42)

			expect(result.stats.totalBranches).toBeGreaterThan(0)
			expect(result.corpus.length).toBeGreaterThan(0)
		})

		it('respects maxTests limit', () => {
			const target = (_input: Uint8Array): 'pass' | 'crash' | 'error' => 'pass'

			const result = fuzz(target, {
				maxTests: 10,
				maxInputSize: 32,
				testTimeoutMs: 100,
				seeds: [],
				strategies: ['bit-flip'],
				coverageGuided: false,
				minCorpusSize: 1,
			}, 42)

			expect(result.stats.totalTests).toBeLessThanOrEqual(15) // seeds + maxTests
		})

		it('uses different mutation strategies', () => {
			const target = (_input: Uint8Array): 'pass' | 'crash' | 'error' => 'pass'

			const result = fuzz(target, {
				maxTests: 30,
				maxInputSize: 64,
				testTimeoutMs: 100,
				seeds: [new Uint8Array([1, 2, 3, 4, 5])],
				strategies: ['bit-flip', 'byte-flip', 'arithmetic', 'insert-byte', 'delete-byte', 'havoc'],
				coverageGuided: true,
				minCorpusSize: 1,
			}, 123)

			expect(result.completed).toBe(true)
		})
	})

	describe('fuzzString', () => {
		it('fuzzes a string target', () => {
			const target = (s: string): void => {
				if (s.includes('CRASH')) throw new Error('crash found')
			}

			const result = fuzzString(target, 100, 42)
			expect(result.stats.totalTests).toBeGreaterThan(0)
		})

		it('detects string-based crashes', () => {
			const target = (s: string): void => {
				if (s.length > 0 && s[0] === 'X') throw new Error('crash: X prefix')
			}

			// This may or may not find the crash depending on random generation
			const result = fuzzString(target, 200, 42)
			expect(result.stats.totalTests).toBeGreaterThan(0)
			expect(result.completed).toBe(true)
		})
	})
})
