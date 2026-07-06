/**
 * Olympuz Marketing — SocialPost tool.
 *
 * Publishes + deletes social posts via the marketing/social adapter (X / Meta /
 * LinkedIn / TikTok / YouTube). No-op + clear guidance when a channel's tokens
 * are absent.
 *
 * Publish gate: `post` and `short` are outward-facing → they ALWAYS ask human
 * approval (publish.approvalPolicy = 'ask-always') AND are appended to the
 * reversible published log AFTER they succeed. `delete` is the reversal path —
 * it too asks approval, performs the channel delete, then marks the original
 * published-log entry `reversed`.
 *
 * Dormant under vitest + when Marketing is disabled/killed (`isEnabled = isMarketingActive()`).
 */

import { z } from 'zod/v4'
import { type ApprovalPolicy, needsApproval } from '../../departments/approval.js'
import {
	getPublish,
	listPublishes,
	markReversed,
	recordPublish,
} from '../../departments/publishedLog.js'
import { resolveMarketingPolicy } from '../../marketing/governance.js'
import { getMarketingEngine, isMarketingActive } from '../../marketing/marketingEngine.js'
import {
	type SocialChannel,
	deletePost as socialDelete,
	post as socialPost,
	uploadShort as socialShort,
} from '../../marketing/social/socialAdapter.js'
import { buildTool, type ToolDef } from '../../Tool.js'
import type { PermissionDecision } from '../../types/permissions.js'
import { lazySchema } from '../../utils/lazySchema.js'

export const SOCIAL_POST_TOOL_NAME = 'SocialPost'

const ACTIONS = ['post', 'short', 'delete'] as const
type Action = (typeof ACTIONS)[number]

const DESCRIPTION =
	'Publish or delete a social post (X / Meta / LinkedIn / TikTok / YouTube). `post` and `short` always ask approval and are logged to the reversible published log; `delete` asks approval, removes the post, and marks the log entry reversed. Returns a not-configured result when channel tokens are absent.'

const inputSchema = lazySchema(() =>
	z.strictObject({
		action: z
			.enum(ACTIONS)
			.describe('post = text (+optional media); short = short video; delete = remove a post.'),
		channel: z
			.enum(['x', 'meta', 'linkedin', 'tiktok', 'youtube'] as const)
			.describe('Target social channel.'),
		text: z.string().optional().describe('Post caption / text (required for post/short).'),
		mediaUrl: z.string().optional().describe('Optional media URL to attach (post).'),
		videoUrl: z.string().optional().describe('Short video URL (required for short).'),
		postId: z.string().optional().describe('The channel post id (required for delete).'),
	}),
)
type InputSchema = ReturnType<typeof inputSchema>

const outputSchema = lazySchema(() =>
	z.object({
		ok: z.boolean(),
		postId: z.string().optional(),
		publishedId: z.string().optional(),
		reversed: z.boolean().optional(),
		output: z.string().optional(),
		error: z.string().optional(),
	}),
)
type OutputSchema = ReturnType<typeof outputSchema>
export type SocialPostOutput = z.infer<OutputSchema>

function policy(engine: ReturnType<typeof getMarketingEngine>): ApprovalPolicy {
	return (
		(resolveMarketingPolicy(engine.governance, 'publish', 'approvalPolicy') as
			| ApprovalPolicy
			| undefined) ?? 'ask-always'
	)
}

export const SocialPostTool = buildTool({
	name: SOCIAL_POST_TOOL_NAME,
	searchHint: 'publish or delete a social post (X / Meta / LinkedIn / TikTok / YouTube)',
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
		return 'SocialPost'
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
		// Every social action is outward-facing → ask-always under the publish gate.
		const engine = getMarketingEngine()
		const action = input.action as Action
		if (!needsApproval(policy(engine), true)) {
			return { behavior: 'allow', updatedInput: input }
		}
		const summary =
			action === 'delete'
				? `delete ${input.channel} post ${input.postId ?? '?'}`
				: `${action} on ${input.channel}: "${(input.text ?? '').slice(0, 60)}"`
		return {
			behavior: 'ask',
			updatedInput: input,
			message: `[marketing approval] ${summary} — approve before it runs.`,
		}
	},
	async call(input) {
		const channel = input.channel as SocialChannel
		const action = input.action as Action

		if (action === 'delete') {
			const res = await socialDelete(channel, input.postId ?? '')
			let reversed = false
			if (res.ok && input.postId) {
				const entry =
					listPublishes({ channel }).find(
						(e) => e.target === input.postId && e.status === 'published',
					) ?? getPublish(input.postId)
				if (entry) {
					markReversed(entry.id)
					reversed = true
				}
			}
			return {
				data: { ok: res.ok, postId: input.postId, reversed, output: res.output, error: res.error },
			}
		}

		const res =
			action === 'short'
				? await socialShort({ channel, text: input.text ?? '', videoUrl: input.videoUrl ?? '' })
				: await socialPost({ channel, text: input.text ?? '', mediaUrl: input.mediaUrl })

		let publishedId: string | undefined
		if (res.ok) {
			const entry = recordPublish({
				channel,
				action,
				target: res.postId ?? input.channel,
				content: (input.text ?? '').slice(0, 500),
				reversible: true,
				reversalHint: `Reverse with /marketing reverse <id> or SocialPost delete ${channel} ${res.postId ?? '<postId>'}.`,
			})
			publishedId = entry.id
		}
		return {
			data: {
				ok: res.ok,
				postId: res.postId,
				publishedId,
				output: res.output,
				error: res.error,
			},
		}
	},
	mapToolResultToToolResultBlockParam(content, toolUseID) {
		const out = content as SocialPostOutput
		const body = out.ok
			? out.reversed
				? `deleted + log reversed${out.postId ? ` (${out.postId})` : ''}`
				: `published${out.publishedId ? ` (logged ${out.publishedId})` : ''}`
			: `failed: ${out.error}`
		return { tool_use_id: toolUseID, type: 'tool_result', content: `SocialPost — ${body}` }
	},
} satisfies ToolDef<InputSchema, SocialPostOutput>)
