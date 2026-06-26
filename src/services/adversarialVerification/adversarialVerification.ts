/**
 * Adversarial Verification — turn-end advisory service.
 *
 * Wires `src/verification/adversarialGate.ts:verifyChange` into the stop-hook
 * flow. After the agent finishes a turn that made non-trivial file changes, this
 * runs the gate (scoped static checks + cross-family semantic review) and
 * surfaces the verdict back to the agent/user as a system message.
 *
 * Design mirrors `src/services/autoDream/autoDream.ts`:
 *  - Closure-scoped `runner` set by `initAdversarialVerification()` (enables
 *    dead-code elimination in external builds and clean test isolation).
 *  - Fire-and-forget from `handleStopHooks` (see `src/query/stopHooks.ts`) —
 *    non-blocking by default, matching the `verificationGate` settings schema
 *    (`blockOnDisagreement` defaults to false).
 *  - "Speak only when there's something to say": silent on success, chatty only
 *    when the gate finds a real problem (failed static check, contradictions,
 *    low reviewer agreement).
 *
 * Gating (cheapest first): bare mode → env kill-switch → settings → remote mode
 * → main-thread only. Inputs (changed files, line count, diff, original query)
 * are reconstructed from the turn's tool_use blocks — no new bookkeeping.
 */

import { spawn } from 'node:child_process'

import type {
	BetaContentBlock,
	BetaToolUseBlock,
} from '@anthropic-ai/sdk/resources/beta/messages/messages.js'

import { getIsRemoteMode } from '../../bootstrap/state.js'
import type { ToolUseContext } from '../../Tool.js'
import { FILE_EDIT_TOOL_NAME } from '../../tools/FileEditTool/constants.js'
import { FILE_WRITE_TOOL_NAME } from '../../tools/FileWriteTool/prompt.js'
import type { AssistantMessage, Message } from '../../types/message.js'
import { logForDebugging } from '../../utils/debug.js'
import { isBareMode, isEnvDefinedFalsy } from '../../utils/envUtils.js'
import type { REPLHookContext } from '../../utils/hooks/postSamplingHooks.js'
import { createSystemMessage } from '../../utils/messages.js'
import { getAPIProvider } from '../../utils/model/providers.js'
import { getInitialSettings } from '../../utils/settings/settings.js'
import { verifyChange } from '../../verification/adversarialGate.js'

type AppendSystemMessageFn = NonNullable<ToolUseContext['appendSystemMessage']>

/** Env kill-switch (default ENABLED). Falsy value disables the service. */
const ADVERSARIAL_VERIFICATION_ENV = 'CLAUDE_CODE_ENABLE_ADVERSARIAL_VERIFICATION'

/** Cap the diff string fed to the reviewer (keeps the prompt bounded). */
const MAX_DIFF_BYTES = 8192

/** Default thresholds when settings omit them (must match `verificationGate` schema defaults). */
const DEFAULT_THRESHOLD_FILES = 3
const DEFAULT_THRESHOLD_LINES = 50
const DEFAULT_MIN_CONFIDENCE = 0.5

/** Extracted from the turn's tool_use blocks. */
interface ChangeMetadata {
	/** Absolute paths touched by Edit/Write, de-duplicated, order preserved. */
	changedFiles: string[]
	/** Approximate changed line count (Edit: old+new; Write: content lines). */
	lineCount: number
	/** Full file contents captured from Write tool_use blocks (for untracked-file diff fallback). */
	writeContents: Map<string, string>
}

let runner:
	| ((context: REPLHookContext, appendSystemMessage?: AppendSystemMessageFn) => Promise<void>)
	| null = null

/**
 * Initialize the adversarial verification runner. Must be called once at startup
 * (alongside `initAutoDream`, in `src/utils/backgroundHousekeeping.ts`); until
 * then `executeAdversarialVerification` is a no-op.
 */
export function initAdversarialVerification(): void {
	runner = async function runAdversarialVerification(context, appendSystemMessage) {
		// Cheapest gates first.
		if (isBareMode()) return
		if (isEnvDefinedFalsy(process.env[ADVERSARIAL_VERIFICATION_ENV])) return
		if (getIsRemoteMode()) return
		// Main thread only — subagents don't run adversarial verification.
		if (context.toolUseContext.agentId) return
		if (context.querySource !== 'repl_main_thread') return

		const gateSettings = getInitialSettings()?.verificationGate
		if (gateSettings?.enabled === false) return

		const thresholdFiles = gateSettings?.thresholdFiles ?? DEFAULT_THRESHOLD_FILES
		const thresholdLines = gateSettings?.thresholdLines ?? DEFAULT_THRESHOLD_LINES
		const minConfidence = gateSettings?.minConfidence ?? DEFAULT_MIN_CONFIDENCE

		const meta = extractChangeMetadata(context.messages)
		if (meta.changedFiles.length === 0) return

		// Below threshold → skip before spawning git/tsc (the gate would too, but
		// this avoids the process spawns entirely).
		const meetsThreshold =
			meta.changedFiles.length > thresholdFiles || meta.lineCount > thresholdLines
		if (!meetsThreshold) return

		const diff = await buildDiff(meta.changedFiles, meta.writeContents)
		const originalQuery = extractOriginalQuery(context.messages)

		logForDebugging(
			`[adversarialVerification] starting — ${meta.changedFiles.length} files, ${meta.lineCount} lines`,
		)

		let verdict
		try {
			verdict = await verifyChange({
				changedFiles: meta.changedFiles,
				lineCount: meta.lineCount,
				generatorProvider: String(getAPIProvider()),
				diff,
				originalQuery,
				config: {
					enabled: true,
					thresholdFiles,
					thresholdLines,
					minConfidence,
					reviewerProvider: gateSettings?.reviewerProvider,
					reviewerModel: gateSettings?.reviewerModel,
					blockOnDisagreement: gateSettings?.blockOnDisagreement ?? false,
				},
			})
		} catch (err) {
			// verifyChange is designed to never throw, but defend anyway — this is
			// advisory and must never break the agent's stop flow.
			logForDebugging(`[adversarialVerification] verifyChange threw: ${(err as Error).message}`)
			return
		}

		logForDebugging(
			`[adversarialVerification] verdict: passed=${verdict.passed} confidence=${verdict.confidence}`,
		)

		// Speak only when there's something to say.
		if (
			!appendSystemMessage ||
			!verdict.feedback ||
			(verdict.passed && verdict.confidence >= minConfidence)
		) {
			return
		}

		appendSystemMessage(
			createSystemMessage(
				formatFeedback(verdict, minConfidence),
				verdict.passed ? 'info' : 'warning',
			),
		)
	}
}

