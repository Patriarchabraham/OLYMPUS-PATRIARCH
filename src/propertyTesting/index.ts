/**
 * Property-Based Testing — Public API.
 *
 * QuickCheck-style testing integrated into Olympuz.
 * Generate random inputs, find edge cases, shrink to minimal counterexamples.
 */

export { PropertyRunner } from './propertyRunner.js'
export { analyzeCodeForProperties, extractFunctionSignatures, inferProperties } from './invariantInferrer.js'
export * as arbitraries from './arbitraries.js'

export type {
	Arbitrary,
	Generated,
	Property,
	PropertyResult,
	InferredProperty,
	PBTRunnerConfig,
	PBTRunSummary,
} from './types.js'

export { DEFAULT_PBT_CONFIG } from './types.js'
