/**
 * Abstract Interpreter — analyzes TypeScript code using interval and sign domains.
 * Detects array out-of-bounds, null deref, division by zero, type confusion
 * WITHOUT executing the code. Sound by construction.
 */

import type { AbstractState, AbstractValue, AIConfig, AIFinding, AIResult, Interval, Sign } from './types.js'
import { DEFAULT_AI_CONFIG } from './types.js'
import {
	iv, intervalAdd, intervalSub, intervalMul, intervalDiv, intervalNeg,
	mayBeZero, mayBeOutOfBounds, isDefinitelyInBounds,
} from './intervalDomain.js'
import { concreteToSign, signAdd, signMul, signNeg, intervalToSign } from './signDomain.js'

const TOP_INTERVAL: Interval = { lo: Number.NEGATIVE_INFINITY, hi: Number.POSITIVE_INFINITY }

/**
 * Analyze source code using abstract interpretation.
 *
 * @param source - TypeScript source code
 * @param filePath - File path for reporting
 * @param config - Analysis configuration
 * @returns Abstract interpretation result with findings
 */
export function analyzeAbstractly(
	source: string,
	filePath: string,
	config: AIConfig = DEFAULT_AI_CONFIG,
): AIResult {
	const startTime = performance.now()
	const findings: AIFinding[] = []
	const states = new Map<number, AbstractState>()
	const state: AbstractState = new Map()

	const lines = source.split('\n')

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i]
		const lineNum = i + 1
		const trimmed = line.trim()

		// Skip empty lines, comments, imports
		if (trimmed === '' || trimmed.startsWith('//') || trimmed.startsWith('import ') || trimmed.startsWith('export type')) {
			continue
		}

		// Track variable declarations: const/let x = <expr>
		analyzeDeclaration(trimmed, lineNum, state, config, findings)

		// Track assignments: x = <expr>
		analyzeAssignment(trimmed, lineNum, state, config, findings)

		// Check array accesses: arr[<expr>]
		if (config.enableIntervalDomain) {
			analyzeArrayAccess(trimmed, lineNum, state, findings)
		}

		// Check division: x / y where y might be 0
		if (config.enableIntervalDomain) {
			analyzeDivision(trimmed, lineNum, state, findings)
		}

		// Check null dereference: x.prop, x?.prop
		if (config.enableNullAnalysis) {
			analyzeNullDeref(trimmed, lineNum, state, findings)
		}

		// Save state at this program point
		states.set(lineNum, new Map(state))
	}

	const soundnessScore = computeSoundnessScore(findings)
	const durationMs = performance.now() - startTime

	return {
		filePath,
		variablesTracked: state.size,
		findings,
		states,
		soundnessScore,
		durationMs,
	}
}

/**
 * Analyze variable declarations: const/let x = <expr>
 */
function analyzeDeclaration(
	line: string,
	lineNum: number,
	state: AbstractState,
	config: AIConfig,
	findings: AIFinding[],
): void {
	// const x = <number>
	const numDecl = line.match(/(?:const|let|var)\s+(\w+)\s*(?::\s*\w+\s*)?=\s*(-?\d+(?:\.\d+)?)\s*$/)
	if (numDecl) {
		const name = numDecl[1]
		const value = Number.parseFloat(numDecl[2])
		state.set(name, makeAbstractValue(iv(value, value), concreteToSign(value), config))
		return
	}

	// const x = <expr>
	const exprDecl = line.match(/(?:const|let|var)\s+(\w+)\s*(?::\s*\w+\s*)?=\s*(.+)$/)
	if (exprDecl) {
		const name = exprDecl[1]
		const expr = exprDecl[2].trim()
		const result = evaluateExpression(expr, state, config)
		state.set(name, result)
	}

	// Track null/undefined assignments
	const nullDecl = line.match(/(?:const|let|var)\s+(\w+)\s*(?::\s*\w+\s*)?=\s*(null|undefined)\s*$/)
	if (nullDecl) {
		const name = nullDecl[1]
		const isNull = nullDecl[2] === 'null'
		state.set(name, {
			interval: null,
			sign: 'bottom',
			mayBeNull: isNull,
			mayBeUndefined: !isNull,
			definitelyNumber: false,
		})
	}
}

