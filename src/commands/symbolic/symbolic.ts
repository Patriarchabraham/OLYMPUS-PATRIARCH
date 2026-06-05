import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/messages.mjs'
import type { Command } from '../../commands.js'
import { executeSymbolically, simplifyExpr } from '../../symbolicExecution/index.js'

const command: Command = {
	type: 'prompt',
	name: 'symbolic',
	description:
		'Symbolic Execution — explore all code paths with symbolic values to find path-specific bugs',
	isEnabled: () => true,
	progressMessage: 'running symbolic execution',
	contentLength: 0,
	source: 'builtin',
	async getPromptForCommand(args?: string): Promise<ContentBlockParam[]> {
		const action = args?.trim() || 'help'

		if (action === 'help' || action === '') {
			return [{ type: 'text', text: `[Symbolic Execution]
Explore ALL code paths with symbolic values — finds bugs that only occur on specific paths.

Usage:
- /symbolic help — Show this help
- /symbolic analyze <code> — Analyze code symbolically
- /symbolic simplify <expr> — Simplify a symbolic expression

How it works:
- Assigns symbolic (unknown) values to variables
- Explores every branch (if/else) combination
- Builds path conditions (constraints along each path)
- Checks feasibility: can this path actually execute?
- Reports: division by zero, array OOB, error paths

Unlike abstract interpretation (over-approximates), symbolic execution
explores each path individually with precise constraints.

Limits: maxPathDepth=10, maxPaths=100, maxLoopUnroll=3` }]
		}

		if (action.startsWith('simplify ')) {
			const code = action.slice(9)
			if (code.length < 3) {
				return [{ type: 'text', text: '[Symbolic] Provide expression: /symbolic simplify <expr>' }]
			}

			const result = executeSymbolically(`const x = ${code}`, 'inline.ts')
			if (result.paths.length > 0 && result.paths[0]!.finalState.has('x')) {
				const expr = result.paths[0]!.finalState.get('x')!
				const simplified = simplifyExpr(expr)
				return [{ type: 'text', text: `[Symbolic Simplify]\nOriginal: ${JSON.stringify(expr)}\nSimplified: ${JSON.stringify(simplified)}` }]
			}

			return [{ type: 'text', text: `[Symbolic] Could not parse expression.` }]
		}

		if (action.startsWith('analyze ')) {
			const code = action.slice(8)
			if (code.length < 10) {
				return [{ type: 'text', text: '[Symbolic] Provide code to analyze: /symbolic analyze <code>' }]
			}

			const result = executeSymbolically(code, 'inline-code.ts')

			const lines = [
				`[Symbolic Execution]`,
				`Total paths: ${result.totalPaths}`,
				`Feasible: ${result.feasiblePaths} | Infeasible: ${result.infeasiblePaths}`,
				`Findings: ${result.findings.length}`,
				`Duration: ${result.durationMs.toFixed(1)}ms`,
			]

			if (result.paths.length > 0) {
				lines.push(`\nPaths:`)
				for (const path of result.paths.slice(0, 10)) {
					const conds = path.conditions.map((c) => c.description).join(', ')
					lines.push(`  ${path.id}: ${path.feasible ? 'feasible' : 'infeasible'} [${conds || 'no branches'}]`)
					if (path.findings.length > 0) {
						for (const f of path.findings) {
							const icon = f.severity === 'error' ? 'ERR' : f.severity === 'warning' ? 'WRN' : 'INF'
							lines.push(`    [${icon}] L${f.lineNumber}: ${f.message}`)
						}
					}
				}
			}

			if (result.findings.length > 0) {
				lines.push(`\nAll findings:`)
				for (const f of result.findings.slice(0, 10)) {
					const icon = f.severity === 'error' ? 'ERR' : f.severity === 'warning' ? 'WRN' : 'INF'
					lines.push(`  [${icon}] L${f.lineNumber}: ${f.message} (${f.check})`)
					if (f.witness) lines.push(`    Witness: ${f.witness}`)
				}
			} else {
				lines.push(`\nNo issues found across all paths.`)
			}

			return [{ type: 'text', text: lines.join('\n') }]
		}

		return [{ type: 'text', text: `[Symbolic] Unknown action: ${action}. Use /symbolic help.` }]
	},
}

export default command
