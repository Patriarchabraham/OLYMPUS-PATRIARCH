/**
 * Design by Contract — barrel exports and singleton.
 */

export { parseContracts, extractFunctionSignatures } from './contractParser.js'
export { verifyContracts } from './contractVerifier.js'
export type {
	ContractKind,
	ContractClause,
	ContractVerificationResult,
	ContractReport,
	ContractConfig,
} from './types.js'
export { DEFAULT_CONTRACT_CONFIG } from './types.js'
