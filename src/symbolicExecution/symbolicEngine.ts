/**
 * Symbolic Execution Engine — explores all code paths with symbolic values.
 *
 * Unlike abstract interpretation (which over-approximates), symbolic execution
 * explores each path individually with precise symbolic constraints.
 * Finds bugs that only occur on specific execution paths.
 */

import type {
	SymbolicExpr, SymbolicState, PathCondition, ExecutionPath,
	SEFinding, SEResult, SEConfig,
} from './types.js'
import { DEFAULT_SE_CONFIG } from './types.js'

/**
 * Analyze source code using symbolic execution.
 *
 * @param source - TypeScript source code
 * @param filePath - File path for reporting
 * @param config - Execution configuration
 * @returns Symbolic execution result with all explored paths
 */
export function executeSymbolically(
	source: string,
	filePath: string,
	config: SEConfig = DEFAULT_SE_CONFIG,
): SEResult {
	const startTime = performance.now()
	const paths: ExecutionPath[] = []
	const allFindings: SEFinding[] = []
	let pathCounter = 0

	const lines = source.split('\n')

	// Collect all branch points
	const branches = collectBranches(lines)

	// Explore paths (bounded BFS over branch decisions)
	const maxPaths = Math.min(config.maxPaths, Math.pow(2, Math.min(branches.length, config.maxPathDepth)))

	// Initial state
	const initialState: SymbolicState = {
		vars: new Map(),
		pathConditions: [],
		lineNumber: 0,
		feasible: true,
	}

	// Initialize symbolic variables from declarations
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i].trim()
		const declMatch = line.match(/(?:const|let|var)\s+(\w+)\s*(?::\s*(\w+)\s*)?=/)
		if (declMatch) {
			const name = declMatch[1]
			const typeHint = declMatch[2] ?? 'unknown'
			const type = ['number', 'string', 'boolean'].includes(typeHint) ? typeHint as 'number' | 'string' | 'boolean' : 'unknown'
			initialState.vars.set(name, { kind: 'var', name: `sym_${name}` })

			// Track literal values for constraint solving
			const literalMatch = line.match(/=\s*(-?\d+(?:\.\d+)?)\s*$/)
			if (literalMatch) {
				initialState.vars.set(name, { kind: 'const', value: Number.parseFloat(literalMatch[1]) })
			}
		}
	}

	// Explore all paths through branches
	if (branches.length === 0) {
		// No branches — single path
		const path = explorePath(lines, initialState, [], filePath, pathCounter++, config)
		paths.push(path)
		allFindings.push(...path.findings)
	} else {
		// Enumerate branch decisions (true/false for each branch)
		const branchDecisions = enumerateBranchDecisions(branches.length, maxPaths)

		for (const decisions of branchDecisions) {
			const state: SymbolicState = {
				vars: new Map(initialState.vars),
				pathConditions: [],
				lineNumber: 0,
				feasible: true,
			}

			// Apply branch decisions
			for (let d = 0; d < decisions.length; d++) {
				const branch = branches[d]!
				const taken = decisions[d]

				state.pathConditions.push({
					expr: buildConditionExpr(branch.condition, state.vars),
					negated: !taken,
					lineNumber: branch.lineNumber,
					description: `${taken ? '' : '!'}(${branch.condition})`,
				})
			}

			// Explore this path
			const path = explorePath(lines, state, decisions, filePath, pathCounter++, config)
			paths.push(path)
			allFindings.push(...path.findings)
		}
	}

	const feasiblePaths = paths.filter((p) => p.feasible).length
	const durationMs = performance.now() - startTime

	return {
		filePath,
		totalPaths: paths.length,
		feasiblePaths,
		infeasiblePaths: paths.length - feasiblePaths,
		paths,
		findings: allFindings,
		durationMs,
	}
}

/** Branch point in the source code */
interface BranchPoint {
	lineNumber: number
	condition: string
	/** Whether the else branch exists */
	hasElse: boolean
}

/**
 * Collect all branch points (if statements) from source.
 */
function collectBranches(lines: string[]): BranchPoint[] {
	const branches: BranchPoint[] = []

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i].trim()
		const ifMatch = line.match(/if\s*\(([^)]+)\)/)
		if (ifMatch) {
			// Check if there's an else on the same or following lines
			const hasElse = checkForElse(lines, i)
			branches.push({
				lineNumber: i + 1,
				condition: ifMatch[1].trim(),
				hasElse,
			})
		}
	}

	return branches
}

/**
 * Check if an else branch exists for an if at the given line.
 */
function checkForElse(lines: string[], ifLineIdx: number): boolean {
	// Look ahead for else on subsequent lines
	for (let i = ifLineIdx + 1; i < Math.min(ifLineIdx + 20, lines.length); i++) {
		const line = lines[i]!.trim()
		if (line.startsWith('} else') || line === '} else {') return true
		if (line === '}' && !lines.slice(ifLineIdx + 1, i).some((l) => l.includes('{'))) return false
	}
	return false
}

/**
 * Enumerate all possible branch decision combinations.
 */
