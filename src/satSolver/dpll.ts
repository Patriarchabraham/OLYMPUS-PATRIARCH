/**
 * DPLL SAT Solver — Davis-Putnam-Logemann-Loveland algorithm
 * with unit propagation and pure literal elimination.
 *
 * Solves boolean satisfiability problems in CNF form.
 * Used to prove code path feasibility and detect impossible branches.
 */

import type {
	Assignment,
	CNFFormula,
	Clause,
	DPLLStats,
	Literal,
	SATConfig,
	SATResult,
	Variable,
} from './types.js'
import { DEFAULT_SAT_CONFIG } from './types.js'

/**
 * Solve a CNF formula using the DPLL algorithm.
 *
 * @param formula - CNF formula (array of clauses)
 * @param config - Solver configuration
 * @returns SAT result with satisfiability and model
 */
export function solveDPLL(
	formula: CNFFormula,
	config: SATConfig = DEFAULT_SAT_CONFIG,
): SATResult {
	const startTime = performance.now()
	const stats: DPLLStats = {
		recursiveCalls: 0,
		unitPropagations: 0,
		pureEliminations: 0,
		backtracks: 0,
	}

	const assignment: Assignment = new Map()
	const result = dpllRecursive(formula, assignment, stats, config)
	const durationMs = performance.now() - startTime

	return {
		satisfiable: result !== null,
		model: result,
		decisions: stats.recursiveCalls,
		propagations: stats.unitPropagations,
		durationMs,
	}
}

/**
 * Check if a formula is satisfied under the current assignment.
 */
function isSatisfied(formula: CNFFormula, assignment: Assignment): boolean {
	for (const clause of formula) {
		if (!isClauseSatisfied(clause, assignment)) {
			return false
		}
	}
	return true
}

/**
 * Check if a single clause is satisfied.
 */
function isClauseSatisfied(clause: Clause, assignment: Assignment): boolean {
	for (const lit of clause) {
		const var_ = Math.abs(lit)
		const value = assignment.get(var_)
		if (value === undefined) continue // unassigned — skip
		if (lit > 0 && value) return true
		if (lit < 0 && !value) return true
	}
	return false // no literal satisfies the clause
}

/**
 * Check if a clause is falsified (all literals assigned and false).
 */
function isClauseFalsified(clause: Clause, assignment: Assignment): boolean {
	return clause.every((lit) => {
		const var_ = Math.abs(lit)
		const value = assignment.get(var_)
		if (value === undefined) return false
		return lit > 0 ? !value : value
	})
}

/**
 * Perform unit propagation.
 * Finds unit clauses (single unassigned literal) and assigns them.
 *
 * @returns false if a contradiction is found, true otherwise
 */
function unitPropagation(
	formula: CNFFormula,
	assignment: Assignment,
	stats: DPLLStats,
): boolean {
	let changed = true
	while (changed) {
		changed = false
		for (const clause of formula) {
			if (isClauseSatisfied(clause, assignment)) continue

			// Count unassigned literals
			const unassigned: Literal[] = []
			let allFalsified = true

			for (const lit of clause) {
				const var_ = Math.abs(lit)
				if (!assignment.has(var_)) {
					unassigned.push(lit)
					allFalsified = false
				} else {
					const value = assignment.get(var_)!
					const sat = lit > 0 ? value : !value
					if (sat) {
						allFalsified = false
						break // clause already satisfied
					}
				}
			}

			// Contradiction: all literals falsified
			if (allFalsified) return false

			// Unit clause: exactly one unassigned literal
			if (unassigned.length === 1) {
				const lit = unassigned[0]
				const var_ = Math.abs(lit)
				const value = lit > 0
				assignment.set(var_, value)
				stats.unitPropagations++
				changed = true
			}
		}
	}
	return true
}

/**
 * Perform pure literal elimination.
 * A pure literal appears only positive or only negative in all unsatisfied clauses.
 */
function pureLiteralElimination(
	formula: CNFFormula,
	assignment: Assignment,
	stats: DPLLStats,
): void {
	// Count occurrences: positive vs negative for each variable
	const positive = new Set<Variable>()
	const negative = new Set<Variable>()

	for (const clause of formula) {
		if (isClauseSatisfied(clause, assignment)) continue
		for (const lit of clause) {
			const var_ = Math.abs(lit)
			if (assignment.has(var_)) continue
			if (lit > 0) positive.add(var_)
			else negative.add(var_)
		}
	}

	// Pure literals: appear in only one polarity
	for (const var_ of positive) {
		if (!negative.has(var_) && !assignment.has(var_)) {
			assignment.set(var_, true)
			stats.pureEliminations++
		}
	}
	for (const var_ of negative) {
		if (!positive.has(var_) && !assignment.has(var_)) {
			assignment.set(var_, false)
			stats.pureEliminations++
		}
	}
}