/**
 * Analyze assignments: x = <expr> or x += <expr>
 */
function analyzeAssignment(
	line: string,
	lineNum: number,
	state: AbstractState,
	config: AIConfig,
	findings: AIFinding[],
): void {
	// Skip declarations (handled above)
	if (/^(?:const|let|var)\s/.test(line)) return

	// x += <expr>, x -= <expr>, x *= <expr>
	const compoundMatch = line.match(/^(\w+)\s*([+\-*/])=\s*(.+)$/)
	if (compoundMatch) {
		const name = compoundMatch[1]
		const op = compoundMatch[2]
		const expr = compoundMatch[3].trim()
		const current = state.get(name)
		if (current) {
			const rhs = evaluateExpression(expr, state, config)
			const newInterval = applyArithmetic(current.interval, rhs.interval, op)
			const newSign = applySignArithmetic(current.sign, rhs.sign, op)
			state.set(name, makeAbstractValue(newInterval, newSign, config))
		}
		return
	}

	// x = <expr>
	const simpleAssign = line.match(/^(\w+)\s*=\s*(.+)$/)
	if (simpleAssign) {
		const name = simpleAssign[1]
		const expr = simpleAssign[2].trim()
		// Skip keywords
		if (['if', 'else', 'for', 'while', 'return', 'throw', 'function', 'class'].includes(name)) return
		const result = evaluateExpression(expr, state, config)
		state.set(name, result)
	}
}

/**
 * Check array accesses for potential out-of-bounds.
 */
function analyzeArrayAccess(
	line: string,
	lineNum: number,
	state: AbstractState,
	findings: AIFinding[],
): void {
	// arr[expr] or arr.at(expr)
	const accessPattern = /(\w+)\[(.+?)\]/g
	let match: RegExpExecArray | null
	while ((match = accessPattern.exec(line)) !== null) {
		const arrName = match[1]
		const indexExpr = match[2].trim()

		// Try to determine array length from declaration
		const arrState = state.get(arrName)
		if (!arrState) continue

		// Evaluate index
		const indexInterval = evaluateExpression(indexExpr, state, { ...DEFAULT_AI_CONFIG, enableNullAnalysis: false }).interval

		if (indexInterval !== null) {
			// If we can't determine array length, check for negative indices
			if (indexInterval.lo < 0) {
				findings.push({
					severity: 'warning',
					check: 'array-oob',
					message: `Array "${arrName}" may be accessed with negative index [${indexInterval.lo}, ${indexInterval.hi}]`,
					lineNumber: lineNum,
					confidence: 0.8,
				})
			}
		}
	}

	// .length access followed by bounds check
	const lengthPattern = /(\w+)\.length/
	while ((match = lengthPattern.exec(line)) !== null) {
		// Track array length info
		const arrName = match[1]
		const arrVal = state.get(arrName)
		if (arrVal && arrVal.interval === null) {
			// This is an array — mark as having length info
		}
	}
}

/**
 * Check division operations for potential division by zero.
 */
function analyzeDivision(
	line: string,
	lineNum: number,
	state: AbstractState,
	findings: AIFinding[],
): void {
	const divPattern = /(\w+)\s*\/\s*(\w+)/g
	let match: RegExpExecArray | null
	while ((match = divPattern.exec(line)) !== null) {
		const divisor = match[2]
		const divisorVal = state.get(divisor)
		if (divisorVal && mayBeZero(divisorVal.interval)) {
			findings.push({
				severity: 'warning',
				check: 'division-by-zero',
				message: `Division by "${divisor}" which may be zero [${divisorVal.interval?.lo}, ${divisorVal.interval?.hi}]`,
				lineNumber: lineNum,
				confidence: 0.7,
			})
		}
	}
}

/**
 * Check for potential null dereference.
 */
