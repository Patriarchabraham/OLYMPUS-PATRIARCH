/**
 * Olympuz Ops — Listen tool (the ears).
 *
 * Wraps multimodal voiceInterface.startListening() — an async generator that
 * captures from the microphone and yields transcribed text (STT). When no STT
 * provider is configured it yields a clear "configure a provider" guidance
 * string instead of throwing (no-op-when-unconfigured). Read-only. Dormant
 * under vitest + when Ops is disabled/opt-out.
 */

import { z } from 'zod/v4'
import { startListening } from '../../multimodal/voiceInterface.js'
import { isOpsActive } from '../../ops/opsEngine.js'
import { buildTool, type ToolDef } from '../../Tool.js'
import { lazySchema } from '../../utils/lazySchema.js'

export const LISTEN_TOOL_NAME = 'Listen'

const DESCRIPTION =
	'Ears for the Ops department. Captures speech from the microphone and returns a transcription (STT). Returns guidance when no STT provider is configured. Read-only.'

const inputSchema = lazySchema(() =>
	z.strictObject({
		maxPhrases: z
			.number()
			.int()
			.min(1)
			.max(20)
			.optional()
			.describe('Max transcription phrases to collect (default 1).'),
	}),
)
type InputSchema = ReturnType<typeof inputSchema>

const outputSchema = lazySchema(() =>
	z.object({
		ok: z.boolean(),
		transcript: z.string(),
	}),
)
type OutputSchema = ReturnType<typeof outputSchema>
export type ListenOutput = z.infer<OutputSchema>

export const ListenTool = buildTool({
	name: LISTEN_TOOL_NAME,
	searchHint: 'capture + transcribe speech from the microphone (ears for Ops)',
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
		return 'Listen'
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
		const limit = input.maxPhrases ?? 1
		const phrases: string[] = []
		try {
			for await (const phrase of startListening({} as never)) {
				phrases.push(phrase)
				if (phrases.length >= limit) break
			}
			return { data: { ok: true, transcript: phrases.join(' ') } }
		} catch (e) {
			return {
				data: {
					ok: false,
					transcript: `listen failed: ${e instanceof Error ? e.message : String(e)}`,
				},
			}
		}
	},
	mapToolResultToToolResultBlockParam(content, toolUseID) {
		const out = content as ListenOutput
		return {
			tool_use_id: toolUseID,
			type: 'tool_result',
			content: out.ok ? `Heard: ${out.transcript}` : out.transcript,
		}
	},
} satisfies ToolDef<InputSchema, ListenOutput>)
