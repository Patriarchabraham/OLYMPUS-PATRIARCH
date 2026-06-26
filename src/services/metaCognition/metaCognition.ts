/**
 * Meta-Cognition — turn-end advisory service (the intelligent orchestrator).
 *
 * Runs the closed-loop meta-cognition pipeline (`cognize()`) over the turn's
 * driving query, in the background, after non-trivial file changes. `cognize()`
 * IS the orchestrator: it auto-incorporates cortex meta-analysis, reasoning with
 * depth escalation (cot→tot→reflect→ensemble), convergence on blind spots, and
 * cross-model verification — activating each stage on demand by intent and
 * confidence. So this single advisory brings cortex + reason + verification onto
 * the default path, intelligently — no manual opt-in, no blanket fan-out.
 *
 * It is an *advisory* layer: fire-and-forget from the stop-hook, non-blocking,
 * and surfaces a system message only when the measured confidence is low or
 * cortex/the meta-reasoner flagged blind spots — silent otherwise.
 *
 * Design mirrors `src/services/quantumReasoning/quantumReasoning.ts`:
 *  - Closure-scoped `runner` set by `initMetaCognition()` (enables dead-code
 *    elimination in external builds and clean test isolation).
 *  - Fire-and-forget from `handleStopHooks` (see `src/query/stopHooks.ts`).
 *  - "Speak only when there's something to say": silent on success / when no LLM
 *    is available; chatty only on low-confidence turns or surfaced blind spots.
 *
 * Gating (cheapest first): bare mode → env kill-switch → remote mode →
 * main-thread only → non-trivial change threshold. The change scan is a compact
 * self-contained variant of the adversarial gate's detection (it intentionally
 * only needs counts, not contents/diff, so the variants may diverge over time).
 *
 * Relationship to the existing pre-query reasoning (`src/query.ts`): that fires
 * a lightweight reason pass *before* the query to prime the model and is part of
 * the response. This advisory runs *after* a non-trivial turn as a deeper audit
 * (cortex-injected context, convergence, verification). Different purposes; both
 * degrade honestly without an LLM.
 */

import type {
	BetaContentBlock,
	BetaToolUseBlock,
} from '@anthropic-ai/sdk/resources/beta/messages/messages.js'
import { getIsRemoteMode } from '../../bootstrap/state.js'
import { cognize } from '../../cognition/metaCognitiveEngine.js'
import { type CognitionResult, DEFAULT_COGNITION_CONFIG } from '../../cognition/types.js'
import { getCortexEngine } from '../../cortex/index.js'
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
const META_COGNITION_ENV = 'CLAUDE_CODE_ENABLE_META_COGNITION'

/** Surface an advisory only when measured confidence is below this threshold. */
const SURFACE_CONFIDENCE = 0.6

/** Default thresholds for a "non-trivial" turn (mirror the adversarial gate). */
const THRESHOLD_FILES = 3
const THRESHOLD_LINES = 50

/**
 * Light cognition config to bound the cost of the post-turn audit. The default
 * already uses minConfidence 0.7; we cap convergence passes to 1 so the loop
 * re-reasons on blind spots at most once (one extra reason pass), not twice.
 */
const LIGHT_COGNITION_CONFIG = {
	...DEFAULT_COGNITION_CONFIG,
	minConfidence: DEFAULT_COGNITION_CONFIG.minConfidence,
	maxConvergencePasses: 1,
}

let runner:
	| ((context: REPLHookContext, appendSystemMessage?: AppendSystemMessageFn) => Promise<void>)
	| null = null

/**
 * Initialize the meta-cognition runner. Must be called once at startup
 * (alongside `initQuantumReasoning`, in `src/utils/backgroundHousekeeping.ts`);
 * until then `executeMetaCognition` is a no-op.
 */
export function initMetaCognition(): void {
	runner = async function runMetaCognition(context, appendSystemMessage) {
		// Cheapest gates first.
		if (isBareMode()) return
		if (isEnvDefinedFalsy(process.env[META_COGNITION_ENV])) return
		if (getIsRemoteMode()) return
		// Main thread only — subagents don't run the meta-cognition audit.
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
			`[metaCognition] starting — ${changes.changedFiles} files, ${changes.lineCount} lines`,
		)

		const { createGenerateFn } = await import('../../reasoning/generateFnFactory.js')
		const generateFn = await createGenerateFn()
		if (!generateFn) return // No LLM available → silent no-op (do not fabricate).

		// Wire the LLM into the cortex singleton so the cortex step `cognize()`
		// runs internally is LLM-backed (cognize calls getCortexEngine().analyze()
		// without receiving a generateFn, so it must be wired on the singleton).
		try {
			getCortexEngine().setGenerateFn(generateFn)
		} catch (err) {
			// Cortex wiring is best-effort; cognize still degrades honestly without it.
			logForDebugging(`[metaCognition] cortex wiring threw: ${(err as Error).message}`)
		}

		let result: CognitionResult
		try {
			result = await cognize(originalQuery, { generateFn }, LIGHT_COGNITION_CONFIG)
		} catch (err) {
			// Advisory and must never break the agent's stop flow.
			logForDebugging(`[metaCognition] cognize threw: ${(err as Error).message}`)
			return
		}

		// Speak only when there's something to say.
		if (!result.provenance.modelAvailable) return // Honest degradation — no fabricated insight.
		const hasBlindSpots = result.provenance.blindSpots.length > 0
		if (result.confidence.measured >= SURFACE_CONFIDENCE && !hasBlindSpots) return
		if (!appendSystemMessage) return

		appendSystemMessage(
			createSystemMessage(
				formatInsight(result),
				result.confidence.measured < SURFACE_CONFIDENCE ? 'warning' : 'info',
			),
		)
	}
}

/**
 * Entry point from `handleStopHooks`. Fire-and-forget there. No-op until
 * `initMetaCognition()` has been called.
 *
 * @param context - The stop-hook context (turn messages + tool-use context).
 * @param appendSystemMessage - Optional sink for the advisory system message.
 */
export async function executeMetaCognition(
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

/** Format a low-confidence / blind-spot turn into a compact advisory system message. */
function formatInsight(result: CognitionResult): string {
	const confPct = (result.confidence.measured * 100).toFixed(0)
	const blind = result.provenance.blindSpots
	const strategies = result.provenance.strategiesTried.join('+') || 'none'
	const conclusion = result.conclusion
		? result.conclusion.length > 160
			? `${result.conclusion.slice(0, 160)}...`
			: result.conclusion
		: 'no conclusion reached'

	if (result.confidence.measured < SURFACE_CONFIDENCE) {
		const blindNote = blind.length > 0 ? `; blind spots: ${blind.join('; ')}` : ''
		return `[meta-cognition] low-confidence turn (confidence ${confPct}%, strategies: ${strategies}${blindNote}) — consider: ${conclusion}`
	}
	// High measured confidence but cortex/meta-reasoner flagged gaps to address.
	return `[meta-cognition] meta-audit flagged ${blind.length} blind spot(s): ${blind.join('; ')}`
}
