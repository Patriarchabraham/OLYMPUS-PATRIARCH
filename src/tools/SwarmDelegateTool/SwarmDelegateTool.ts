import { z } from 'zod/v4'
import { getSuperAgentOrchestrator } from '../../services/superAgent/index.js'
import type { SwarmTaskResult } from '../../swarm/types.js'
import { buildTool, type ToolDef } from '../../Tool.js'
import { logForDebugging } from '../../utils/debug.js'
import { lazySchema } from '../../utils/lazySchema.js'
import { SWARM_DELEGATE_TOOL_NAME } from './constants.js'
import { DESCRIPTION, getPrompt } from './prompt.js'

const inputSchema = lazySchema(() =>
	z.strictObject({
		task: z.string().min(1).describe('The subtask to delegate to the swarm'),
		timeout_ms: z
			.number()
			.int()
			.positive()
			.optional()
			.describe('Max wall-clock milliseconds. Default 60000 (60s).'),
	}),
)
type InputSchema = ReturnType<typeof inputSchema>

const outputSchema = lazySchema(() =>
	z.object({
		task_count: z.number().int(),
		success_count: z.number().int(),
		agent_roles: z.array(z.string()),
		merged_output: z.string(),
		verification_summary: z.string().optional(),
	}),
)
type OutputSchema = ReturnType<typeof outputSchema>
export type Output = z.infer<OutputSchema>

const DEFAULT_TIMEOUT_MS = 60_000

type Rendered = {
	taskCount: number
	successCount: number
	roles: string[]
	merged: string
	summary: string
}

function renderResults(
	task: string,
	results: Map<string, SwarmTaskResult> | SwarmTaskResult[] | null,
): Rendered {
	if (!results) {
		return {
			taskCount: 0,
			successCount: 0,
			roles: [],
			merged: '',
			summary: `[Swarm] No results — swarm disabled or failed to start. Task: "${task}"`,
		}
	}
	const list = Array.isArray(results) ? results : [...results.values()]
	if (list.length === 0) {
		return {
			taskCount: 0,
			successCount: 0,
			roles: [],
			merged: '',
			summary: `[Swarm] No tasks executed. Task: "${task}"`,
		}
	}

	const blocks = list.map((r, i) => {
		const role = (r.metadata?.agentRole as string | undefined) ?? 'unknown'
		const status = r.success ? '✓ success' : '✗ failed'
		const output = r.output.length > 600 ? `${r.output.slice(0, 600)}…` : r.output
		return `### Subtask ${i + 1} — ${status}\n- Role: ${role}\n- Output:\n${output || '(empty)'}`
	})
	const successCount = list.filter((r) => r.success).length
	const roles = list.map((r) => (r.metadata?.agentRole as string | undefined) ?? 'unknown')
	const merged = list
		.map((r) => r.output)
		.filter((o) => o && !o.startsWith('ERROR:'))
		.join('\n---\n')
	const summary = `[Swarm] ${successCount}/${list.length} subtasks succeeded for task: "${task}"\n\n${blocks.join('\n\n')}`
	return { taskCount: list.length, successCount, roles, merged, summary }
}

async function renderVerification(task: string, merged: string): Promise<string | undefined> {
	if (!merged.trim()) return undefined
	try {
		const { verify: crossVerify } = await import('../../cortex/crossModelVerifier.js')
		const v = await crossVerify(task, merged, 'swarm-delegate')
		const conf = `${Math.round((v.confidence ?? 0) * 100)}%`
		const agree =
			typeof v.agreementWithPrimary === 'number' ? v.agreementWithPrimary.toFixed(2) : 'n/a'
		const contra = Array.isArray(v.contradictions) ? v.contradictions : []
		const lines = [
			'[Swarm] Verification (zero-trust):',
			`  Confidence: ${conf} | Agreement: ${agree} | Provider: ${v.provider ?? 'self'}`,
		]
		if (contra.length > 0) {
			lines.push(`  Contradictions (${contra.length}):`)
			for (const c of contra.slice(0, 5)) lines.push(`  - ${String(c).slice(0, 160)}`)
		} else {
			lines.push('  Contradictions: none detected')
		}
		return lines.join('\n')
	} catch (e) {
		const msg = e instanceof Error ? e.message : String(e)
		return `[Swarm] Verification: unverified (${msg})`
	}
}

export const SwarmDelegateTool = buildTool({
	name: SWARM_DELEGATE_TOOL_NAME,
	searchHint: 'delegate a subtask to the multi-agent swarm for parallel execution',
	maxResultSizeChars: 100_000,
	async description() {
		return DESCRIPTION
	},
	async prompt() {
		return getPrompt()
	},
	get inputSchema(): InputSchema {
		return inputSchema()
	},
	get outputSchema(): OutputSchema {
		return outputSchema()
	},
	userFacingName() {
		return 'SwarmDelegate'
	},
	isEnabled() {
		return true
	},
	isConcurrencySafe() {
		return true
	},
	isReadOnly() {
		return false
	},
	toAutoClassifierInput(input) {
		return input.task
	},
	renderToolUseMessage(input) {
		const task = input.task.length > 80 ? `${input.task.slice(0, 80)}…` : input.task
		return `Delegating to swarm: ${task}`
	},
	async call({ task, timeout_ms }, context) {
		const orchestrator = getSuperAgentOrchestrator()
		if (!orchestrator.getState().initialized) {
			await orchestrator.initialize()
		}

		const effectiveTimeout = timeout_ms ?? DEFAULT_TIMEOUT_MS
		const signal = context?.abortController?.signal
		const exec = orchestrator.executeSwarm([task])

		let results: Map<string, SwarmTaskResult> | null
		if (effectiveTimeout > 0) {
			results = await Promise.race([
				exec,
				new Promise<null>((resolve) => {
					const t = setTimeout(() => {
						logForDebugging(
							`[SwarmDelegate] timed out after ${effectiveTimeout}ms for task: ${task.slice(0, 80)}`,
						)
						resolve(null)
					}, effectiveTimeout)
					signal?.addEventListener('abort', () => {
						clearTimeout(t)
						resolve(null)
					})
				}),
			])
		} else {
			results = await exec
		}

		const rendered = renderResults(task, results)
		const verification = await renderVerification(task, rendered.merged)

		return {
			data: {
				task_count: rendered.taskCount,
				success_count: rendered.successCount,
				agent_roles: rendered.roles,
				merged_output: rendered.merged,
				verification_summary: verification,
			},
		}
	},
	mapToolResultToToolResultBlockParam(content, toolUseID) {
		const data = content as Output
		const roles = data.agent_roles.length > 0 ? `\nRoles: ${data.agent_roles.join(', ')}` : ''
		const verification = data.verification_summary ? `\n\n${data.verification_summary}` : ''
		const output = data.merged_output
		const cappedOutput = output.length > 4000 ? `${output.slice(0, 4000)}…[truncated]` : output
		return {
			tool_use_id: toolUseID,
			type: 'tool_result',
			content: `[Swarm] ${data.success_count}/${data.task_count} subtasks succeeded.${roles}\n\n--- Merged Output ---\n${cappedOutput || '(no output)'}${verification}`,
		}
	},
} satisfies ToolDef<InputSchema, Output>)
