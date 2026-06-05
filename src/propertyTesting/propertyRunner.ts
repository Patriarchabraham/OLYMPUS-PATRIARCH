/**
 * Property Runner — executes properties with random inputs,
 * finds counterexamples, and shrinks to minimal failing cases.
 *
 * QuickCheck-style: run N random tests, on failure shrink toward
 * the simplest input that reproduces the bug.
 */

import type { Arbitrary, PBTRunSummary, Property, PropertyResult } from './types.js'
import { DEFAULT_PBT_CONFIG } from './types.js'
import type { PBTRunnerConfig } from './types.js'

export class PropertyRunner {
	private config: PBTRunnerConfig

	constructor(config?: Partial<PBTRunnerConfig>) {
		this.config = { ...DEFAULT_PBT_CONFIG, ...config }
	}

	/**
	 * Run a single property with random inputs.
	 * Returns a PropertyResult with pass/fail and counterexample.
	 */
	runProperty<T>(property: Property<T>): PropertyResult {
		const startTime = Date.now()
		const seed = this.config.seed || Date.now()
		let testsRun = 0

		for (let i = 0; i < this.config.numTests; i++) {
			const testSeed = seed + i * 7919 // Spread seeds using prime
			const size = Math.min(this.config.maxSize, Math.floor(i / 10) + 1)
			const generated = property.arbitrary.generate(testSeed, size)
			testsRun++

			try {
				const result = property.predicate(generated.value)
				if (result === false) {
					// Found a counterexample — shrink it
					const minimal = this.config.enableShrinking
						? this.shrinkCounterexample(property, generated.value)
						: generated.value

					return {
						property: property.name,
						passed: false,
						testsRun,
						counterexample: generated.value,
						minimalCounterexample: minimal,
						durationMs: Date.now() - startTime,
						seed,
					}
				}
			} catch (error) {
				const minimal = this.config.enableShrinking
					? this.shrinkCounterexample(property, generated.value)
					: generated.value

				return {
					property: property.name,
					passed: false,
					testsRun,
					counterexample: generated.value,
					minimalCounterexample: minimal,
					error: error instanceof Error ? error.message : String(error),
					durationMs: Date.now() - startTime,
					seed,
				}
			}
		}

		return {
			property: property.name,
			passed: true,
			testsRun,
			durationMs: Date.now() - startTime,
			seed,
		}
	}

	/**
	 * Run multiple properties and return a summary.
	 */
	runAll<T>(properties: Property<T>[]): PBTRunSummary {
		const startTime = Date.now()
		const results: PropertyResult[] = []
		let totalTests = 0

		for (const prop of properties) {
			const result = this.runProperty(prop)
			results.push(result)
			totalTests += result.testsRun
		}

		return {
			totalProperties: properties.length,
			passed: results.filter((r) => r.passed).length,
			failed: results.filter((r) => !r.passed).length,
			results,
			totalTestsRun: totalTests,
			durationMs: Date.now() - startTime,
		}
	}

	/**
	 * Shrink a counterexample to the minimal failing input.
	 * Uses iterative shrinking: repeatedly shrink and check if still fails.
	 */
	private shrinkCounterexample<T>(property: Property<T>, value: T): T {
		let current = value
		let iterations = 0

		while (iterations < this.config.maxShrinkIterations) {
			const shrinks = property.arbitrary.shrink(current)
			if (shrinks.length === 0) break

			let foundSmaller = false
			for (const shrunk of shrinks) {
				try {
					const result = property.predicate(shrunk)
					if (result === false) {
						current = shrunk
						foundSmaller = true
						break
					}
				} catch {
					// Shrunk value also causes error — it's a valid smaller counterexample
					current = shrunk
					foundSmaller = true
					break
				}
			}

			if (!foundSmaller) break
			iterations++
		}

		return current
	}

	/**
	 * Run a quick check with a single property.
	 * Returns true if the property holds for all generated inputs.
	 */
	check<T>(name: string, arbitrary: Arbitrary<T>, predicate: (value: T) => boolean | void): PropertyResult {
		return this.runProperty({ name, arbitrary, predicate })
	}

	/**
	 * Get the current configuration.
	 */
	getConfig(): PBTRunnerConfig {
		return { ...this.config }
	}
}
