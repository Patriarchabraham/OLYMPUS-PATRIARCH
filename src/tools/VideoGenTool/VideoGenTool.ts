/**
 * Olympuz Marketing — VideoGen tool.
 *
 * Generates video / shorts via the marketing/video adapter (Veo 3 / Sora 2 /
 * Runway Gen-5 / Kling 3). No-op + clear guidance when no provider is configured.
 * Generation is internal creative production — NOT outward-facing — so it does
 * NOT route through the publish approval gate (publishing happens later via
 * SocialPost, which is gated). Confines providers to env-configured keys.
 *
 * Dormant under vitest + when Marketing is disabled/killed (`isEnabled = isMarketingActive()`).
 */

import { z } from 'zod/v4'
import { isMarketingActive } from '../../marketing/marketingEngine.js'
import { generateVideo, type VideoProvider } from '../../marketing/video/videoAdapter.js'
import { buildTool, type ToolDef } from '../../Tool.js'
import { lazySchema } from '../../utils/lazySchema.js'

export const VIDEO_GEN_TOOL_NAME = 'VideoGen'

const DESCRIPTION =
	'Generate a marketing video / short (Veo 3 / Sora 2 / Runway Gen-5 / Kling 3). Returns a not-configured result when no provider API key + endpoint are set. Generation is internal creative production; publishing to a channel is a separate, approval-gated step (SocialPost).'

const inputSchema = lazySchema(() =>
	z.strictObject({
		prompt: z.string().min(1).describe('The video script / prompt (hook < 1s, payoff, CTA).'),
		image: z
			.string()
			.optional()
			.describe('Optional base64 start-frame / reference image (provider-dependent).'),
		duration: z.number().int().min(1).max(60).optional().describe('Desired duration in seconds.'),
		provider: z
			.enum(['veo', 'sora', 'runway', 'kling'] as const)
			.optional()
			.describe('Force a specific provider; otherwise the first configured one is selected.'),
	}),
)
type InputSchema = ReturnType<typeof inputSchema>

const outputSchema = lazySchema(() =>
	z.object({
		ok: z.boolean(),
		output: z.string().optional(),
		provider: z.string().optional(),
		error: z.string().optional(),
	}),
)
type OutputSchema = ReturnType<typeof outputSchema>
export type VideoGenOutput = z.infer<OutputSchema>

export const VideoGenTool = buildTool({
	name: VIDEO_GEN_TOOL_NAME,
	searchHint: 'generate a marketing video or short (Veo / Sora / Runway / Kling)',
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
		return 'VideoGen'
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
	async call(input) {
		const res = await generateVideo({
			prompt: input.prompt,
			image: input.image,
			duration: input.duration,
			provider: input.provider as VideoProvider | undefined,
		})
		return { data: res }
	},
	mapToolResultToToolResultBlockParam(content, toolUseID) {
		const out = content as VideoGenOutput
		const body = out.ok
			? `generated via ${out.provider ?? '?'}: ${out.output ?? 'ok'}`
			: `failed: ${out.error}`
		return { tool_use_id: toolUseID, type: 'tool_result', content: `VideoGen — ${body}` }
	},
} satisfies ToolDef<InputSchema, VideoGenOutput>)
