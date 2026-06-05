/**
 * Contract Verifier — verifies @pre/@post/@invariant contracts
 * using static analysis and SAT-based reasoning.
 */

import type { ContractClause, ContractConfig, ContractReport, ContractVerificationResult } from './types.js'
import { DEFAULT_CONTRACT_CONFIG } from './types.js'
import { solveDPLL } from '../satSolver/dpll.js'
import type { CNFFormula } from '../satSolver/types.js'

/**
 * Verify all contracts in a source file.
 *
 * @param clauses - Parsed contract clauses
 * @param source - Original source code for context
 * @param config - Verification configuration
 * @returns Full contract report
 */
export function verifyContracts(
	clauses: ContractClause[],
	source: string,
	config: ContractConfig = DEFAULT_CONTRACT_CONFIG,
): ContractReport {
	const results: ContractVerificationResult[] = []
	let satisfied = 0
	let violated = 0
	let unverifiable = 0

	for (const clause of clauses) {
		const result = verifyClause(clause, source, config)
		results.push(result)

		if (result.confidence >= config.confidenceThreshold) {
			if (result.satisfied) satisfied++
			else violated++
		} else {
			unverifiable++
		}
	}

	const complianceScore = clauses.length > 0
		? satisfied / clauses.length
		: 1

	const suggestions = generateContractSuggestions(results)

	return {
		totalContracts: clauses.length,
		satisfied,
		violated,
		unverifiable,
		results,
		complianceScore,
		suggestions,
	}
}

/**
 * Verify a single contract clause.
 */
function verifyClause(
	clause: ContractClause,
	source: string,
	config: ContractConfig,
): ContractVerificationResult {
	// Try static verification first
	if (config.enableStaticVerification && clause.staticallyCheckable) {
		const staticResult = verifyStatically(clause, source)
		if (staticResult.confidence >= config.confidenceThreshold) {
			return staticResult
		}
	}

	// Try SAT-based verification
	if (config.enableSATVerification) {
		const satResult = verifyViaSAT(clause, source)
		if (satResult.confidence >= 0.5) {
			return satResult
		}
	}

	// Could not verify
	return {
		clause,
		satisfied: false,
		confidence: 0,
		evidence: 'Contract could not be verified automatically',
		counterexample: null,
	}
}

/**
 * Verify a contract clause using static pattern analysis.
 */
function verifyStatically(clause: ContractClause, source: string): ContractVerificationResult {
	const { condition, kind, functionName } = clause

	// Find the function body
	const funcStart = source.indexOf(`function ${functionName}`)
	if (funcStart === -1) {
		return {
			clause,
			satisfied: false,
			confidence: 0.1,
			evidence: `Function ${functionName} not found in source`,
			counterexample: null,
		}
	}

	const funcSource = extractFunctionBody(source, funcStart)

	// Check precondition: parameter validation exists
	if (kind === 'precondition') {
		return verifyPrecondition(clause, funcSource)
	}

	// Check postcondition: return value matches condition
	if (kind === 'postcondition') {
		return verifyPostcondition(clause, funcSource)
	}

	// Check invariant: property maintained throughout
	if (kind === 'invariant') {
		return verifyInvariant(clause, funcSource)
	}

	return {
		clause,
		satisfied: false,
		confidence: 0,
		evidence: 'Unknown contract kind',
		counterexample: null,
	}
}

/**
 * Verify a precondition contract.
 */
function verifyPrecondition(clause: ContractClause, funcSource: string): ContractVerificationResult {
	const { condition, parameters } = clause

	// Check if the function validates the parameter
	for (const param of parameters) {
		// Guard clause pattern: if (!param) throw / if (param === null)
		const guardPattern = new RegExp(`if\\s*\\(\\s*!?${param}\\s*(?:===?|!==?)`)
		const typeofGuard = new RegExp(`typeof\\s+${param}\\s*===?\\s*['"]`)

		if (guardPattern.test(funcSource) || typeofGuard.test(funcSource)) {
			return {
				clause,
				satisfied: true,
				confidence: 0.85,
				evidence: `Parameter ${param} is validated in function body`,
				counterexample: null,
			}
		}
	}

	// Check if condition is enforced (e.g., param > 0 checked)
	const condParam = parameters.find((p) => condition.includes(p))
	if (condParam) {
		const condCheck = new RegExp(`if\\s*\\(.*${condParam}.*\\)`)
		if (condCheck.test(funcSource)) {
			return {
				clause,
				satisfied: true,
				confidence: 0.7,
				evidence: `Condition involving ${condParam} is checked`,
				counterexample: null,
			}
		}
	}

	return {
		clause,
		satisfied: false,
		confidence: 0.3,
		evidence: `Precondition "${condition}" not enforced in function body`,
		counterexample: `${parameters.join(', ')} with values violating "${condition}"`,
	}
}

/**
 * Verify a postcondition contract.
 */