/**
 * Choose the next variable to branch on.
 * Uses the MOMS heuristic (Maximum Occurrences in Minimum Size clauses).
 */
function chooseVariable(formula: CNFFormula, assignment: Assignment): Variable | null {
	let bestVar: Variable | null = null
	let bestScore = -1

	for (const clause of formula) {
		if (isClauseSatisfied(clause, assignment)) continue

		const unassigned = clause.filter((lit) => !assignment.has(Math.abs(lit)))
		if (unassigned.length === 0) continue

		// Prefer variables in shorter clauses
		const weight = 1 / (unassigned.length * unassigned.length)

		for (const lit of unassigned) {
			const var_ = Math.abs(lit)
			const score = weight
			if (score > bestScore) {
				bestScore = score
				bestVar = var_
			}
		}
	}

	return bestVar
}

/**
 * Recursive DPLL solver.
 */
function dpllRecursive(
	formula: CNFFormula,
	assignment: Assignment,
	stats: DPLLStats,
	config: SATConfig,
): Assignment | null {
	stats.recursiveCalls++

	// Timeout check
	if (stats.recursiveCalls > config.maxRecursiveCalls) {
		return null
	}

	// Check for contradictions
	for (const clause of formula) {
		if (isClauseFalsified(clause, assignment)) {
			stats.backtracks++
			return null
		}
	}

	// Check if all clauses satisfied
	if (formula.every((c) => isClauseSatisfied(c, assignment))) {
		return new Map(assignment)
	}

	// Unit propagation
	if (!unitPropagation(formula, assignment, stats)) {
		stats.backtracks++
		return null
	}

	// Check again after propagation
	if (formula.every((c) => isClauseSatisfied(c, assignment))) {
		return new Map(assignment)
	}

	// Pure literal elimination
	if (config.enablePureLiteral) {
		pureLiteralElimination(formula, assignment, stats)
	}

	// Check again after pure literal elimination
	if (formula.every((c) => isClauseSatisfied(c, assignment))) {
		return new Map(assignment)
	}

	// Choose variable to branch on
	const var_ = chooseVariable(formula, assignment)
	if (var_ === null) {
		// No unassigned variables left but formula not satisfied
		stats.backtracks++
		return null
	}

	// Try true first
	const assignmentTrue = new Map(assignment)
	assignmentTrue.set(var_, true)
	const resultTrue = dpllRecursive(formula, assignmentTrue, stats, config)
	if (resultTrue !== null) return resultTrue

	// Try false
	const assignmentFalse = new Map(assignment)
	assignmentFalse.set(var_, false)
	return dpllRecursive(formula, assignmentFalse, stats, config)
}

/**
 * Parse a boolean expression into CNF.
 * Supports: &&, ||, !, variables (single letters or alphanumeric).
 *
 * @param expression - Boolean expression string
 * @returns CNF formula
 */
export function parseToCNF(expression: string): CNFFormula {
	const trimmed = expression.trim()

	// Simple variable extraction
	const varPattern = /\b([a-zA-Z_]\w*)\b/g
	const vars = new Set<string>()
	let match: RegExpExecArray | null
	while ((match = varPattern.exec(trimmed)) !== null) {
		if (!['true', 'false', 'and', 'or', 'not'].includes(match[1].toLowerCase())) {
			vars.add(match[1])
		}
	}

	const varList = [...vars].sort()
	const varMap = new Map(varList.map((v, i) => [v, i + 1]))

	// Tokenize
	const tokens = tokenize(trimmed)
	// Convert to CNF via naive expansion
	return expressionToCNF(tokens, varMap)
}

/** Token types for boolean expression parsing */
type TokenType = 'VAR' | 'AND' | 'OR' | 'NOT' | 'LPAREN' | 'RPAREN' | 'TRUE' | 'FALSE'

interface Token {
	type: TokenType
	value?: string
}

