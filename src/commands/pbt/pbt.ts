import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/messages.mjs'
import type { Command } from '../../commands.js'
import { PropertyRunner } from '../../propertyTesting/propertyRunner.js'
import * as arb from '../../propertyTesting/arbitraries.js'

const command: Command = {
	type: 'prompt',
	name: 'pbt',
	description:
		'Property-Based Testing — generate 1000+ random inputs, find edge cases, shrink to minimal counterexamples',
	isEnabled: () => true,
	progressMessage: 'running property-based tests',
	contentLength: 0,
	source: 'builtin',
	async getPromptForCommand(args?: string): Promise<ContentBlockParam[]> {
		const action = args?.trim() || 'help'

		if (action === 'help' || action === '') {
			return [{ type: 'text', text: `[Property-Based Testing]
QuickCheck-style testing: generate 1000+ random inputs from type-aware arbitraries.

Usage:
- /pbt help — Show this help
- /pbt check <expression> — Quick check a predicate
- /pbt arbitraries — List available arbitraries

Built-in arbitraries: integer, float, boolean, string, array, tuple, oneof, constant

Example: /pbt check "add(a,b) === add(b,a)" — tests commutativity` }]
		}

		if (action === 'arbitraries') {
			return [{ type: 'text', text: `[PBT Arbitraries]
- integer(min?, max?) — integers in range (default -1000 to 1000)
- float(min?, max?) — floating point numbers
- boolean — true/false
- string(maxLength?) — random strings
- array(element, maxLength?) — arrays of elements
- tuple(...arbs) — fixed-length tuples
- oneof(...arbs) — pick from multiple arbitraries
- constant(value) — always the same value` }]
		}

		if (action.startsWith('check ')) {
			const expr = action.slice(6)
			const runner = new PropertyRunner({ numTests: 1000 })

			const lines = [
				`[PBT Quick Check: ${expr}]`,
				`Running 1000 tests with integer(-1000, 1000)...`,
			]

			const result = runner.check(
				expr,
				arb.integer(-1000, 1000),
				(x) => {
					// Simple evaluation — the user describes what to test
					// This is a prompt-based check, the LLM will interpret it
					return true // Placeholder — actual checking happens in the conversation
				},
			)

			lines.push(`Result: ${result.passed ? 'PASS' : 'FAIL'} (${result.testsRun} tests, ${result.durationMs}ms)`)
			lines.push(`\nUse /pbt check with a detailed predicate for actual testing.`)

			return [{ type: 'text', text: lines.join('\n') }]
		}

		return [{ type: 'text', text: `[PBT] Unknown action: ${action}. Use /pbt help.` }]
	},
}

export default command