function enumerateBranchDecisions(numBranches: number, maxPaths: number): boolean[][] {
	const decisions: boolean[][] = []
	const total = Math.min(Math.pow(2, numBranches), maxPaths)

	for (let i = 0; i < total; i++) {
		const combo: boolean[] = []
		for (let b = 0; b < numBranches; b++) {
			combo.push(((i >> b) & 1) === 1)
		}
		decisions.push(combo)
	}

	return decisions
}

/**
 * Build a symbolic expression from a condition string.
 */
function buildConditionExpr(condition: string, vars: Map<string, SymbolicExpr>): SymbolicExpr {
	// Simple binary comparison: x op value
	const binMatch = condition.match(/^(\w+)\s*([><=!]+)\s*(-?\d+(?:\.\d+)?)$/)
	if (binMatch) {
		const left = vars.get(binMatch[1]) ?? { kind: 'var', name: binMatch[1] }
		return {
			kind: 'binop',
			op: binMatch[2],
			left,
			right: { kind: 'const', value: Number.parseFloat(binMatch[3]) },
		}
	}

	// Variable check: x (truthy)
	const varMatch = condition.match(/^(\w+)$/)
	if (varMatch) {
		return vars.get(varMatch[1]) ?? { kind: 'var', name: varMatch[1] }
	}

	// Negated variable: !x
	const negMatch = condition.match(/^!(\w+)$/)
	if (negMatch) {
		return {
			kind: 'unop',
			op: '!',
			operand: vars.get(negMatch[1]) ?? { kind: 'var', name: negMatch[1] },
		}
	}

	return { kind: 'unknown' }
}

/**
 * Explore a single execution path through the code.
 */
function explorePath(
	lines: string[],
	initialState: SymbolicState,
	_decisions: boolean[],
	filePath: string,
	pathId: number,
	_config: SEConfig,
): ExecutionPath {
	const state: SymbolicState = {
		vars: new Map(initialState.vars),
		pathConditions: [...initialState.pathConditions],
		lineNumber: 0,
		feasible: true,
	}

	const findings: SEFinding[] = []
	const linesCovered: number[] = []
	const pathIdStr = `path-${pathId}`

	// Check path feasibility using constraint solving
	state.feasible = checkFeasibility(state.pathConditions)

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i].trim()
		const lineNum = i + 1
		linesCovered.push(lineNum)

		if (line === '' || line.startsWith('//') || line.startsWith('import ') || line.startsWith('export type')) {
			continue
		}

		// Track assignments on this path
		const assignMatch = line.match(/^(\w+)\s*=\s*(.+)$/)
		if (assignMatch && !['if', 'else', 'for', 'while', 'return', 'throw'].includes(assignMatch[1])) {
			const name = assignMatch[1]
			const rhs = assignMatch[2].trim()

			// Update symbolic state
			const rhsExpr = parseExpression(rhs, state.vars)
			state.vars.set(name, rhsExpr)
		}

		// Check for errors on this path
		analyzePathLine(line, lineNum, state, findings, pathIdStr, filePath)

		state.lineNumber = lineNum
	}

	return {
		id: pathIdStr,
		conditions: state.pathConditions,
		feasible: state.feasible,
		finalState: new Map(state.vars),
		findings,
		linesCovered,
	}
}

/**
 * Check if a set of path conditions is feasible.
 * Simple constraint solver for constant values.
 */
function checkFeasibility(conditions: PathCondition[]): boolean {
	// Build a simple constraint map: var → set of required values
	const constraints = new Map<string, Set<number | boolean | null>>()

	for (const cond of conditions) {
		const expr = cond.expr

		if (expr.kind === 'binop' && expr.right.kind === 'const') {
			const varName = expr.left.kind === 'var' ? expr.left.name : null
			if (!varName) continue

			const value = expr.right.value as number
			const expected = cond.negated ? negateOp(expr.op) : expr.op

			// Simple check: same variable with contradictory constraints
			if (!constraints.has(varName)) {
				constraints.set(varName, new Set())
			}

			// For equality: check if we have a conflicting value
			if (expected === '===' || expected === '==') {
				const existing = constraints.get(varName)!
				if (existing.size > 0 && !existing.has(value)) {
					return false // x === 5 and x === 3 → infeasible
				}
				existing.add(value)
			}
		}

		// Check for obvious contradiction: x > 5 AND !x > 5
		if (cond.negated) {
			for (const other of conditions) {
				if (other === cond) continue
				if (!other.negated && exprEquals(cond.expr, other.expr)) {
					// Same condition, one negated and one not
					const hasNegated = conditions.some((c) => c !== cond && c.negated === cond.negated && exprEquals(c.expr, cond.expr))
					if (!hasNegated) return false
				}
			}
		}
	}

	return true
}

/** Negate a comparison operator */
function negateOp(op: string): string {
	const negations: Record<string, string> = {
		'>': '<=', '<': '>=', '>=': '<', '<=': '>',
		'===': '!==', '!==': '===', '==': '!=', '!=': '==',
	}
	return negations[op] ?? op
}