/**
 * Entry point from `handleStopHooks`. Fire-and-forget there. No-op until
 * `initAdversarialVerification()` has been called.
 *
 * @param context - The stop-hook context (turn messages + tool-use context).
 * @param appendSystemMessage - Optional sink for the verdict system message.
 */
export async function executeAdversarialVerification(
	context: REPLHookContext,
	appendSystemMessage?: AppendSystemMessageFn,
): Promise<void> {
	await runner?.(context, appendSystemMessage)
}

/**
 * Scan a turn's messages for Edit/Write tool_use blocks and collect the files
 * they touched, an approximate changed-line count, and any Write contents.
 *
 * @param messages - The message list for the turn.
 * @returns Aggregated change metadata (empty lists/maps if nothing was edited).
 */
function extractChangeMetadata(messages: Message[]): ChangeMetadata {
	const changedFiles: string[] = []
	const seen = new Set<string>()
	const writeContents = new Map<string, string>()
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
			if (!filePath) continue
			if (!seen.has(filePath)) {
				seen.add(filePath)
				changedFiles.push(filePath)
			}

			if (isEdit) {
				lineCount += lineCountOf(input.old_string)
				lineCount += lineCountOf(input.new_string)
			} else {
				lineCount += lineCountOf(input.content)
				if (typeof input.content === 'string') writeContents.set(filePath, input.content)
			}
		}
	}

	return { changedFiles, lineCount, writeContents }
}

/** Count lines in a value (0 for non-strings). */
function lineCountOf(value: unknown): number {
	return typeof value === 'string' ? value.split('\n').length : 0
}

/**
 * Best-effort diff for the reviewer. Uses `git diff HEAD -- <files>` for tracked
 * files and appends captured Write contents (as `+++ NEW FILE`) for paths git
 * didn't report — covering newly-created files. Capped at {@link MAX_DIFF_BYTES}.
 * Never throws: any git failure degrades to whatever Write contents we have.
 */
async function buildDiff(
	changedFiles: string[],
	writeContents: Map<string, string>,
): Promise<string> {
	const tracked = await gitDiffHead(changedFiles).catch(() => '')
	let diff = tracked
	for (const [path, content] of writeContents) {
		if (!tracked.includes(path)) {
			diff += `\n+++ NEW FILE: ${path}\n${content}\n`
		}
	}
	return diff.slice(0, MAX_DIFF_BYTES)
}

/** Run `git diff HEAD -- <files>` and return stdout. Best-effort, never throws. */
function gitDiffHead(files: string[]): Promise<string> {
	return new Promise((resolve) => {
		try {
			const child = spawn('git', ['diff', 'HEAD', '--', ...files], {
				shell: process.platform === 'win32',
				stdio: ['ignore', 'pipe', 'ignore'],
			})
			let stdout = ''
			child.stdout?.on('data', (chunk) => {
				stdout += chunk.toString()
				if (stdout.length > MAX_DIFF_BYTES) stdout = stdout.slice(0, MAX_DIFF_BYTES)
			})
			child.on('error', () => resolve(''))
			child.on('close', () => resolve(stdout))
		} catch {
			resolve('')
		}
	})
}

/** Extract the last user message text from the turn (the driving query). */
function extractOriginalQuery(messages: Message[]): string {
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

/** Format the verdict into a compact, human-readable system message. */
function formatFeedback(
	verdict: Awaited<ReturnType<typeof verifyChange>>,
	minConfidence: number,
): string {
	const parts = [
		`[adversarial-verification] ${verdict.feedback}`,
		`confidence ${(verdict.confidence * 100).toFixed(0)}% (min ${(minConfidence * 100).toFixed(0)}%)`,
		`static[tsc=${verdict.staticChecks.typecheck.passed ? 'pass' : 'fail'},lint=${verdict.staticChecks.lint.passed ? 'pass' : 'fail'}]`,
	]
	if (verdict.semanticReview) {
		parts.push(
			`reviewer ${verdict.semanticReview.reviewerFamily}/${verdict.semanticReview.reviewerModel}`,
		)
	}
	return parts.join(' · ')
}
