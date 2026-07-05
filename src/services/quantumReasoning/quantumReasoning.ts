/**
 * Quantum Reasoning — turn-end advisory + carry-forward loop.
 *
 * Runs the multi-dimensional quantum pipeline (`QuantumEngine`) over the turn's
 * driving query, in the background, after non-trivial file changes. It is an
 * *advisory* layer: fire-and-forget from the stop-hook, non-blocking.
 *
 * Closing the loop: each non-degraded analysis is recorded into a process-memory
 * carry-forward window (`quantumLoopStore`). The window is what makes quantum
 * reasoning accumulate across turns — without it, a flagged blind spot vanished
 * after a single turn and a confirmed direction was never carried forward. The
 * surfaced system message is the window's OPEN blind spots (this turn's if it's
 * low-confidence, plus unresolved ones from prior turns), so the agent re-sees
 * pending questions until they age out. High-confidence turns with a clean
 * window stay silent — "speak only when there's something to say".
 *
 * Design mirrors `src/services/adversarialVerification/adversarialVerification.ts`:
 *  - Closure-scoped `runner` set by `initQuantumReasoning()` (enables dead-code
 *    elimination in external builds and clean test isolation).
 *  - Fire-and-forget from `handleStopHooks` (see `src/query/stopHooks.ts`).
 *  - "Speak only when there's something to say": silent when no LLM is available
 *    or when there are no open blind spots to carry forward.
 *
 * Gating (cheapest first): bare mode → env kill-switch → remote mode →
 * main-thread only → non-trivial change threshold. The change scan is a compact
 * self-contained variant of the adversarial gate's detection (it intentionally
 * only needs counts, not contents/diff, so the two may diverge over time).
 */

import type {
	BetaContentBlock,
	BetaToolUseBlock,
} from '@anthropic-ai/sdk/resources/beta/messages/messages.js'

import { getIsRemoteMode } from '../../bootstrap/state.js'
import { QuantumEngine } from '../../quantum/quantumEngine.js'
import { getOpenBlindSpotsContext, recordCollapse } from '../../quantum/quantumLoopStore.js'
import type { QuantumAnalysis } from '../../quantum/types.js'
import type { ToolUseContext } from '../../Tool.js'
import { FILE_EDIT_TOOL_NAME } from '../../tools/FileEditTool/constants.js'
import { FILE_WRITE_TOOL_NAME } from '../../tools/FileWriteTool/prompt.js'
import type { AssistantMessage, Message } from '../../types/message.js'
import { logForDebugging } from '../../utils/debug.js'
import { isBareMode, isEnvDefinedFalsy } from '../../utils/envUtils.js'
import type { REPLHookContext } from '../../utils/hooks/postSamplingHooks.js'
import { createSystemMessage } from '../../utils/messages.js'

type AppendSystemMessageFn = NonNullable<ToolUseContext['appendSystemMessage']>

/** Env kill-switch (default ENABLED). Falsy value disables the service. */
const QUANTUM_ENV = 'CLAUDE_CODE_ENABLE_QUANTUM'

/** Default thresholds for a "non-trivial" turn (mirror the adversarial gate). */
const THRESHOLD_FILES = 3
const THRESHOLD_LINES = 50

let runner:
	| ((context: REPLHookContext, appendSystemMessage?: AppendSystemMessageFn) => Promise<void>)
	| null = null

/**
 * Initialize the quantum reasoning runner. Must be called once at startup
 * (alongside `initAdversarialVerification`, in
 * `src/utils/backgroundHousekeeping.ts`); until then `executeQuantumReasoning`
 * is a no-op.
 */
