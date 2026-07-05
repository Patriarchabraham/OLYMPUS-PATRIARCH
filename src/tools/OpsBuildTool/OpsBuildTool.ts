/**
 * Olympuz Ops — OpsBuild tool.
 *
 * Lets the model (or a user via /ops run) trigger the department for a task:
 * detects intent, builds the ops delegation plan (which specialist agents run,
 * in what order), and returns the delegation instructions + governance summary.
 * The MODEL then executes the plan via the existing Agent/swarm runtime — Ops
 * does not re-implement spawning. Destructive actions are gated at the operator
 * tools, not here (this tool only plans → read-only).
 *
 * Dormant under vitest and when Ops is disabled (`isEnabled = isOpsActive()`),
 * so tool-list snapshots stay byte-for-byte stable.
 */

import { z } from 'zod/v4'
import { formatOpsPlanForDelegation } from '../../ops/department.js'
import { opsGovernanceNotes } from '../../ops/governance.js'
import { getOpsEngine, isOpsActive } from '../../ops/opsEngine.js'
import { OPS_PRD_VERSION } from '../../ops/principles.js'
import { buildTool, type ToolDef } from '../../Tool.js'
import { lazySchema } from '../../utils/lazySchema.js'

export const OPS_BUILD_TOOL_NAME = 'OpsBuild'

const DESCRIPTION = [
	'Activate the Olympuz Agentic Operations Department for a task.',
	'Returns the detected control surface (computer/browser/vision/voice/automation), the department delegation plan',
	'(which ops-* specialist agents run, in what order), and the active governance (approval policy, browser scope, limits).',
	'You (the main agent) then execute the plan via the Agent tool. Use when the user wants to control Windows or a browser,',
	'automate a PC task, see/hear/speak, or run an autonomous agent team. Opt-in only; destructive steps ask approval.',
].join(' ')

const inputSchema = lazySchema(() =>
	z.strictObject({
		task: z
			.string()
			.min(1)
			.describe(
				'The ops task in natural language (e.g. "open the browser and find the cheapest flight to Lisbon").',
			),
	}),
)
type InputSchema = ReturnType<typeof inputSchema>

const outputSchema = lazySchema(() =>
	z.object({
		intent: z.object({
			isOpsRequest: z.boolean(),
			surface: z.string(),
			confidence: z.number(),
			triggers: z.array(z.string()),
		}),
		delegationInstructions: z.string(),
		governanceNotes: z.array(z.string()),
		principlesRef: z.string(),
	}),
)
type OutputSchema = ReturnType<typeof outputSchema>
export type OpsBuildOutput = z.infer<OutputSchema>

export const OpsBuildTool = buildTool({
	name: OPS_BUILD_TOOL_NAME,
	searchHint: 'activate the Ops department to control Windows/a browser or run an autonomous task',
	maxResultSizeChars: 100_000,
	async description() {
		return DESCRIPTION
	},
	async prompt() {
		return DESCRIPTION
	},
	get inputSchema(): InputSchema {
		return inputSchema()
	},
	get outputSchema(): OutputSchema {
		return outputSchema()
	},
	userFacingName() {
		return 'OpsBuild'
	},
	isEnabled() {
		// Dormant in tests + when Ops is disabled/opt-out — keeps tool-list snapshots stable.
		return isOpsActive()
	},
	isConcurrencySafe() {
		return true
	},
	isReadOnly() {
		return true
	},
	renderToolUseMessage() {
		return null
	},
	async call(input) {
		const engine = getOpsEngine()
		const intent = engine.detectIntent(input.task)
		const plan = engine.planOps(intent)
		const notes = opsGovernanceNotes(engine.governance)

		const output: OpsBuildOutput = {
			intent: {
				isOpsRequest: intent.isOpsRequest,
				surface: intent.surface,
				confidence: intent.confidence,
				triggers: intent.triggers,
			},
			delegationInstructions: formatOpsPlanForDelegation(plan),
			governanceNotes: notes,
			principlesRef: `Olympuz Ops PRD v${OPS_PRD_VERSION}`,
		}
		return { data: output }
	},
	mapToolResultToToolResultBlockParam(content, toolUseID) {
		const out = content as OpsBuildOutput
		const lines = [
			`Ops Department — surface=${out.intent.surface} (confidence ${out.intent.confidence.toFixed(2)})`,
			`Intent: ops=${out.intent.isOpsRequest} triggers=${out.intent.triggers.join(',') || '(none)'}`,
			`Principles: ${out.principlesRef}`,
			out.governanceNotes.length
				? `Governance:\n${out.governanceNotes.map((n) => `  - ${n}`).join('\n')}`
				: 'Governance: (defaults)',
			'',
			out.delegationInstructions,
		]
		return {
			tool_use_id: toolUseID,
			type: 'tool_result',
			content: lines.join('\n'),
		}
	},
} satisfies ToolDef<InputSchema, OpsBuildOutput>)
