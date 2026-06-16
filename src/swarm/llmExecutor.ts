/**
 * LLM-backed agent executor for the swarm orchestrator.
 *
 * This wires real model calls into SwarmOrchestrator.executeSwarm(). Before this
 * module existed, callers had to pass their own executor callback — and none did.
 * The orchestrator was a task queue with no workers.
 *
 * Per-role system prompts come from roles.ts. The executor:
 *   1. Looks up the agent's role definition.
 *   2. Builds a prompt with the task description and role context.
 *   3. Calls sideQuery() (the same path used by createGenerateFn for reasoning).
 *   4. Returns SwarmTaskResult with output + metadata.
 *
 * Errors from the model call are surfaced as success=false (the orchestrator
 * already handles failed tasks via dependency gating).
 */

import type { BetaMessage } from '@anthropic-ai/sdk/resources/beta/messages.mjs'
import { getSmallFastModel } from '../utils/model/model.js'
import { sideQuery } from '../utils/sideQuery.js'
import { getEnrichedRoleDefinition, getRoleDefinition } from './roles.js'
import type { AgentRole, SwarmAgentInfo, SwarmTask, SwarmTaskResult } from './types.js'

const BASE_PROMPT = `You are an Olympuz Coder swarm agent executing one task within a multi-agent orchestration. Other agents are running in parallel and may depend on your output.

Return ONLY the task output. No preamble, no meta-discussion.
- If the task is research/analysis: return concise structured findings.
- If the task is code: return the code plus a one-line summary.
- If the task cannot be completed: respond with a line starting with "ERROR:" followed by the reason.`

export interface LlmExecutorOptions {
	/** Model name. Defaults to getSmallFastModel(). */
	model?: string
	/** Max tokens for the response. Defaults to 2048. */
	maxTokens?: number
	/** Temperature override. Defaults to 0.3. */
	temperature?: number
	/** Override the role → system prompt mapping. */
	systemPromptForRole?: (role: AgentRole) => string
	/**
	 * Optional injection seam for tests. When provided, this function replaces
	 * the sideQuery() call. Production callers should leave this undefined.
	 */
	callModel?: (params: {
		model: string
		system: string
		userPrompt: string
		maxTokens: number
		temperature: number
	}) => Promise<Pick<BetaMessage, 'content' | 'stop_reason'>>
}

/**
 * Build the user prompt for a single swarm task.
 */
export function buildTaskPrompt(task: SwarmTask, agent: SwarmAgentInfo): string {
	const role = getRoleDefinition(agent.role)
	return [
		BASE_PROMPT,
		'',
		`[Agent]`,
		`Role: ${agent.role} — ${role.description}`,
		`Task ID: ${task.id}`,
		`Priority: ${task.priority}`,
		'',
		`[Task]`,
		task.description,
	].join('\n')
}

/**
 * Create an LLM-backed executor for SwarmOrchestrator.executeSwarm().
 *
 * @example
 * ```ts
 * const orchestrator = getSwarmOrchestrator()
 * const swarmId = orchestrator.createSwarm()
 * orchestrator.registerAgent(swarmId, { id: 'a1', role: 'coder', ... })
 * orchestrator.submitTask(swarmId, 'Implement foo() in bar.ts')
 * const executor = createLlmAgentExecutor()
 * const results = await orchestrator.executeSwarm(swarmId, executor)
 * ```
 */
export function createLlmAgentExecutor(opts: LlmExecutorOptions = {}) {
	const maxTokens = opts.maxTokens ?? 2048
	const temperature = opts.temperature ?? 0.3

	return async function llmExecutor(
		task: SwarmTask,
		agent: SwarmAgentInfo,
	): Promise<SwarmTaskResult> {
		// Resolve the model lazily, per call. Resolving it at factory time (the old
		// `const model = opts.model ?? getSmallFastModel()` outside the closure) ran
		// the settings/model init chain at module import, which deadlocks under Vite
		// SSR ("Cannot access '__vite_ssr_import_N__' before initialization"). Lazy
		// resolution also picks up config changes between calls.
		const model = opts.model ?? getSmallFastModel()
		const role = getEnrichedRoleDefinition(agent.role)
		const system = opts.systemPromptForRole?.(agent.role) ?? role.systemPromptAddendum
		const userPrompt = buildTaskPrompt(task, agent)

		try {
			const response = opts.callModel
				? await opts.callModel({
						model,
						system,
						userPrompt,
						maxTokens,
						temperature,
					})
				: await sideQuery({
						querySource: 'swarm_executor',
						model,
						system,
						messages: [{ role: 'user', content: userPrompt }],
						max_tokens: maxTokens,
						maxRetries: 1,
						temperature,
					})

			const textParts: string[] = []
			for (const block of response.content) {
				if (block.type === 'text') textParts.push(block.text)
			}
			const output = textParts.join('\n').trim()
			const isError = output.startsWith('ERROR:')

			return {
				taskId: task.id,
				success: !isError && output.length > 0,
				output,
				metadata: {
					agentRole: agent.role,
					model,
					stopReason: response.stop_reason,
				},
			}
		} catch (err) {
			return {
				taskId: task.id,
				success: false,
				output: err instanceof Error ? err.message : String(err),
				metadata: {
					agentRole: agent.role,
					model,
					errorClass: (err as { constructor?: { name?: string } })?.constructor?.name,
				},
			}
		}
	}
}

/**
 * Default executor instance using the small fast model.
 * Import this when you just want a working executor with no configuration.
 */
export const defaultLlmAgentExecutor = createLlmAgentExecutor()