export function initQuantumReasoning(): void {
	runner = async function runQuantumReasoning(context, appendSystemMessage) {
		// Cheapest gates first.
		if (isBareMode()) return
		if (isEnvDefinedFalsy(process.env[QUANTUM_ENV])) return
		if (getIsRemoteMode()) return
		// Main thread only — subagents don't run quantum reasoning.
		if (context.toolUseContext.agentId) return
		if (context.querySource !== 'repl_main_thread') return

		// Only on non-trivial turns (same Edit/Write detection shape as the gate).
		const changes = countTurnChanges(context.messages)
		if (changes.changedFiles === 0) return
		const meetsThreshold =
			changes.changedFiles > THRESHOLD_FILES || changes.lineCount > THRESHOLD_LINES
		if (!meetsThreshold) return

		const originalQuery = extractLastUserQuery(context.messages)

		logForDebugging(
			`[quantumReasoning] starting — ${changes.changedFiles} files, ${changes.lineCount} lines`,
		)

		const { createGenerateFn } = await import('../../reasoning/generateFnFactory.js')
		const generateFn = await createGenerateFn()
		if (!generateFn) return // No LLM available → silent no-op (do not fabricate).

		const engine = new QuantumEngine()
		engine.setGenerateFn(generateFn)

		let analysis: QuantumAnalysis
		try {
			analysis = await engine.process(originalQuery)
		} catch (err) {
			// Advisory and must never break the agent's stop flow.
			logForDebugging(`[quantumReasoning] process threw: ${(err as Error).message}`)
			return
		}

		// Speak only when there's something to say.
		if (analysis.degraded || analysis.states.length === 0) return
		if (!appendSystemMessage) return

		// Close the loop: record this turn's analysis into the carry-forward
		// window so it isn't computed-then-discarded. Prior turns' blind spots
		// would otherwise vanish after one turn; the window keeps them visible
		// until they age out (TTL) or the window rolls over.
		recordCollapse(analysis)

		// Carry forward any OPEN blind spots — this turn's if it's low-confidence,
		// plus unresolved ones from prior turns. High-confidence turns with a clean
		// window stay silent (preserves "speak only when there's something to say"):
		// the only reason to speak on a high-conf turn is that an earlier turn left a
		// flagged blind spot still pending.
		const carry = getOpenBlindSpotsContext()
		if (!carry) return

		appendSystemMessage(createSystemMessage(carry, 'info'))
	}
}

/**
 * Entry point from `handleStopHooks`. Fire-and-forget there. No-op until
 * `initQuantumReasoning()` has been called.
 *
 * @param context - The stop-hook context (turn messages + tool-use context).
 * @param appendSystemMessage - Optional sink for the advisory system message.
 */
export async function executeQuantumReasoning(
	context: REPLHookContext,
	appendSystemMessage?: AppendSystemMessageFn,
): Promise<void> {
	await runner?.(context, appendSystemMessage)
}

/**
 * Count distinct files touched by Edit/Write tool_use blocks this turn and the
 * approximate changed-line count. Compact variant of the adversarial gate's
 * `extractChangeMetadata` — it only needs the counts for the threshold check.
 */
function countTurnChanges(messages: Message[]): { changedFiles: number; lineCount: number } {
	const seen = new Set<string>()
	let lineCount = 0

	for (const message of messages) {
		if (message.type !== 'assistant') continue
		const content = (message as AssistantMessage).message.content
		if (!Array.isArray(content)) continue

		for (const block of content as BetaContentBlock[]) {
			if (block.type !== 'tool_use') continue
			const toolUse = block as BetaToolUseBlock
			const input = (toolUse.input ?? {}) as Record<string, unknown>

			const isEdit = toolUse.name === FILE_EDIT_TOOL_NAME
			const isWrite = toolUse.name === FILE_WRITE_TOOL_NAME
			if (!isEdit && !isWrite) continue

			const filePath = typeof input.file_path === 'string' ? input.file_path : ''
			if (filePath) seen.add(filePath)

			if (isEdit) {
				lineCount += lineCountOf(input.old_string) + lineCountOf(input.new_string)
			} else {
				lineCount += lineCountOf(input.content)
			}
		}
	}

	return { changedFiles: seen.size, lineCount }
}

/** Count lines in a value (0 for non-strings). */
function lineCountOf(value: unknown): number {
	return typeof value === 'string' ? value.split('\n').length : 0
}

/** Extract the last user message text from the turn (the driving query). */
function extractLastUserQuery(messages: Message[]): string {
	for (let i = messages.length - 1; i >= 0; i--) {
		const message = messages[i]
		if (message?.type !== 'user') continue
		const content = (message as { message?: { content?: string | unknown[] } }).message?.content
		if (typeof content === 'string') return content
		if (Array.isArray(content)) {
			const text = content
				.map((block) =>
					block != null && typeof block === 'object' && 'text' in block
						? String((block as { text: unknown }).text)
						: '',
				)
				.join('\n')
				.trim()
			if (text) return text
		}
	}
	return '(no user query)'
}

// Carry-forward rendering lives in `quantumLoopStore.getOpenBlindSpotsContext`.