function verifyPostcondition(clause: ContractClause, funcSource: string): ContractVerificationResult {
	const { condition } = clause

	// Check if return statement satisfies postcondition
	const returnMatch = funcSource.match(/return\s+(.+)/g)
	if (!returnMatch) {
		return {
			clause,
			satisfied: false,
			confidence: 0.2,
			evidence: 'No return statement found',
			counterexample: 'Function does not return a value',
		}
	}

	// Simple pattern: postcondition mentions a value that appears in return
	const condVars = condition.match(/\b\w+\b/g) || []
	const returnValues = returnMatch.map((r) => r.replace('return ', '').trim())

	for (const rv of returnValues) {
		const matchesCondVars = condVars.some((v) => rv.includes(v))
		if (matchesCondVars || condition.includes(rv)) {
			return {
				clause,
				satisfied: true,
				confidence: 0.7,
				evidence: `Return value "${rv}" relates to postcondition "${condition}"`,
				counterexample: null,
			}
		}
	}

	return {
		clause,
		satisfied: false,
		confidence: 0.3,
		evidence: `Return value does not obviously satisfy "${condition}"`,
		counterexample: 'Input that would produce wrong return value',
	}
}

/**
 * Verify an invariant contract.
 */
function verifyInvariant(clause: ContractClause, funcSource: string): ContractVerificationResult {
	const { condition } = clause

	// Check if the condition is maintained (assertions, checks)
	const assertPattern = new RegExp(`(?:console\\.assert|assert|expect).*${escapeRegex(condition.slice(0, 20))}`, 'i')
	if (assertPattern.test(funcSource)) {
		return {
			clause,
			satisfied: true,
			confidence: 0.8,
			evidence: `Invariant "${condition}" is asserted in function body`,
			counterexample: null,
		}
	}

	// Check if condition variables appear in the function
	const condVars = condition.match(/\b\w+\b/g) || []
	const relevantVars = condVars.filter((v) => funcSource.includes(v))

	if (relevantVars.length > 0) {
		return {
			clause,
			satisfied: true,
			confidence: 0.5,
			evidence: `Invariant variables [${relevantVars.join(', ')}] are present but no explicit assertion found`,
			counterexample: null,
		}
	}

	return {
		clause,
		satisfied: false,
		confidence: 0.2,
		evidence: `Invariant "${condition}" not checked in function`,
		counterexample: `State where "${condition}" is violated`,
	}
}

/**
 * Verify a contract via SAT solving.
 * Converts the contract to a boolean constraint and checks satisfiability.
 */
function verifyViaSAT(clause: ContractClause, _source: string): ContractVerificationResult {
	const { condition } = clause

	// Extract boolean variables from condition
	const boolVars = condition.match(/\b([a-zA-Z_]\w*)\b/g) || []
	const uniqueVars = [...new Set(boolVars.filter((v) => !['true', 'false', 'null', 'undefined'].includes(v)))]

	if (uniqueVars.length === 0) {
		return {
			clause,
			satisfied: false,
			confidence: 0.1,
			evidence: 'No boolean variables found for SAT analysis',
			counterexample: null,
		}
	}

	// Build a simple CNF from the condition
	// For precondition: check if negation is satisfiable (if yes, precondition can be violated)
	const formula: CNFFormula = []

	// Map variables to SAT numbers
	const varMap = new Map(uniqueVars.map((v, i) => [v, i + 1]))

	// Simple: each variable becomes a clause (the condition must hold)
	for (const v of uniqueVars) {
		const satVar = varMap.get(v) ?? 1
		const isNegated = condition.includes(`!${v}`) || condition.includes(`not ${v}`)
		formula.push([isNegated ? -satVar : satVar])
	}

	// Check if the negation is satisfiable (can the contract be violated?)
	const negatedFormula: CNFFormula = formula.map((clause) => clause.map((lit) => -lit))
	const result = solveDPLL(negatedFormula)

	if (!result.satisfiable) {
		// Negation is UNSAT → contract always holds
		return {
			clause,
			satisfied: true,
			confidence: 0.9,
			evidence: `Negation of contract is unsatisfiable — contract always holds`,
			counterexample: null,
		}
	}

	return {
		clause,
		satisfied: false,
		confidence: 0.6,
		evidence: `Negation is satisfiable — contract can be violated`,
		counterexample: `Values: ${uniqueVars.map((v) => `${v}=?`).join(', ')}`,
	}
}

/**
 * Extract function body from source starting at function position.
 */
function extractFunctionBody(source: string, funcStart: number): string {
	let braceCount = 0
	let started = false
	const body: string[] = []
	const lines = source.slice(funcStart).split('\n')

	for (const line of lines) {
		for (const char of line) {
			if (char === '{') {
				braceCount++
				started = true
			}
			if (char === '}') {
				braceCount--
			}
		}
		body.push(line)
		if (started && braceCount === 0) break
	}

	return body.join('\n')
}

/**
 * Generate suggestions for contract violations.
 */
function generateContractSuggestions(results: ContractVerificationResult[]): string[] {
	const suggestions: string[] = []
	const violated = results.filter((r) => !r.satisfied)

	for (const v of violated) {
		switch (v.clause.kind) {
			case 'precondition':
				suggestions.push(`[${v.clause.functionName}] Add guard clause for precondition: "${v.clause.condition}"`)
				break
			case 'postcondition':
				suggestions.push(`[${v.clause.functionName}] Verify return value satisfies: "${v.clause.condition}"`)
				break
			case 'invariant':
				suggestions.push(`[${v.clause.functionName}] Add assertion for invariant: "${v.clause.condition}"`)
				break
		}
	}

	if (suggestions.length === 0 && results.length > 0) {
		suggestions.push('All contracts verified successfully!')
	}

	return suggestions
}

function escapeRegex(str: string): string {
	return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
