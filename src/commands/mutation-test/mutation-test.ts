import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/messages.mjs'
import type { Command } from '../../commands.js'
import { generateMutants, computeMutationScore, generateSuggestions } from '../../mutationTesting/index.js'

const command: Command = {
	type: 'prompt',
	name: 'mutation-test',
	description:
		'Mutation Testing — generate code mutants and measure test suite quality via mutation score',
	isEnabled: () => true,
	progressMessage: 'running mutation testing',
	contentLength: 0,
	source: 'builtin',
	async getPromptForCommand(args?: string): Promise<ContentBlockParam[]> {
		const action = args?.trim() || 'help'

		if (action === 'help' || action === '') {
			return [{ type: 'text', text: `[Mutation Testing]
Generate code mutants and verify test suites catch them.

Usage:
- /mutation-test help — Show this help
- /mutation-test analyze <code> — Analyze code for possible mutations
- /mutation-test operators — List mutation operators

Mutation operators: flip_arithmetic, flip_comparison, flip_logical, flip_boolean,
negate_condition, remove_statement, change_return, boundary_change

Mutation score = killed / (total - equivalent). 100% = perfect test suite.` }]
		}

		if (action === 'operators') {
			return [{ type: 'text', text: `[Mutation Operators]
- flip_arithmetic: + → -, * → /, etc
- flip_comparison: === → !==, > → <, etc
- flip_logical: && → ||, || → &&
- flip_boolean: true → false, false → true
- negate_condition: if (x) → if (!(x))
- remove_statement: delete a line of code
- change_return: return x → return undefined/0/''/null/false
- boundary_change: >= → >, <= → <` }]
		}

		if (action.startsWith('analyze ')) {
			const code = action.slice(8)
			if (code.length < 10) {
				return [{ type: 'text', text: '[Mutation Testing] Provide code to analyze: /mutation-test analyze <code>' }]
			}

			const mutants = generateMutants(code, 'inline-code.ts')
			const score = computeMutationScore(mutants)
			const suggestions = generateSuggestions(mutants)

			const lines = [
				`[Mutation Analysis]`,
				`Total mutants: ${score.total}`,
				`By operator:`,
			]

			for (const [op, data] of Object.entries(score.byOperator)) {
				lines.push(`  ${op}: ${data.total} mutants`)
			}

			if (suggestions.length > 0) {
				lines.push(`\nSuggestions:`)
				for (const s of suggestions.slice(0, 5)) {
					lines.push(`  - ${s}`)
				}
			}

			return [{ type: 'text', text: lines.join('\n') }]
		}

		return [{ type: 'text', text: `[Mutation Testing] Unknown action: ${action}. Use /mutation-test help.` }]
	},
}

export default command
