/**
 * Symbolic Execution Engine — explores all code paths with symbolic values.
 *
 * Unlike abstract interpretation (which over-approximates), symbolic execution
 * explores each path individually with precise symbolic constraints.
 * Finds bugs that only occur on specific execution paths.
 */

import type {
	ExecutionPath,
	PathCondition,
	SEConfig,
	SEFinding,
	SEResult,
	SymbolicExpr,
	SymbolicState,
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
	const maxPaths = Math.min(config.maxPaths, 2 ** Math.min(branches.length, config.maxPathDepth))

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
			const _type = ['number', 'string', 'boolean'].includes(typeHint)
				? (typeHint as 'number' | 'string' | 'boolean')
				: 'unknown'
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
	const total = Math.min(2 ** numBranches, maxPaths)

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

		if (
			line === '' ||
			line.startsWith('//') ||
			line.startsWith('import ') ||
			line.startsWith('export type')
		) {
			continue
		}

		// Track assignments on this path
		const assignMatch = line.match(/^(\w+)\s*=\s*(.+)$/)
		if (
			assignMatch &&
			!['if', 'else', 'for', 'while', 'return', 'throw'].includes(assignMatch[1])
		) {
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
	// Per-variable constraint accumulator. Reasons over equality/exclusion sets
	// AND a numeric interval [lo, hi] (with strictness) built from inequalities,
	// so contradictions like `x > 5 && x < 3` or `x >= 5 && x < 5` are detected
	// (the previous version only caught `x===5 && x===3` and direct negation).
	interface Bounds {
		eqs: Set<number | boolean>
		neqs: Set<number | boolean>
		lo: number
		loStrict: boolean
		hi: number
		hiStrict: boolean
		hasLo: boolean
		hasHi: boolean
	}
	const vars = new Map<string, Bounds>()
	const get = (name: string): Bounds => {
		let b = vars.get(name)
		if (!b) {
			b = {
				eqs: new Set(),
				neqs: new Set(),
				lo: -Infinity,
				loStrict: false,
				hi: Infinity,
				hiStrict: false,
				hasLo: false,
				hasHi: false,
			}
			vars.set(name, b)
		}
		return b
	}
	const tightenLo = (b: Bounds, v: number, strict: boolean): void => {
		if (!b.hasLo || v > b.lo) {
			b.lo = v
			b.loStrict = strict
		} else if (v === b.lo) {
			b.loStrict = b.loStrict || strict
		}
		b.hasLo = true
	}
	const tightenHi = (b: Bounds, v: number, strict: boolean): void => {
		if (!b.hasHi || v < b.hi) {
			b.hi = v
			b.hiStrict = strict
		} else if (v === b.hi) {
			b.hiStrict = b.hiStrict || strict
		}
		b.hasHi = true
	}

	for (const cond of conditions) {
		const expr = cond.expr
		if (expr.kind !== 'binop') continue
		const leftIsVar = expr.left.kind === 'var'
		const rightIsVar = expr.right.kind === 'var'
		const leftIsConst = expr.left.kind === 'const'
		const rightIsConst = expr.right.kind === 'const'
		if (!(leftIsVar && rightIsConst) && !(rightIsVar && leftIsConst)) continue

		const varName =
			expr.left.kind === 'var' ? expr.left.name : expr.right.kind === 'var' ? expr.right.name : ''
		const leftConst = expr.left.kind === 'const' ? (expr.left.value as number | boolean) : null
		const rightConst = expr.right.kind === 'const' ? (expr.right.value as number | boolean) : null
		const value = (leftConst ?? rightConst ?? 0) as number | boolean
		// Normalize to `var OP const`; if the const is on the left, flip direction.
		let op = expr.left.kind === 'const' ? flipOp(expr.op) : expr.op
		op = cond.negated ? negateOp(op) : op

		const b = get(varName)
		if (typeof value === 'boolean') {
			if (op === '===' || op === '==') b.eqs.add(value)
			else if (op === '!==' || op === '!=') b.neqs.add(value)
			continue
		}
		switch (op) {
			case '===':
			case '==':
				b.eqs.add(value)
				tightenLo(b, value, false)
				tightenHi(b, value, false)
				break
			case '!==':
			case '!=':
				b.neqs.add(value)
				break
			case '>':
				tightenLo(b, value, true)
				break
			case '>=':
				tightenLo(b, value, false)
				break
			case '<':
				tightenHi(b, value, true)
				break
			case '<=':
				tightenHi(b, value, false)
				break
			default:
				break
		}
	}

	for (const b of vars.values()) {
		const distinctEqs = new Set(b.eqs)
		if (distinctEqs.size > 1) return false // x===5 && x===3
		// Empty interval: lo > hi, or lo===hi with a strict bound on either side.
		if (b.hasLo && b.hasHi) {
			if (b.lo > b.hi) return false // x>5 && x<3
			if (b.lo === b.hi && (b.loStrict || b.hiStrict)) return false // x>=5 && x<5
		}
		if (distinctEqs.size === 1) {
			const v = [...b.eqs][0]!
			if (typeof v === 'number') {
				if (b.hasLo && (v < b.lo || (v === b.lo && b.loStrict))) return false // x===3 && x>3
				if (b.hasHi && (v > b.hi || (v === b.hi && b.hiStrict))) return false
			}
			if (b.neqs.has(v)) return false // x===5 && x!==5
		}
	}
	return true
}

/** Flip a comparison operator when the const is on the LEFT side (5 < x ⟺ x > 5). */
function flipOp(op: string): string {
	const flips: Record<string, string> = {
		'>': '<',
		'<': '>',
		'>=': '<=',
		'<=': '>=',
		'===': '===',
		'!==': '!==',
		'==': '==',
		'!=': '!=',
	}
	return flips[op] ?? op
}

/** Negate a comparison operator */
function negateOp(op: string): string {
	const negations: Record<string, string> = {
		'>': '<=',
		'<': '>=',
		'>=': '<',
		'<=': '>',
		'===': '!==',
		'!==': '===',
		'==': '!=',
		'!=': '==',
	}
	return negations[op] ?? op
}

/** Check if two symbolic expressions are structurally equal */
function _exprEquals(a: SymbolicExpr, b: SymbolicExpr): boolean {
	if (a.kind !== b.kind) return false
	if (a.kind === 'var' && b.kind === 'var') return a.name === b.name
	if (a.kind === 'const' && b.kind === 'const') return a.value === b.value
	if (a.kind === 'binop' && b.kind === 'binop') {
		return a.op === b.op && _exprEquals(a.left, b.left) && _exprEquals(a.right, b.right)
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
				case '+':
					return { kind: 'const', value: lv + rv }
				case '-':
					return { kind: 'const', value: lv - rv }
				case '*':
					return { kind: 'const', value: lv * rv }
				case '/':
					return rv !== 0 ? { kind: 'const', value: lv / rv } : expr
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
