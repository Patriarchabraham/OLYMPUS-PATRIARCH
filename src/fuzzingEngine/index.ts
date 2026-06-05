/**
 * Fuzzing Engine — barrel exports.
 */

export { fuzz, fuzzString } from './fuzzer.js'
export type {
	MutationStrategy, CoverageInfo, FuzzTestCase, FuzzCrash,
	FuzzStats, FuzzConfig, FuzzResult,
} from './types.js'
export { DEFAULT_FUZZ_CONFIG } from './types.js'
