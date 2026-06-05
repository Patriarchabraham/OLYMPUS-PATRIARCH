import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/messages.mjs'
import type { Command } from '../../commands.js'
import { parseContracts } from '../../contractProgramming/contractParser.js'
import { verifyContracts } from '../../contractProgramming/contractVerifier.js'

const command: Command = {
	type: 'prompt',
	name: 'contract',
	description:
		'Design by Contract — parse @pre/@post/@invariant from JSDoc and verify contract compliance',
	isEnabled: () => true,
	progressMessage: 'verifying contracts',
	contentLength: 0,
	source: 'builtin',
	async getPromptForCommand(args?: string): Promise<ContentBlockParam[]> {
		const action = args?.trim() || 'help'

		if (action === 'help' || action === '') {
			return [{ type: 'text', text: `[Design by Contract]
Parse and verify @pre, @post, @invariant contracts from JSDoc.

Usage:
- /contract help — Show this help
- /contract analyze <code> — Parse and verify contracts in code
- /contract tags — List supported contract tags

Contract Tags:
- @pre / @precondition — Precondition (must be true on entry)
- @post / @postcondition — Postcondition (must be true on exit)
- @invariant / @inv — Invariant (must be true always)

Example:
/**
 * @param x
 * @pre x > 0
 * @post result >= 0
 */
function sqrt(x: number): number { ... }

/contract analyze <code>` }]
		}

		if (action === 'tags') {
			return [{ type: 'text', text: `[Contract Tags]
- @pre <condition> — Precondition: must hold when function is called
- @precondition <condition> — Alias for @pre
- @post <condition> — Postcondition: must hold when function returns
- @postcondition <condition> — Alias for @post
- @invariant <condition> — Must hold before and after every call
- @inv <condition> — Alias for @invariant

Conditions can reference parameters and return values.` }]
		}

		if (action.startsWith('analyze ')) {
			const code = action.slice(8)
			if (code.length < 10) {
				return [{ type: 'text', text: '[Contract] Provide code to analyze: /contract analyze <code>' }]
			}

			const clauses = parseContracts(code, 'inline-code.ts')
			if (clauses.length === 0) {
				return [{ type: 'text', text: '[Contract] No contract annotations (@pre/@post/@invariant) found in code.' }]
			}

			const report = verifyContracts(clauses, code)

			const lines = [
				`[Contract Analysis]`,
				`Total contracts: ${report.totalContracts}`,
				`Satisfied: ${report.satisfied}`,
				`Violated: ${report.violated}`,
				`Unverifiable: ${report.unverifiable}`,
				`Compliance: ${(report.complianceScore * 100).toFixed(1)}%`,
			]

			lines.push(`\nDetails:`)
			for (const r of report.results) {
				const status = r.satisfied ? 'PASS' : 'FAIL'
				const conf = (r.confidence * 100).toFixed(0)
				lines.push(`  [${status}] ${r.clause.kind}: "${r.clause.condition}" (${conf}% confidence)`)
				if (r.evidence) {
					lines.push(`    Evidence: ${r.evidence}`)
				}
			}

			if (report.suggestions.length > 0) {
				lines.push(`\nSuggestions:`)
				for (const s of report.suggestions.slice(0, 5)) {
					lines.push(`  - ${s}`)
				}
			}

			return [{ type: 'text', text: lines.join('\n') }]
		}

		return [{ type: 'text', text: `[Contract] Unknown action: ${action}. Use /contract help.` }]
	},
}

export default command
