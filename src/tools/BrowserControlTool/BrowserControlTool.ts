/**
 * Olympuz Ops — BrowserControl tool.
 *
 * Drives a browser via the ops/browser Playwright adapter (goto/click/fill/
 * screenshot/evaluate/submit). No-op + clear guidance when Playwright isn't
 * installed. Destructive actions (click/fill/submit/evaluate — anything that
 * changes page state or runs JS) route through the human approval gate via
 * `checkPermissions`; read-only navigation + screenshot do not.
 *
 * Dormant under vitest + when Ops is disabled/opt-out (`isEnabled = isOpsActive()`).
 */

import { z } from 'zod/v4'
import { type ApprovalPolicy, needsApproval } from '../../departments/approval.js'
import {
	click as browserClick,
	evaluate as browserEvaluate,
	fill as browserFill,
	goto as browserGoto,
	screenshotPage as browserScreenshot,
	submit as browserSubmit,
} from '../../ops/browser/browserAdapter.js'
import { resolveOpsPolicy } from '../../ops/governance.js'
import { getOpsEngine, isOpsActive } from '../../ops/opsEngine.js'
import { buildTool, type ToolDef } from '../../Tool.js'
import type { PermissionDecision } from '../../types/permissions.js'
import { lazySchema } from '../../utils/lazySchema.js'

export const BROWSER_CONTROL_TOOL_NAME = 'BrowserControl'

const ACTIONS = ['goto', 'click', 'fill', 'screenshot', 'submit', 'evaluate'] as const
type Action = (typeof ACTIONS)[number]
/** Actions that change page state or execute JS → need human approval. */
const DESTRUCTIVE: ReadonlySet<Action> = new Set(['click', 'fill', 'submit', 'evaluate'])

const DESCRIPTION =
	'Control a browser via Playwright (goto/click/fill/screenshot/submit/evaluate). Destructive actions ask approval; read-only navigation + screenshot do not. Confines to the governance browser.scope allowlist.'

const inputSchema = lazySchema(() =>
	z.strictObject({
		action: z.enum(ACTIONS).describe('The browser action to perform.'),
		url: z.string().describe('The page URL the action targets.'),
		selector: z.string().optional().describe('CSS selector (required for click/fill/submit).'),
		value: z.string().optional().describe('Text to type (required for fill).'),
		expression: z
			.string()
			.optional()
			.describe('JS expression to evaluate (required for evaluate).'),
	}),
)
type InputSchema = ReturnType<typeof inputSchema>

const outputSchema = lazySchema(() =>
	z.object({
		ok: z.boolean(),
		output: z.string().optional(),
		imageBase64: z.string().optional(),
		error: z.string().optional(),
	}),
)
type OutputSchema = ReturnType<typeof outputSchema>
export type BrowserControlOutput = z.infer<OutputSchema>

function summaryFor(input: { action: Action; url: string; selector?: string }): string {
	switch (input.action) {
		case 'click':
			return `browser click ${input.selector ?? '?'} on ${input.url}`
		case 'fill':
			return `browser fill ${input.selector ?? '?'} on ${input.url}`
		case 'submit':
			return `browser submit ${input.selector ?? '?'} on ${input.url}`
		case 'evaluate':
			return `browser run JS on ${input.url}`
		default:
			return `browser ${input.action} ${input.url}`
	}
}

export const BrowserControlTool = buildTool({
	name: BROWSER_CONTROL_TOOL_NAME,
	searchHint: 'control a browser page (click/fill/submit/screenshot) via Playwright',
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
		return 'BrowserControl'
	},
	isEnabled() {
		return isOpsActive()
	},
	isConcurrencySafe() {
		return false
	},
	isReadOnly() {
		return false
	},
	renderToolUseMessage() {
		return null
	},
	async checkPermissions(input, _context): Promise<PermissionDecision> {
		const engine = getOpsEngine()
		const policy =
			(resolveOpsPolicy(engine.governance, 'browser', 'approvalPolicy') as
				| ApprovalPolicy
				| undefined) ?? 'ask-destructive'
		const action = input.action as Action
		const destructive = DESTRUCTIVE.has(action)
		if (!needsApproval(policy, destructive)) {
			return { behavior: 'allow', updatedInput: input }
		}
		return {
			behavior: 'ask',
			updatedInput: input,
			message: `[ops approval] ${summaryFor({ action, url: input.url, selector: input.selector })} — approve before it runs.`,
		}
	},
	async call(input) {
		const { action, url, selector, value, expression } = input
		let res: { ok: boolean; output?: string; imageBase64?: string; error?: string }
		switch (action) {
			case 'goto':
				res = await browserGoto(url)
				break
			case 'click':
				res = await browserClick(url, selector ?? '')
				break
			case 'fill':
				res = await browserFill(url, selector ?? '', value ?? '')
				break
			case 'screenshot':
				res = await browserScreenshot(url)
				break
			case 'submit':
				res = await browserSubmit(url, selector ?? '')
				break
			case 'evaluate':
				res = await browserEvaluate(url, expression ?? '')
				break
			default:
				res = { ok: false, error: `unknown action ${action}` }
		}
		return { data: res }
	},
	mapToolResultToToolResultBlockParam(content, toolUseID) {
		const out = content as BrowserControlOutput
		const body = out.ok
			? out.imageBase64
				? `screenshot captured (${out.imageBase64.length} bytes base64)`
				: (out.output ?? 'ok')
			: `failed: ${out.error}`
		return {
			tool_use_id: toolUseID,
			type: 'tool_result',
			content: `BrowserControl — ${body}`,
		}
	},
} satisfies ToolDef<InputSchema, BrowserControlOutput>)
