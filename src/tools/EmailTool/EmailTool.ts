/**
 * Olympuz Marketing — Email tool.
 *
 * Sends + reads email via the marketing/email adapter (nodemailer SMTP +
 * imapflow IMAP). No-op + clear guidance when SMTP/IMAP credentials are absent.
 *
 * Publish gate: `send` is an outward-facing, hard-to-reverse action → it ALWAYS
 * asks human approval (publish.approvalPolicy = 'ask-always') AND is appended to
 * the reversible published log AFTER it succeeds. `inbox` (read) is read-only and
 * does not ask.
 *
 * Dormant under vitest + when Marketing is disabled/killed (`isEnabled = isMarketingActive()`).
 */

import { z } from 'zod/v4'
import { type ApprovalPolicy, needsApproval } from '../../departments/approval.js'
import { recordPublish } from '../../departments/publishedLog.js'
import {
	isEmailAvailable,
	isInboxAvailable,
	listInbox,
	sendMail,
} from '../../marketing/email/emailAdapter.js'
import { resolveMarketingPolicy } from '../../marketing/governance.js'
import { getMarketingEngine, isMarketingActive } from '../../marketing/marketingEngine.js'
import { buildTool, type ToolDef } from '../../Tool.js'
import type { PermissionDecision } from '../../types/permissions.js'
import { lazySchema } from '../../utils/lazySchema.js'

export const EMAIL_TOOL_NAME = 'Email'

const ACTIONS = ['send', 'inbox'] as const
type Action = (typeof ACTIONS)[number]
/** Outward-facing actions → approval + published log. */
const PUBLISH: ReadonlySet<Action> = new Set(['send'])

const DESCRIPTION =
	'Send or read email (nodemailer SMTP / imapflow IMAP). `send` always asks approval and is logged to the reversible published log; `inbox` (read) does not. Returns a not-configured result when SMTP/IMAP credentials are absent.'

const inputSchema = lazySchema(() =>
	z.strictObject({
		action: z.enum(ACTIONS).describe('send = transmit a message; inbox = list recent messages.'),
		to: z.string().optional().describe('Recipient address (required for send).'),
		subject: z.string().optional().describe('Subject line (required for send).'),
		body: z.string().optional().describe('Plain-text body (required for send).'),
		limit: z.number().int().min(1).max(50).optional().describe('Max inbox messages to list.'),
	}),
)
type InputSchema = ReturnType<typeof inputSchema>

const outputSchema = lazySchema(() =>
	z.object({
		ok: z.boolean(),
		output: z.string().optional(),
		messages: z
			.array(
				z.object({
					id: z.string(),
					from: z.string().optional(),
					subject: z.string().optional(),
					date: z.string().optional(),
				}),
			)
			.optional(),
		publishedId: z.string().optional(),
		error: z.string().optional(),
	}),
)
type OutputSchema = ReturnType<typeof outputSchema>
export type EmailOutput = z.infer<OutputSchema>

function policy(engine: ReturnType<typeof getMarketingEngine>): ApprovalPolicy {
	return (
		(resolveMarketingPolicy(engine.governance, 'publish', 'approvalPolicy') as
			| ApprovalPolicy
			| undefined) ?? 'ask-always'
	)
}

export const EmailTool = buildTool({
	name: EMAIL_TOOL_NAME,
	searchHint: 'send or read marketing email (SMTP/IMAP)',
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
		return 'Email'
	},
	isEnabled() {
		return isMarketingActive()
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
		const action = input.action as Action
		// Read actions (inbox) never ask — the publish gate governs only outward sends.
		if (!PUBLISH.has(action)) {
			return { behavior: 'allow', updatedInput: input }
		}
		const engine = getMarketingEngine()
		if (!needsApproval(policy(engine), true)) {
			return { behavior: 'allow', updatedInput: input }
		}
		return {
			behavior: 'ask',
			updatedInput: input,
			message: `[marketing approval] email send to ${input.to ?? '?'} — "${input.subject ?? ''}" — approve before it sends.`,
		}
	},
	async call(input) {
		const action = input.action as Action
		if (action === 'inbox') {
			if (!isInboxAvailable()) {
				return {
					data: {
						ok: false,
						error:
							'Inbox read is not configured. Set IMAP_HOST, IMAP_USER, IMAP_PASS (and optionally IMAP_PORT) to enable.',
					},
				}
			}
			const res = await listInbox(input.limit ?? 10)
			return { data: res }
		}
		// send
		if (!isEmailAvailable()) {
			return {
				data: {
					ok: false,
					error:
						'Email send is not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS (and optionally SMTP_PORT, SMTP_FROM) to enable.',
				},
			}
		}
		const res = await sendMail({
			to: input.to ?? '',
			subject: input.subject ?? '',
			body: input.body ?? '',
		})
		let publishedId: string | undefined
		if (res.ok) {
			const entry = recordPublish({
				channel: 'email',
				action: 'email',
				target: input.to,
				content: `${input.subject ?? ''}\n\n${input.body ?? ''}`.slice(0, 500),
				reversible: false,
				reversalHint:
					'Email sends are generally not reversible. Send a correction / follow-up if needed.',
			})
			publishedId = entry.id
		}
		return { data: { ok: res.ok, output: res.output, publishedId, error: res.error } }
	},
	mapToolResultToToolResultBlockParam(content, toolUseID) {
		const out = content as EmailOutput
		const body = out.ok
			? out.messages
				? `inbox: ${out.messages.length} message(s)`
				: `sent${out.publishedId ? ` (logged ${out.publishedId})` : ''}`
			: `failed: ${out.error}`
		return { tool_use_id: toolUseID, type: 'tool_result', content: `Email — ${body}` }
	},
} satisfies ToolDef<InputSchema, EmailOutput>)