/** Check if two symbolic expressions are structurally equal */
function exprEquals(a: SymbolicExpr, b: SymbolicExpr): boolean {
	if (a.kind !== b.kind) return false
	if (a.kind === 'var' && b.kind === 'var') return a.name === b.name
	if (a.kind === 'const' && b.kind === 'const') return a.value === b.value
	if (a.kind === 'binop' && b.kind === 'binop') {
		return a.op === b.op && exprEquals(a.left, b.left) && exprEquals(a.right, b.right)
	}
	return false
}

/**
 * Parse an expression into symbolic form.
 */
function parseExpression(expr: string, vars: Map<string, SymbolicExpr>): SymbolicExpr {
	const trimmed = expr.trim().replace(/;$/, '')

	// Numeric literal
	if (/^-?\d+(?:\.\d+)?$/.test(trimmed)) {
		return { kind: 'const', value: Number.parseFloat(trimmed) }
	}

	// String literal
	if (/^['"].*['"]$/.test(trimmed)) {
		return { kind: 'const', value: trimmed.slice(1, -1) }
	}

	// Boolean literal
	if (trimmed === 'true') return { kind: 'const', value: true }
	if (trimmed === 'false') return { kind: 'const', value: false }
	if (trimmed === 'null') return { kind: 'const', value: null }

	// Variable reference
	if (/^\w+$/.test(trimmed)) {
		return vars.get(trimmed) ?? { kind: 'var', name: `sym_${trimmed}` }
	}

	// Binary operation
	const binMatch = trimmed.match(/^(.+?)\s*([+\-*/><=!]+)\s*(.+)$/)
	if (binMatch) {
		return {
			kind: 'binop',
			op: binMatch[2],
			left: parseExpression(binMatch[1], vars),
			right: parseExpression(binMatch[3], vars),
		}
	}

	return { kind: 'unknown' }
}

/**
 * Analyze a single line for path-specific issues.
 */
function analyzePathLine(
	line: string,
	lineNum: number,
	state: SymbolicState,
	findings: SEFinding[],
	pathId: string,
	_filePath: string,
): void {
	// Division by zero on this specific path
	const divMatch = line.match(/(\w+)\s*\/\s*(\w+)/)
	if (divMatch) {
		const divisor = state.vars.get(divMatch[2])
		if (divisor?.kind === 'const' && divisor.value === 0) {
			findings.push({
				severity: 'error',
				check: 'division-by-zero',
				message: `Division by "${divMatch[2]}" which is exactly 0 on this path`,
				lineNumber: lineNum,
				pathId,
				witness: formatWitness(state),
			})
		}
	}

	// Array access with symbolic index
	const arrMatch = line.match(/(\w+)\[(\w+)\]/)
	if (arrMatch) {
		const idx = state.vars.get(arrMatch[2])
		if (idx?.kind === 'const' && typeof idx.value === 'number' && idx.value < 0) {
			findings.push({
				severity: 'error',
				check: 'array-oob',
				message: `Array "${arrMatch[1]}" accessed with negative index ${idx.value}`,
				lineNumber: lineNum,
				pathId,
				witness: formatWitness(state),
			})
		}
	}

	// Throw on this path (potential error path)
	if (line.includes('throw ') || line.includes('throw new')) {
		findings.push({
			severity: 'info',
			check: 'error-path',
			message: `Error path: ${line.trim()}`,
			lineNumber: lineNum,
			pathId,
			witness: formatWitness(state),
		})
	}
}

/**
 * Format a witness (example input) from symbolic state.
 */
function formatWitness(state: SymbolicState): string {
	const parts: string[] = []
	for (const [name, expr] of state.vars) {
		if (expr.kind === 'var') {
			parts.push(`${name}=<symbolic:${expr.name}>`)
		} else if (expr.kind === 'const') {
			parts.push(`${name}=${JSON.stringify(expr.value)}`)
		}
	}
	return parts.join(', ')
}

/**
 * Simplify a symbolic expression (basic algebraic simplification).
 */
export function simplifyExpr(expr: SymbolicExpr): SymbolicExpr {
	if (expr.kind !== 'binop') return expr

	const left = simplifyExpr(expr.left)
	const right = simplifyExpr(expr.right)

	// Constant folding: const op const → const
	if (left.kind === 'const' && right.kind === 'const') {
		const lv = left.value
		const rv = right.value
		if (typeof lv === 'number' && typeof rv === 'number') {
			switch (expr.op) {
				case '+': return { kind: 'const', value: lv + rv }
				case '-': return { kind: 'const', value: lv - rv }
				case '*': return { kind: 'const', value: lv * rv }
				case '/': return rv !== 0 ? { kind: 'const', value: lv / rv } : expr
			}
		}
	}

	// Identity: x + 0 = x, x * 1 = x
	if (right.kind === 'const') {
		if (expr.op === '+' && right.value === 0) return left
		if (expr.op === '-' && right.value === 0) return left
		if (expr.op === '*' && right.value === 1) return left
	}

	return { kind: 'binop', op: expr.op, left, right }
}