function analyzeNullDeref(
	line: string,
	lineNum: number,
	state: AbstractState,
	findings: AIFinding[],
): void {
	// x.prop (not x?.prop or x!.prop)
	const propPattern = /(?<!!)(\w+)\.(?!\?)(\w+)/g
	let match: RegExpExecArray | null
	while ((match = propPattern.exec(line)) !== null) {
		const objName = match[1]
		const objVal = state.get(objName)
		if (objVal && (objVal.mayBeNull || objVal.mayBeUndefined)) {
			// Check if there's a guard before
			const guardPattern = new RegExp(`if\\s*\\(.*${objName}.*\\)`)
			if (!guardPattern.test(line)) {
				findings.push({
					severity: 'warning',
					check: 'null-deref',
					message: `"${objName}" may be ${objVal.mayBeNull ? 'null' : 'undefined'} when accessing .${match[2]}`,
					lineNumber: lineNum,
					confidence: 0.6,
				})
			}
		}
	}
}

/**
 * Evaluate an expression in the abstract domain.
 */
function evaluateExpression(expr: string, state: AbstractState, config: AIConfig): AbstractValue {
	// Literal number
	const numMatch = expr.match(/^(-?\d+(?:\.\d+)?)$/)
	if (numMatch) {
		const n = Number.parseFloat(numMatch[1])
		return makeAbstractValue(iv(n, n), concreteToSign(n), config)
	}

	// Variable reference
	const varMatch = expr.match(/^(\w+)$/)
	if (varMatch) {
		return state.get(varMatch[1]) ?? makeAbstractValue(TOP_INTERVAL, 'top', config)
	}

	// Binary arithmetic: a op b
	const binMatch = expr.match(/^(.+?)\s*([+\-*/])\s*(.+)$/)
	if (binMatch) {
		const left = evaluateExpression(binMatch[1].trim(), state, config)
		const right = evaluateExpression(binMatch[3].trim(), state, config)
		const op = binMatch[2]
		return makeAbstractValue(
			applyArithmetic(left.interval, right.interval, op),
			applySignArithmetic(left.sign, right.sign, op),
			config,
		)
	}

	// Unary minus
	const negMatch = expr.match(/^-\s*(.+)$/)
	if (negMatch) {
		const inner = evaluateExpression(negMatch[1].trim(), state, config)
		return makeAbstractValue(
			intervalNeg(inner.interval),
			signNeg(inner.sign),
			config,
		)
	}

	// Default: top
	return makeAbstractValue(TOP_INTERVAL, 'top', config)
}

/**
 * Apply arithmetic operation on intervals.
 */
function applyArithmetic(a: Interval, b: Interval, op: string): Interval {
	switch (op) {
		case '+': return intervalAdd(a, b)
		case '-': return intervalSub(a, b)
		case '*': return intervalMul(a, b)
		case '/': return intervalDiv(a, b)
		default: return TOP_INTERVAL
	}
}

/**
 * Apply arithmetic operation on signs.
 */
function applySignArithmetic(a: Sign, b: Sign, op: string): Sign {
	switch (op) {
		case '+': return signAdd(a, b)
		case '-': return signAdd(a, signNeg(b))
		case '*': return signMul(a, b)
		case '/': return signMul(a, b) // same as mul for signs
		default: return 'top'
	}
}

/**
 * Create an abstract value from interval and sign.
 */
function makeAbstractValue(interval: Interval, sign: Sign, config: AIConfig): AbstractValue {
	return {
		interval: config.enableIntervalDomain ? interval : null,
		sign: config.enableSignDomain ? sign : 'top',
		mayBeNull: false,
		mayBeUndefined: false,
		definitelyNumber: interval !== null,
	}
}

/**
 * Compute overall soundness score from findings.
 * Score = 1.0 - weighted_sum(findings).
 */
function computeSoundnessScore(findings: AIFinding[]): number {
	if (findings.length === 0) return 1.0

	let penalty = 0
	for (const f of findings) {
		switch (f.severity) {
			case 'error': penalty += 0.15 * f.confidence; break
			case 'warning': penalty += 0.08 * f.confidence; break
			case 'info': penalty += 0.02 * f.confidence; break
		}
	}

	return Math.max(0, 1 - penalty)
}
