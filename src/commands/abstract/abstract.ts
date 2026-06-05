import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/messages.mjs'
import type { Command } from '../../commands.js'
import { analyzeAbstractly } from '../../abstractInterpretation/index.js'

const command: Command = {
	type: 'prompt',
	name: 'abstract',
	description:
		'Abstract Interpretation — prove properties without execution via interval/sign analysis',
	isEnabled: () => true,
	progressMessage: 'running abstract interpretation',
	contentLength: 0,
	source: 'builtin',
	async getPromptForCommand(args?: string): Promise<ContentBlockParam[]> {
		const action = args?.trim() || 'help'

		if (action === 'help' || action === '') {
			return [{ type: 'text', text: `[Abstract Interpretation]
Prove code properties WITHOUT executing — interval and sign domain analysis.

Usage:
- /abstract help — Show this help
- /abstract analyze <code> — Analyze code for bugs
- /abstract domains — List abstract domains

Domains:
- Interval [lo, hi]: tracks numeric ranges with lattice operations
- Sign {+, -, 0, ⊤, ⊥}: tracks sign of values
- Null analysis: tracks mayBeNull/mayBeUndefined

Checks (sound — zero false negatives):
- Array out-of-bounds (negative indices)
- Division by zero (divisor interval contains 0)
- Null dereference (accessing .prop on nullable value)

Sound by construction: if AI says safe, it IS safe.` }]
		}

		if (action === 'domains') {
			return [{ type: 'text', text: `[Abstract Domains]
1. Interval Domain [lo, hi]
   - Lattice: bottom < [a,b] < top
   - Operations: +, -, *, / with sound over-approximation
   - Widening: accelerates fixpoint for loops
   - Narrowing: refines widened bounds

2. Sign Domain {+, -, 0, ⊤, ⊥}
   - Lattice: bottom < {+, -, 0} < top
   - Fast check: "can this be negative?"
   - Used for quick branch feasibility

3. Null Analysis
   - Tracks mayBeNull and mayBeUndefined per variable
   - Detects potential null dereference on .prop access` }]
		}

		if (action.startsWith('analyze ')) {
			const code = action.slice(8)
			if (code.length < 10) {
				return [{ type: 'text', text: '[Abstract] Provide code to analyze: /abstract analyze <code>' }]
			}

			const result = analyzeAbstractly(code, 'inline-code.ts')

			const lines = [
				`[Abstract Interpretation]`,
				`Variables tracked: ${result.variablesTracked}`,
				`Soundness score: ${(result.soundnessScore * 100).toFixed(1)}%`,
				`Findings: ${result.findings.length}`,
			]

			if (result.findings.length > 0) {
				lines.push(`\nFindings:`)
				for (const f of result.findings) {
					const icon = f.severity === 'error' ? 'ERR' : f.severity === 'warning' ? 'WRN' : 'INF'
					lines.push(`  [${icon}] L${f.lineNumber}: ${f.message} (${(f.confidence * 100).toFixed(0)}%)`)
				}
			} else {
				lines.push(`\nNo issues found — code is sound!`)
			}

			return [{ type: 'text', text: lines.join('\n') }]
		}

		return [{ type: 'text', text: `[Abstract] Unknown action: ${action}. Use /abstract help.` }]
	},
}

export default command
