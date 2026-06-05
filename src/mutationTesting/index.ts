/**
 * Mutation Testing — Public API.
 *
 * Generate code mutants and measure test suite quality.
 * A high mutation score means tests catch real bugs, not just cover lines.
 */

export { generateMutants, computeMutationScore, generateSuggestions } from './mutantGenerator.js'

export type {
	Mutant,
	MutantOperator,
	MutantStatus,
	MutationScore,
	MutationConfig,
	MutationReport,
} from './types.js'

export { DEFAULT_MUTATION_CONFIG } from './types.js'
