/**
 * Olympuz Ops — Speak tool (the voice).
 *
 * Wraps multimodal voiceInterface.speak() — Windows SAPI / macOS say / Linux
 * espeak / configured provider. Read-only (outward audio). Dormant under vitest
 * + when Ops is disabled/opt-out.
 */

import { z } from 'zod/v4'
import { speak } from '../../multimodal/voiceInterface.js'
import { isOpsActive } from '../../ops/opsEngine.js'
import { buildTool, type ToolDef } from '../../Tool.js'
import { lazySchema } from '../../utils/lazySchema.js'

export const SPEAK_TOOL_NAME = 'Speak'

const DESCRIPTION =
	'Voice for the Ops department. speak() the given text via TTS (Windows SAPI / say / espeak / provider). Read-only.'

const inputSchema = lazySchema(() =>
	z.strictObject({
		text: z.string().min(1).describe('The text to speak aloud.'),
		language: z.string().optional().describe('Optional BCP-47 language hint (e.g. en-US, pt-BR).'),
	}),
)
type InputSchema = ReturnType<typeof inputSchema>

const outputSchema = lazySchema(() =>
	z.object({
		ok: z.boolean(),
		spoken: z.string(),
	}),
)
type OutputSchema = ReturnType<typeof outputSchema>
export type SpeakOutput = z.infer<OutputSchema>

export const SpeakTool = buildTool({
	name: SPEAK_TOOL_NAME,
	searchHint: 'speak text aloud via TTS (voice for Ops)',
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
		return 'Speak'
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
			await speak(input.text, input.language ? { language: input.language as never } : undefined)
			return { data: { ok: true, spoken: input.text } }
		} catch (e) {
			return {
				data: { ok: false, spoken: `speak failed: ${e instanceof Error ? e.message : String(e)}` },
			}
		}
	},
	mapToolResultToToolResultBlockParam(content, toolUseID) {
		const out = content as SpeakOutput
		return {
			tool_use_id: toolUseID,
			type: 'tool_result',
			content: out.ok ? `Spoke: ${out.spoken}` : out.spoken,
		}
	},
} satisfies ToolDef<InputSchema, SpeakOutput>)
