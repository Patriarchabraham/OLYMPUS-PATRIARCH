import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/messages.mjs'
import type { Command } from '../../commands.js'
import { fuzz } from '../../fuzzingEngine/fuzzer.js'

const command: Command = {
	type: 'prompt',
	name: 'fuzz',
	description:
		'Fuzzing Engine — feedback-directed mutation fuzzing to find crashes and edge cases',
	isEnabled: () => true,
	progressMessage: 'running fuzzer',
	contentLength: 0,
	source: 'builtin',
	async getPromptForCommand(args?: string): Promise<ContentBlockParam[]> {
		const action = args?.trim() || 'help'

		if (action === 'help' || action === '') {
			return [{ type: 'text', text: `[Fuzzing Engine]
Feedback-directed mutation fuzzing to find crashes.

Usage:
- /fuzz help — Show this help
- /fuzz run — Run demo fuzzing session
- /fuzz strategies — List mutation strategies

Mutation strategies:
- bit-flip: Flip random bits in input
- byte-flip: Add random value to a byte
- arithmetic: Add/subtract small delta
- insert-byte: Insert a random byte
- delete-byte: Delete a random byte
- replace-byte: Replace byte with random value
- splice: Replace part with random bytes
- havoc: Apply 5-15 random mutations

Finds crashes that PBT and mutation testing miss.` }]
		}

		if (action === 'strategies') {
			return [{ type: 'text', text: `[Fuzzing Strategies]
1. bit-flip — XOR a random bit (good for format parsing)
2. byte-flip — Add random value to byte
3. arithmetic — Add/subtract [-17, +17] to byte
4. insert-byte — Insert random byte at random position
5. delete-byte — Remove a byte from input
6. replace-byte — Replace byte with random value
7. splice — Replace tail with random bytes
8. havoc — Apply 5-15 random mutations (most powerful)

Coverage-guided mode keeps inputs that discover new branches.` }]
		}

		if (action === 'run') {
			// Demo fuzzing session against a synthetic target
			const target = (input: Uint8Array): 'pass' | 'crash' | 'error' => {
				if (input.length >= 4 && input[0] === 0x41 && input[1] === 0x42 && input[2] === 0x43) {
					return 'crash'
				}
				return 'pass'
			}

			const result = fuzz(target, {
				maxTests: 500,
				maxInputSize: 256,
				testTimeoutMs: 100,
				seeds: [new Uint8Array([0x41, 0x42, 0x43, 0x44])],
				strategies: ['bit-flip', 'byte-flip', 'arithmetic', 'havoc'],
				coverageGuided: true,
				minCorpusSize: 1,
			}, 42)

			const lines = [
				`[Fuzzing Session]`,
				`Total tests: ${result.stats.totalTests}`,
				`Crashes: ${result.stats.crashes}`,
				`Branches discovered: ${result.stats.totalBranches}`,
				`Tests/sec: ${result.stats.testsPerSecond.toFixed(0)}`,
				`Duration: ${result.stats.durationMs.toFixed(0)}ms`,
				`Corpus size: ${result.corpus.length}`,
			]

			if (result.crashes.length > 0) {
				lines.push(`\nCrashes found:`)
				for (const c of result.crashes.slice(0, 3)) {
					lines.push(`  Input: ${c.inputRepr.slice(0, 60)}...`)
				}
			}

			return [{ type: 'text', text: lines.join('\n') }]
		}

		return [{ type: 'text', text: `[Fuzz] Unknown action: ${action}. Use /fuzz help.` }]
	},
}

export default command
