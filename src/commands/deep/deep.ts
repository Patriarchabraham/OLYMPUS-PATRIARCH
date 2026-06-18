import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/messages.mjs'
import type { Command } from '../../commands.js'
import { cognize, renderProvenance } from '../../cognition/index.js'
import { getSuperAgentOrchestrator } from '../../services/superAgent/index.js'

const helpText = `[Deep Cognition] — the REAL closed-loop meta-cognition pipeline.

Usage:
- /deep <task>   Run intent resolution -> cortex meta-analysis -> reasoning with
                  depth escalation -> convergence on blind spots -> cross-model
                  verification -> transparently-measured confidence.
- /deep help     Show this help.

Unlike prompt-only "deep/omega/consciousness" skills, this prints MEASURED
provenance: which strategies ran, each confidence component (cortex calibration,
reasoning quality, cross-model agreement), escalations, convergence, and
contradictions. Without an API key it degrades honestly (reasoning skipped).`

const command = {
	type: 'prompt',
	name: 'deep',
	description: 'Run the closed-loop meta-cognition pipeline and print measured provenance',
	isEnabled: () => true,
	progressMessage: 'running deep cognition',
	contentLength: 0,
	source: 'builtin',
	async getPromptForCommand(args?: string): Promise<ContentBlockParam[]> {
		const task = args?.trim() || ''
		if (!task || task === 'help') {
			return [{ type: 'text', text: helpText }]
		}

		try {
			// Initialize the super-agent so cortex + the cross-model verification
			// provider are wired (the singleton CortexEngine cognize() reuses).
			const orchestrator = getSuperAgentOrchestrator()
			await orchestrator.initialize()
			const { createGenerateFn } = await import('../../reasoning/generateFnFactory.js')
			const generateFn = await createGenerateFn()

			const result = await cognize(task, { generateFn })
			return [{ type: 'text', text: renderProvenance(result) }]
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e)
			return [{ type: 'text', text: `[Deep Cognition] failed: ${msg}` }]
		}
	},
} satisfies Command

export default command
