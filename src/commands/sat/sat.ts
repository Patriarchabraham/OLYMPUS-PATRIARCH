import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/messages.mjs'
import type { Command } from '../../commands.js'
import { solveDPLL, parseToCNF, checkPathFeasibility } from '../../satSolver/dpll.js'

const command: Command = {
	type: 'prompt',
	name: 'sat',
	description:
		'SAT Solver — DPLL algorithm for boolean satisfiability, path feasibility, and constraint solving',
	isEnabled: () => true,
	progressMessage: 'running SAT solver',
	contentLength: 0,
	source: 'builtin',
	async getPromptForCommand(args?: string): Promise<ContentBlockParam[]> {
		const action = args?.trim() || 'help'

		if (action === 'help' || action === '') {
			return [{ type: 'text', text: `[SAT Solver — DPLL]
Boolean satisfiability solver with unit propagation + pure literal elimination.

Usage:
- /sat help — Show this help
- /sat solve <expression> — Solve a boolean expression for satisfiability
- /sat path <constraints> — Check path feasibility
- /sat algorithms — List available algorithms

Example:
  /sat solve "(a || b) && (!a || c)"
  /sat solve "x && !x"  → UNSAT (contradiction)

The solver converts expressions to CNF, then applies DPLL with:
- Unit propagation (forced assignments)
- Pure literal elimination (single-polarity variables)
- MOMS branching heuristic` }]
		}

		if (action === 'algorithms') {
			return [{ type: 'text', text: `[SAT Algorithms]
- DPLL (Davis-Putnam-Logemann-Loveland)
  - Unit propagation: single-literal clauses force assignments
  - Pure literal elimination: variables in only one polarity
  - MOMS branching: choose vars in minimum-size clauses
  - Backtracking search with conflict detection` }]
		}

		if (action.startsWith('solve ')) {
			const expr = action.slice(6)
			if (expr.length < 2) {
				return [{ type: 'text', text: '[SAT] Provide an expression: /sat solve "(a || b) && (!a || c)"' }]
			}

			const cnf = parseToCNF(expr)
			const result = solveDPLL(cnf)

			const lines = [
				`[SAT Solver: ${expr}]`,
				`Result: ${result.satisfiable ? 'SATISFIABLE' : 'UNSATISFIABLE'}`,
				`Clauses: ${cnf.length}`,
				`Decisions: ${result.decisions}`,
				`Propagations: ${result.propagations}`,
				`Time: ${result.durationMs.toFixed(2)}ms`,
			]

			if (result.model) {
				const assignments = [...result.model.entries()]
					.map(([v, val]) => `x${v}=${val}`)
					.join(', ')
				lines.push(`Model: { ${assignments} }`)
			}

			return [{ type: 'text', text: lines.join('\n') }]
		}

		if (action.startsWith('path ')) {
			const constraintsStr = action.slice(5)
			const constraints = constraintsStr.split(';').map((c, i) => ({
				filePath: 'input',
				lineNumber: i + 1,
				clause: c.trim().split(',').map(Number).filter((n) => n !== 0),
				description: c.trim(),
			})).filter((c) => c.clause.length > 0)

			if (constraints.length === 0) {
				return [{ type: 'text', text: '[SAT] Provide path constraints: /sat path "1; -1" (SAT vars as numbers)' }]
			}

			const result = checkPathFeasibility(constraints)

			const lines = [
				`[Path Feasibility Check]`,
				`Constraints: ${constraints.length}`,
				`Result: ${result.feasible ? 'FEASIBLE' : 'INFEASIBLE'}`,
			]

			if (result.reason) {
				lines.push(`Reason: ${result.reason}`)
			}

			return [{ type: 'text', text: lines.join('\n') }]
		}

		return [{ type: 'text', text: `[SAT] Unknown action: ${action}. Use /sat help.` }]
	},
}

export default command
