/**
 * Olympuz Ops — Vision tool (the eyes).
 *
 * Wraps the multimodal image analyzer: analyzeImage / extractText (OCR) /
 * describeImage / compareImages. Read-only — never asks approval. Dormant under
 * vitest + when Ops is disabled/opt-out.
 */

import { z } from 'zod/v4'
import {
	analyzeImage,
	compareImages,
	describeImage,
	extractText,
} from '../../multimodal/imageAnalyzer.js'
import { isOpsActive } from '../../ops/opsEngine.js'
import { buildTool, type ToolDef } from '../../Tool.js'
import { lazySchema } from '../../utils/lazySchema.js'

export const VISION_TOOL_NAME = 'Vision'

const ACTIONS = ['analyze', 'extract', 'describe', 'compare'] as const

const DESCRIPTION =
	'Eyes for the Ops department. analyzeImage / extractText (OCR) / describeImage / compareImages against an image file path. Read-only.'

const inputSchema = lazySchema(() =>
	z.strictObject({
		action: z.enum(ACTIONS).describe('The vision action.'),
		imagePath: z.string().describe('Path to the image file to analyze.'),
		secondImagePath: z.string().optional().describe('Second image (required for compare).'),
	}),
)
type InputSchema = ReturnType<typeof inputSchema>

const outputSchema = lazySchema(() =>
	z.object({
		ok: z.boolean(),
		text: z.string(),
	}),
)
type OutputSchema = ReturnType<typeof outputSchema>
export type VisionOutput = z.infer<OutputSchema>

export const VisionTool = buildTool({
	name: VISION_TOOL_NAME,
	searchHint: 'analyze / OCR / describe / compare an image (eyes for Ops)',
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
		return 'Vision'
	},
	isEnabled() {
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
		try {
			let text: string
			switch (input.action) {
				case 'analyze': {
					const r = await analyzeImage(input.imagePath)
					text = typeof r === 'string' ? r : JSON.stringify(r)
					break
				}
				case 'extract':
					text = (await extractText(input.imagePath)).join('\n')
					break
				case 'describe':
					text = await describeImage(input.imagePath)
					break
				case 'compare':
					text = await compareImages(input.imagePath, input.secondImagePath ?? '')
					break
				default:
					text = `unknown action ${input.action}`
			}
			return { data: { ok: true, text } }
		} catch (e) {
			return {
				data: { ok: false, text: `vision failed: ${e instanceof Error ? e.message : String(e)}` },
			}
		}
	},
	mapToolResultToToolResultBlockParam(content, toolUseID) {
		const out = content as VisionOutput
		return {
			tool_use_id: toolUseID,
			type: 'tool_result',
			content: out.ok ? out.text : `Vision failed: ${out.text}`,
		}
	},
} satisfies ToolDef<InputSchema, VisionOutput>)
