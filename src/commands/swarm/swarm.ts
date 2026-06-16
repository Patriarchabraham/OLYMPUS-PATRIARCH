import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/messages.mjs'
import type { Command } from '../../commands.js'
import { getSuperAgentOrchestrator } from '../../services/superAgent/index.js'
import type { SwarmTaskResult } from '../../swarm/types.js'

/**
 * Render swarm execution results as a structured, honest text report.
 * Accepts either a Map (what SuperAgent.executeSwarm returns) or an array.
 */
function renderSwarmResults(
	results: Map<string, SwarmTaskResult> | SwarmTaskResult[] | null,
): string {
	if (!results) return '[Swarm] No results — swarm is disabled or failed to start.'
	const list = Array.isArray(results) ? results : [...results.values()]
	if (list.length === 0) return '[Swarm] No tasks were executed.'

	const blocks = list.map((r, i) => {
		const role = (r.metadata?.agentRole as string | undefined) ?? 'unknown'
		const status = r.success ? '✓ success' : '✗ failed'
		const output = r.output.length > 400 ? `${r.output.slice(0, 400)}…` : r.output
		return `### Task ${i + 1} — ${status}\n- Role: ${role}\n- Output:\n${output || '(empty)'}`
	})
	const ok = list.filter((r) => r.success).length
	return `[Swarm] ${ok}/${list.length} task(s) succeeded.\n\n${blocks.join('\n\n')}`
}

const helpText = `[Swarm System] — real multi-agent execution

Usage:
- /swarm run <task>   Execute a task through the multi-agent pipeline
                      (decompose → role agents → parallel execution → results)
- /swarm status       Show active swarm state
- /swarm help         Show this help

Agent roles: researcher, coder, tester, reviewer, architect.

How it works:
- The task is decomposed into subtasks by complexity analysis.
- Subtasks are assigned to role-specialized agents and run in parallel,
  respecting dependencies.
- Each agent runs on a real model (the LLM executor). Without an API key,
  tasks report 'failed' honestly rather than faking success.`

const command = {
	type: 'prompt',
	name: 'swarm',
	description: 'Run a task through the multi-agent swarm pipeline, or show swarm status',
	isEnabled: () => true,
	progressMessage: 'running swarm',
	contentLength: 0,
	source: 'builtin',
	async getPromptForCommand(args?: string): Promise<ContentBlockParam[]> {
		const action = args?.trim() || 'help'

		if (action === 'help' || action === '') {
			return [{ type: 'text', text: helpText }]
		}

		if (action.startsWith('run')) {
			const task = action.slice(3).trim()
			if (!task) {
				return [{ type: 'text', text: 'Usage: /swarm run <task description>' }]
			}
			const orchestrator = getSuperAgentOrchestrator()
			try {
				await orchestrator.initialize()
				const results = await orchestrator.executeSwarm([task])
				return [{ type: 'text', text: renderSwarmResults(results) }]
			} catch (e) {
				const msg = e instanceof Error ? e.message : String(e)
				return [{ type: 'text', text: `[Swarm] Execution failed: ${msg}` }]
			}
		}

		if (action === 'status') {
			const orchestrator = getSuperAgentOrchestrator()
			const swarms = orchestrator.getState().activeSwarms
			if (swarms.length === 0) {
				return [
					{
						type: 'text',
						text: '[Swarm Status]\nNo active swarm. Use /swarm run <task> to execute one.',
					},
				]
			}
			return [
				{
					type: 'text',
					text: `[Swarm Status]\nActive swarms: ${swarms.length}`,
				},
			]
		}

		return [{ type: 'text', text: helpText }]
	},
} satisfies Command

export default command
