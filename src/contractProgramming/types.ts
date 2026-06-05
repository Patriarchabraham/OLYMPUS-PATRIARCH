/**
 * Design by Contract types — @pre, @post, @invariant annotations
 * parsed from JSDoc comments and verified statically + via SAT.
 */

/** Contract kind */
export type ContractKind = 'precondition' | 'postcondition' | 'invariant'

/** A single contract clause */
export interface ContractClause {
	/** The contract kind */
	kind: ContractKind
	/** The condition expression */
	condition: string
	/** Source file path */
	filePath: string
	/** Function name this contract belongs to */
	functionName: string
	/** Line number in source */
	lineNumber: number
	/** Parameter names involved */
	parameters: string[]
	/** Whether the condition can be checked statically */
	staticallyCheckable: boolean
}

/** Contract verification result for a single clause */
export interface ContractVerificationResult {
	/** The contract clause */
	clause: ContractClause
	/** Whether the contract is satisfied */
	satisfied: boolean
	/** Confidence level (0-1) */
	confidence: number
	/** Evidence for the verdict */
	evidence: string
	/** Counterexample if violated */
	counterexample: string | null
}

/** Full contract report for a function or file */
export interface ContractReport {
	/** Total contracts found */
	totalContracts: number
	/** Contracts satisfied */
	satisfied: number
	/** Contracts violated */
	violated: number
	/** Contracts that could not be verified */
	unverifiable: number
	/** Individual results */
	results: ContractVerificationResult[]
	/** Overall contract compliance score (0-1) */
	complianceScore: number
	/** Suggestions for fixing violations */
	suggestions: string[]
}

/** Contract configuration */
export interface ContractConfig {
	/** Enable static verification (default: true) */
	enableStaticVerification: boolean
	/** Enable SAT-based verification (default: true) */
	enableSATVerification: boolean
	/** Enable PBT integration (default: true) */
	enablePBTIntegration: boolean
	/** Minimum confidence threshold (default: 0.95) */
	confidenceThreshold: number
}

/** Default contract configuration */
export const DEFAULT_CONTRACT_CONFIG: ContractConfig = {
	enableStaticVerification: true,
	enableSATVerification: true,
	enablePBTIntegration: true,
	confidenceThreshold: 0.95,
}