function tokenize(expr: string): Token[] {
	const tokens: Token[] = []
	let i = 0
	while (i < expr.length) {
		if (expr[i] === ' ' || expr[i] === '\t') {
			i++
			continue
		}
		if (expr[i] === '(') { tokens.push({ type: 'LPAREN' }); i++; continue }
		if (expr[i] === ')') { tokens.push({ type: 'RPAREN' }); i++; continue }
		if (expr[i] === '!' || (expr[i] === '&' && expr[i + 1] !== '&')) {
			tokens.push({ type: 'NOT' }); i++; continue
		}
		if (expr[i] === '&' && expr[i + 1] === '&') {
			tokens.push({ type: 'AND' }); i += 2; continue
		}
		if (expr[i] === '|' && expr[i + 1] === '|') {
			tokens.push({ type: 'OR' }); i += 2; continue
		}
		// Variable or keyword
		const varMatch = expr.slice(i).match(/^([a-zA-Z_]\w*)/)
		if (varMatch) {
			const word = varMatch[1].toLowerCase()
			if (word === 'and') tokens.push({ type: 'AND' })
			else if (word === 'or') tokens.push({ type: 'OR' })
			else if (word === 'not') tokens.push({ type: 'NOT' })
			else if (word === 'true') tokens.push({ type: 'TRUE' })
			else if (word === 'false') tokens.push({ type: 'FALSE' })
			else tokens.push({ type: 'VAR', value: varMatch[1] })
			i += varMatch[1].length
			continue
		}
		i++ // skip unknown chars
	}
	return tokens
}

/** AST node for boolean expression */
interface BoolExpr {
	type: 'var' | 'and' | 'or' | 'not' | 'true' | 'false'
	variable?: string
	children?: BoolExpr[]
}

function parseExpression(tokens: Token[], pos: { i: number }): BoolExpr | null {
	return parseOr(tokens, pos)
}

function parseOr(tokens: Token[], pos: { i: number }): BoolExpr | null {
	const left = parseAnd(tokens, pos)
	if (left === null) return null

	while (pos.i < tokens.length && tokens[pos.i].type === 'OR') {
		pos.i++
		const right = parseAnd(tokens, pos)
		if (right === null) return null
		return { type: 'or', children: [left, right] }
	}
	return left
}

function parseAnd(tokens: Token[], pos: { i: number }): BoolExpr | null {
	const left = parseNot(tokens, pos)
	if (left === null) return null

	while (pos.i < tokens.length && tokens[pos.i].type === 'AND') {
		pos.i++
		const right = parseNot(tokens, pos)
		if (right === null) return null
		return { type: 'and', children: [left, right] }
	}
	return left
}

function parseNot(tokens: Token[], pos: { i: number }): BoolExpr | null {
	if (pos.i < tokens.length && tokens[pos.i].type === 'NOT') {
		pos.i++
		const expr = parseNot(tokens, pos)
		if (expr === null) return null
		return { type: 'not', children: [expr] }
	}
	return parsePrimary(tokens, pos)
}

function parsePrimary(tokens: Token[], pos: { i: number }): BoolExpr | null {
	if (pos.i >= tokens.length) return null

	const token = tokens[pos.i]
	if (token.type === 'TRUE') { pos.i++; return { type: 'true' } }
	if (token.type === 'FALSE') { pos.i++; return { type: 'false' } }
	if (token.type === 'VAR') { pos.i++; return { type: 'var', variable: token.value } }
	if (token.type === 'LPAREN') {
		pos.i++
		const expr = parseExpression(tokens, pos)
		if (pos.i < tokens.length && tokens[pos.i].type === 'RPAREN') pos.i++
		return expr
	}
	return null
}

/**
 * Convert boolean expression AST to CNF using distributive law.
 */
function expressionToCNF(tokens: Token[], varMap: Map<string, number>): CNFFormula {
	const pos = { i: 0 }
	const ast = parseExpression(tokens, pos)
	if (ast === null) return []

	const nnf = toNNF(ast)
	return nnfToCNF(nnf, varMap)
}

/**
 * Convert AST to Negation Normal Form (push NOTs to leaves).
 */
function toNNF(expr: BoolExpr): BoolExpr {
	switch (expr.type) {
		case 'var':
		case 'true':
		case 'false':
			return expr
		case 'not': {
			const child = expr.children![0]
			if (child.type === 'not') return toNNF(child.children![0])
			if (child.type === 'true') return { type: 'false' }
			if (child.type === 'false') return { type: 'true' }
			if (child.type === 'and') {
				return {
					type: 'or',
					children: [
						toNNF({ type: 'not', children: [child.children![0]] }),
						toNNF({ type: 'not', children: [child.children![1]] }),
					],
				}
			}
			if (child.type === 'or') {
				return {
					type: 'and',
					children: [
						toNNF({ type: 'not', children: [child.children![0]] }),
						toNNF({ type: 'not', children: [child.children![1]] }),
					],
				}
			}
			return { type: 'not', children: [toNNF(child)] }
		}
		case 'and':
			return { type: 'and', children: expr.children!.map(toNNF) }
		case 'or':
			return { type: 'or', children: expr.children!.map(toNNF) }
	}
}

