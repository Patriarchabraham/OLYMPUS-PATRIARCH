/**
 * Olympuz Marketing — MarketingBuild tool.
 *
 * Lets the model (or a user via /marketing run) trigger the department for a
 * brief: detects intent, builds the campaign delegation plan (which specialist
 * agents run, in what order), and returns the delegation instructions +
 * governance summary. The MODEL then executes the plan via the existing
 * Agent/swarm runtime — Marketing does not re-implement spawning. Publishing is
 * gated at the Email/SocialPost tools (ask-always + published log), not here
 * (this tool only plans → read-only).
 *
 * Dormant under vitest and when Marketing is disabled/killed
 * (`isEnabled = isMarketingActive()`), so tool-list snapshots stay stable.
 */

import { z } from 'zod/v4'
import { formatCampaignPlanForDelegation } from '../../marketing/department.js'
import { marketingGovernanceNotes } from '../../marketing/governance.js'
import { getMarketingEngine, isMarketingActive } from '../../marketing/marketingEngine.js'
import { MARKETING_PRD_VERSION } from '../../marketing/principles.js'
import { buildTool, type ToolDef } from '../../Tool.js'
import { lazySchema } from '../../utils/lazySchema.js'

export const MARKETING_BUILD_TOOL_NAME = 'MarketingBuild'

const DESCRIPTION = [
	'Activate the Olympuz Marketing & Growth Department for a brief.',
	'Returns the detected campaign kind (campaign/social/email/video/content/profile), the campaign delegation plan',
	'(which marketing-* specialist agents run, in what order), and the active governance (publish approval policy,',
	'channel allowlist, voice). You (the main agent) then execute the plan via the Agent tool. Use when the user',
	'wants to plan or run a marketing campaign, generate creative/copy, publish to social, or send email.',
	'EVERY publish/send/post asks approval before it goes out and is logged.',
].join(' ')

const inputSchema = lazySchema(() =>
	z.strictObject({
		brief: z
			.string()
			.min(1)
			.describe(
				'The marketing brief in natural language (e.g. "launch a campaign for Olympuz Coder on X and LinkedIn").',
			),
	}),
)
type InputSchema = ReturnType<typeof inputSchema>

const outputSchema = lazySchema(() =>
	z.object({
		intent: z.object({
			isMarketingRequest: z.boolean(),
			kind: z.string(),
			confidence: z.number(),
			triggers: z.array(z.string()),
		}),
		delegationInstructions: z.string(),
		governanceNotes: z.array(z.string()),
		principlesRef: z.string(),
	}),
)
type OutputSchema = ReturnType<typeof outputSchema>
export type MarketingBuildOutput = z.infer<OutputSchema>

export const MarketingBuildTool = buildTool({
	name: MARKETING_BUILD_TOOL_NAME,
	searchHint:
		'activate the Marketing department to plan or run a campaign, creative, social, or email',
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
		return 'MarketingBuild'
	},
	isEnabled() {
		// Dormant in tests + when Marketing is disabled/killed — keeps tool-list snapshots stable.
		return isMarketingActive()
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
		const engine = getMarketingEngine()
		const intent = engine.detectIntent(input.brief)
		const plan = engine.planCampaign(intent)
		const notes = marketingGovernanceNotes(engine.governance)

		const output: MarketingBuildOutput = {
			intent: {
				isMarketingRequest: intent.isMarketingRequest,
				kind: intent.kind,
				confidence: intent.confidence,
				triggers: intent.triggers,
			},
			delegationInstructions: formatCampaignPlanForDelegation(plan),
			governanceNotes: notes,
			principlesRef: `Olympuz Marketing PRD v${MARKETING_PRD_VERSION}`,
		}
		return { data: output }
	},
	mapToolResultToToolResultBlockParam(content, toolUseID) {
		const out = content as MarketingBuildOutput
		const lines = [
			`Marketing Department — kind=${out.intent.kind} (confidence ${out.intent.confidence.toFixed(2)})`,
			`Intent: marketing=${out.intent.isMarketingRequest} triggers=${out.intent.triggers.join(',') || '(none)'}`,
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
} satisfies ToolDef<InputSchema, MarketingBuildOutput>)
