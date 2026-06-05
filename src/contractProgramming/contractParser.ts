/**
 * Contract Parser — extracts @pre, @post, @invariant annotations
 * from JSDoc comments and maps them to the following function.
 */

import type { ContractClause, ContractKind } from './types.js'

/** Pending JSDoc contracts waiting for a function declaration */
interface PendingJSDoc {
	lines: string[]
	startLine: number
	params: string[]
}

/**
 * Parse JSDoc comments to extract contract clauses.
 * JSDoc blocks are associated with the function that follows them.
 *
 * @param source - Source code to parse
 * @param filePath - File path for reporting
 * @returns Array of contract clauses
 */
export function parseContracts(source: string, filePath: string): ContractClause[] {
	const clauses: ContractClause[] = []
	const lines = source.split('\n')

	let inJSDoc = false
	let jsDocLines: string[] = []
	let jsDocStartLine = 0
	let pendingJSDoc: PendingJSDoc | null = null

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i]
		const lineNum = i + 1

		// Track JSDoc blocks
		if (line.includes('/**')) {
			inJSDoc = true
			jsDocLines = [line]
			jsDocStartLine = lineNum
			if (line.includes('*/')) {
				// Single-line JSDoc — buffer it for the next function
				inJSDoc = false
				pendingJSDoc = {
					lines: jsDocLines,
					startLine: jsDocStartLine,
					params: extractParams(jsDocLines),
				}
				// Check if function is on the same line after */
				const afterJsDoc = line.slice(line.indexOf('*/') + 2)
				const funcName = extractFunctionName(afterJsDoc)
				if (funcName) {
					clauses.push(...extractClausesFromJSDoc(
						pendingJSDoc.lines,
						pendingJSDoc.startLine,
						funcName,
						filePath,
						pendingJSDoc.params,
					))
					pendingJSDoc = null
				}
			}
			continue
		}

		if (inJSDoc) {
			jsDocLines.push(line)
			if (line.includes('*/')) {
				inJSDoc = false
				pendingJSDoc = {
					lines: jsDocLines,
					startLine: jsDocStartLine,
					params: extractParams(jsDocLines),
				}
			}
			continue
		}

		// After JSDoc ends, look for function declaration
		if (pendingJSDoc) {
			const funcName = extractFunctionName(line)
			if (funcName) {
				clauses.push(...extractClausesFromJSDoc(
					pendingJSDoc.lines,
					pendingJSDoc.startLine,
					funcName,
					filePath,
					pendingJSDoc.params,
				))
				pendingJSDoc = null
			}
		}
	}

	return clauses
}

/**
 * Extract function name from a declaration line.
 */
function extractFunctionName(line: string): string | null {
	// Named function
	const funcMatch = line.match(/(?:export\s+)?(?:async\s+)?function\s+(\w+)/)
	if (funcMatch) return funcMatch[1]

	// Arrow function
	const arrowMatch = line.match(/(?:const|let)\s+(\w+)\s*=\s*(?:async\s*)?(?:\(|<)/)
	if (arrowMatch) return arrowMatch[1]

	// Method
	const methodMatch = line.match(/(?:public|private|protected)?\s*(?:async\s+)?(\w+)\s*\(/)
	if (methodMatch && !line.includes('function') && !line.includes('const') && !line.includes('let')) {
		return methodMatch[1]
	}

	return null
}

/**
 * Extract @param names from JSDoc lines.
 */
function extractParams(jsDocLines: string[]): string[] {
	const params: string[] = []
	const jsDoc = jsDocLines.join('\n')
	const paramPattern = /@param\s+(?:\{[^}]*\}\s+)?(\w+)/g
	let match: RegExpExecArray | null
	while ((match = paramPattern.exec(jsDoc)) !== null) {
		params.push(match[1])
	}
	return params
}

/**
 * Extract contract clauses from JSDoc lines.
 */
function extractClausesFromJSDoc(
	jsDocLines: string[],
	startLine: number,
	functionName: string,
	filePath: string,
	params: string[],
): ContractClause[] {
	const clauses: ContractClause[] = []
	const jsDoc = jsDocLines.join('\n')

	// Extract @pre / @precondition
	const prePattern = /@(?:pre|precondition)\s+(.+)/g
	let match: RegExpExecArray | null
	while ((match = prePattern.exec(jsDoc)) !== null) {
		clauses.push(createClause('precondition', match[1].trim(), filePath, functionName, startLine, params))
	}

	// Extract @post / @postcondition
	const postPattern = /@(?:post|postcondition)\s+(.+)/g
	while ((match = postPattern.exec(jsDoc)) !== null) {
		clauses.push(createClause('postcondition', match[1].trim(), filePath, functionName, startLine, params))
	}

	// Extract @invariant / @inv
	const invPattern = /@(?:invariant|inv)\s+(.+)/g
	while ((match = invPattern.exec(jsDoc)) !== null) {
		clauses.push(createClause('invariant', match[1].trim(), filePath, functionName, startLine, params))
	}

	return clauses
}

/**
 * Create a contract clause with static checkability analysis.
 */
function createClause(
	kind: ContractKind,
	condition: string,
	filePath: string,
	functionName: string,
	lineNumber: number,
	parameters: string[],
): ContractClause {
	return {
		kind,
		condition,
		filePath,
		functionName,
		lineNumber,
		parameters,
		staticallyCheckable: isStaticallyCheckable(condition, parameters),
	}
}

/**
 * Determine if a condition can be checked statically (without execution).
 */
function isStaticallyCheckable(condition: string, parameters: string[]): boolean {
	const simpleComparisons = parameters.length > 0 && parameters.some((p) => condition.includes(p))
	const typeChecks = /typeof\s+\w+/.test(condition) || /instanceof\s+\w+/.test(condition)
	const nullChecks = /\w+\s*!==?\s*(null|undefined)/.test(condition)
	const lengthChecks = /\w+\.length\s*[><=!]/.test(condition)
	const hasFunctionCalls = /\w+\(/.test(condition) && !typeChecks

	return (simpleComparisons || typeChecks || nullChecks || lengthChecks) && !hasFunctionCalls
}

/**
 * Extract all function signatures from source code.
 *
 * @param source - Source code
 * @returns Map of function name to parameter list
 */
export function extractFunctionSignatures(source: string): Map<string, string[]> {
	const signatures = new Map<string, string[]>()

	const funcPattern = /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)/g
	let match: RegExpExecArray | null
	while ((match = funcPattern.exec(source)) !== null) {
		const name = match[1]
		const params = match[2]
			.split(',')
			.map((p) => p.trim().replace(/:\s*[^=]+/, '').replace(/\s*=.+$/, '').trim())
			.filter((p) => p.length > 0)
		signatures.set(name, params)
	}

	const arrowPattern = /(?:const|let)\s+(\w+)\s*=\s*(?:async\s*)?\(([^)]*)\)\s*(?::\s*[^=]+)?\s*=>/g
	while ((match = arrowPattern.exec(source)) !== null) {
		const name = match[1]
		const params = match[2]
			.split(',')
			.map((p) => p.trim().replace(/:\s*[^=]+/, '').replace(/\s*=.+$/, '').trim())
			.filter((p) => p.length > 0)
		signatures.set(name, params)
	}

	return signatures
}