/**
 * Convert NNF to CNF by distributing OR over AND.
 */
function nnfToCNF(expr: BoolExpr, varMap: Map<string, number>): CNFFormula {
	switch (expr.type) {
		case 'true':
			return [[1]] // tautology — any literal works
		case 'false':
			return [[1], [-1]] // contradiction
		case 'var': {
			const varNum = varMap.get(expr.variable!) ?? 1
			return [[varNum]]
		}
		case 'not': {
			const child = expr.children![0]
			if (child.type === 'var') {
				const varNum = varMap.get(child.variable!) ?? 1
				return [[-varNum]]
			}
			// After NNF, NOT should only be on variables
			return [[1]]
		}
		case 'and': {
			const clauses: Clause[] = []
			for (const child of expr.children!) {
				clauses.push(...nnfToCNF(child, varMap))
			}
			return clauses
		}
		case 'or': {
			const children = expr.children!.map((c) => nnfToCNF(c, varMap))
			// Distribute: (A1 ∧ A2) ∨ (B1 ∧ B2) = all pairs
			return distributeCNF(children)
		}
	}
}

/**
 * Distribute OR over AND for CNF conversion.
 * [[a,b], [c,d]] OR [[e,f]] => all combinations.
 */
function distributeCNF(cnfSets: CNFFormula[]): CNFFormula {
	if (cnfSets.length === 0) return []
	if (cnfSets.length === 1) return cnfSets[0]

	const [first, ...rest] = cnfSets
	const restDistributed = distributeCNF(rest)

	const result: CNFFormula = []
	for (const clause of first) {
		for (const restClause of restDistributed) {
			result.push([...clause, ...restClause])
		}
	}
	return result
}

/**
 * Check feasibility of a set of code path constraints.
 *
 * @param constraints - Path constraints from branch conditions
 * @returns Feasibility result
 */
export function checkPathFeasibility(
	constraints: import('./types.js').PathConstraint[],
	config?: SATConfig,
): import('./types.js').PathFeasibilityResult {
	const formula: CNFFormula = constraints.map((c) => c.clause)
	const satResult = solveDPLL(formula, config)

	return {
		feasible: satResult.satisfiable,
		constraints,
		satResult,
		reason: satResult.satisfiable
			? null
			: `Path is infeasible: ${constraints.map((c) => c.description).join(' ∧ ')} has no satisfying assignment`,
	}
}

/**
 * Extract path constraints from TypeScript code.
 * Detects if/else branches and builds constraint system.
 *
 * @param code - Source code to analyze
 * @param filePath - File path for reporting
 * @returns Array of path constraints
 */
export function extractPathConstraints(
	code: string,
	filePath: string,
): import('./types.js').PathConstraint[] {
	const constraints: import('./types.js').PathConstraint[] = []
	const lines = code.split('\n')

	// Track variable to SAT variable mapping
	const varMap = new Map<string, number>()
	let nextVar = 1

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i]
		const lineNum = i + 1

		// Detect if conditions
		const ifMatch = line.match(/if\s*\(([^)]+)\)/)
		if (ifMatch) {
			const condition = ifMatch[1].trim()

			// Extract simple boolean variables from condition
			const boolVars = condition.match(/\b([a-zA-Z_]\w*)\b/g)
			if (boolVars) {
				for (const bv of boolVars) {
					if (['true', 'false', 'undefined', 'null'].includes(bv)) continue
					if (!varMap.has(bv)) {
						varMap.set(bv, nextVar++)
					}
				}
			}

			// Simple condition: single variable or !variable
			const simpleVar = condition.match(/^\s*(!?)([a-zA-Z_]\w*)\s*$/)
			if (simpleVar) {
				const negated = simpleVar[1] === '!'
				const varName = simpleVar[2]
				const satVar = varMap.get(varName) ?? nextVar++
				if (!varMap.has(varName)) varMap.set(varName, nextVar - 1)

				constraints.push({
					filePath,
					lineNumber: lineNum,
					clause: [negated ? -satVar : satVar],
					description: `${negated ? '!' : ''}${varName} at line ${lineNum}`,
				})
			}
		}
	}

	return constraints
}
