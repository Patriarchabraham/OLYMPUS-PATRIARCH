import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FILE_EDIT_TOOL_NAME } from '../../../tools/FileEditTool/constants.js'
import { FILE_WRITE_TOOL_NAME } from '../../../tools/FileWriteTool/prompt.js'
import type { Message } from '../../../types/message.js'

// Hoisted mocks so vi.mock factories can reference them (factories run before imports).
const hoisted = vi.hoisted(() => ({
	verifyChange: vi.fn(),
	getInitialSettings: vi.fn(),
	appendSystemMessage: vi.fn(),
}))

vi.mock('../../../verification/adversarialGate.js', () => ({
	verifyChange: hoisted.verifyChange,
}))
vi.mock('../../../utils/settings/settings.js', () => ({
	getInitialSettings: hoisted.getInitialSettings,
}))
vi.mock('../../../bootstrap/state.js', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../../../bootstrap/state.js')>()
	return { ...actual, getIsRemoteMode: () => false }
})

import {
	executeAdversarialVerification,
	initAdversarialVerification,
} from '../adversarialVerification.js'

/** Build a fake assistant message carrying the given tool_use blocks. */
function assistantMsg(toolUses: Array<{ name: string; input: Record<string, unknown> }>): Message {
	return {
		type: 'assistant',
		message: {
			content: toolUses.map((t) => ({
				type: 'tool_use' as const,
				name: t.name,
				input: t.input,
			})),
		},
	} as unknown as Message
}

function userMsg(text: string): Message {
	return { type: 'user', message: { role: 'user', content: text } } as unknown as Message
}

/** Minimal REPLHookContext with only the fields the service reads. */
function makeContext(messages: Message[], opts: { agentId?: string; querySource?: string } = {}) {
	return {
		messages,
		systemPrompt: {},
		userContext: {},
		systemContext: {},
		querySource: opts.querySource ?? 'repl_main_thread',
		toolUseContext: { agentId: opts.agentId },
	} as never
}

function settings(over: Record<string, unknown> = {}) {
	return {
		verificationGate: {
			enabled: true,
			thresholdFiles: 0,
			thresholdLines: 0,
			minConfidence: 0.5,
			...over,
		},
	}
}

/** A complete GateVerdict-shaped object (matches what the real gate returns). */
function verdict(over: Record<string, unknown> = {}) {
	return {
		passed: true,
		confidence: 1,
		feedback: undefined,
		staticChecks: {
			typecheck: { passed: true, stderr: '' },
			lint: { passed: true, stderr: '' },
			overall: true,
		},
		durationMs: 5,
		...over,
	}
}

beforeEach(() => {
	hoisted.verifyChange.mockReset()
	hoisted.getInitialSettings.mockReset()
	hoisted.appendSystemMessage.mockReset()
	delete process.env.CLAUDE_CODE_ENABLE_ADVERSARIAL_VERIFICATION
	// Default: gate enabled, threshold 0 so any change runs verifyChange.
	hoisted.getInitialSettings.mockReturnValue(settings())
	hoisted.verifyChange.mockResolvedValue(verdict())
	initAdversarialVerification()
})

describe('executeAdversarialVerification', () => {
	it('is a no-op when no files were edited (verifyChange not called)', async () => {
		await executeAdversarialVerification(makeContext([userMsg('hi')]), hoisted.appendSystemMessage)
		expect(hoisted.verifyChange).not.toHaveBeenCalled()
		expect(hoisted.appendSystemMessage).not.toHaveBeenCalled()
	})

	it('extracts the file_path from an Edit tool_use and passes it to verifyChange', async () => {
		await executeAdversarialVerification(
			makeContext([
				userMsg('refactor x'),
				assistantMsg([
					{
						name: FILE_EDIT_TOOL_NAME,
						input: { file_path: '/abs/a.ts', old_string: 'x\ny', new_string: 'p\nq\nr' },
					},
				]),
			]),
			hoisted.appendSystemMessage,
		)
		expect(hoisted.verifyChange).toHaveBeenCalledTimes(1)
		expect(hoisted.verifyChange.mock.calls[0][0].changedFiles).toEqual(['/abs/a.ts'])
		// old_string(2) + new_string(3) = 5 lines
		expect(hoisted.verifyChange.mock.calls[0][0].lineCount).toBe(5)
	})

	it('extracts the file_path from a Write tool_use', async () => {
		await executeAdversarialVerification(
			makeContext([
				userMsg('create x'),
				assistantMsg([
					{
						name: FILE_WRITE_TOOL_NAME,
						input: { file_path: '/abs/new.ts', content: 'a\nb\nc' },
					},
				]),
			]),
			hoisted.appendSystemMessage,
		)
		expect(hoisted.verifyChange.mock.calls[0][0].changedFiles).toEqual(['/abs/new.ts'])
		expect(hoisted.verifyChange.mock.calls[0][0].lineCount).toBe(3)
	})

	it('de-duplicates paths edited multiple times in the same turn', async () => {
		await executeAdversarialVerification(
			makeContext([
				assistantMsg([
					{
						name: FILE_EDIT_TOOL_NAME,
						input: { file_path: '/abs/a.ts', old_string: 'a', new_string: 'b' },
					},
					{
						name: FILE_EDIT_TOOL_NAME,
						input: { file_path: '/abs/a.ts', old_string: 'c', new_string: 'd' },
					},
				]),
			]),
			hoisted.appendSystemMessage,
		)
		expect(hoisted.verifyChange.mock.calls[0][0].changedFiles).toEqual(['/abs/a.ts'])
	})

	it('skips below the threshold (no verifyChange call)', async () => {
		hoisted.getInitialSettings.mockReturnValue(
			settings({ thresholdFiles: 999, thresholdLines: 999999 }),
		)
		await executeAdversarialVerification(
			makeContext([
				assistantMsg([
					{
						name: FILE_EDIT_TOOL_NAME,
						input: { file_path: '/abs/a.ts', old_string: 'a', new_string: 'b' },
					},
				]),
			]),
			hoisted.appendSystemMessage,
		)
		expect(hoisted.verifyChange).not.toHaveBeenCalled()
	})

	it('surfaces a warning system message when the gate fails', async () => {
		hoisted.verifyChange.mockResolvedValue(
			verdict({
				passed: false,
				confidence: 0.2,
				feedback: 'typecheck failed; low reviewer agreement (30%)',
				staticChecks: {
					typecheck: { passed: false, stderr: 'error TS1234' },
					lint: { passed: true, stderr: '' },
					overall: false,
				},
			}),
		)
		await executeAdversarialVerification(
			makeContext([
				assistantMsg([
					{ name: FILE_WRITE_TOOL_NAME, input: { file_path: '/abs/new.ts', content: 'a\nb' } },
				]),
			]),
			hoisted.appendSystemMessage,
		)
		expect(hoisted.appendSystemMessage).toHaveBeenCalledTimes(1)
		const msg = hoisted.appendSystemMessage.mock.calls[0][0]
		expect(msg.level).toBe('warning')
		expect(msg.content).toContain('typecheck failed')
		expect(msg.content).toContain('static[tsc=fail')
	})

	it('stays silent when the gate passes cleanly', async () => {
		hoisted.verifyChange.mockResolvedValue(verdict({ passed: true, confidence: 0.99 }))
		await executeAdversarialVerification(
			makeContext([
				assistantMsg([
					{
						name: FILE_EDIT_TOOL_NAME,
						input: { file_path: '/abs/a.ts', old_string: 'a', new_string: 'b' },
					},
				]),
			]),
			hoisted.appendSystemMessage,
		)
		expect(hoisted.appendSystemMessage).not.toHaveBeenCalled()
	})

	it('skips when disabled via settings', async () => {
		hoisted.getInitialSettings.mockReturnValue(settings({ enabled: false }))
		await executeAdversarialVerification(
			makeContext([
				assistantMsg([
					{
						name: FILE_EDIT_TOOL_NAME,
						input: { file_path: '/abs/a.ts', old_string: 'a', new_string: 'b' },
					},
				]),
			]),
			hoisted.appendSystemMessage,
		)
		expect(hoisted.verifyChange).not.toHaveBeenCalled()
	})

	it('skips when the env kill-switch is falsy', async () => {
		process.env.CLAUDE_CODE_ENABLE_ADVERSARIAL_VERIFICATION = '0'
		await executeAdversarialVerification(
			makeContext([
				assistantMsg([
					{
						name: FILE_EDIT_TOOL_NAME,
						input: { file_path: '/abs/a.ts', old_string: 'a', new_string: 'b' },
					},
				]),
			]),
			hoisted.appendSystemMessage,
		)
		expect(hoisted.verifyChange).not.toHaveBeenCalled()
	})

	it('skips for subagents (agentId set)', async () => {
		await executeAdversarialVerification(
			makeContext(
				[
					assistantMsg([
						{
							name: FILE_EDIT_TOOL_NAME,
							input: { file_path: '/abs/a.ts', old_string: 'a', new_string: 'b' },
						},
					]),
				],
				{ agentId: 'agent-1' },
			),
			hoisted.appendSystemMessage,
		)
		expect(hoisted.verifyChange).not.toHaveBeenCalled()
	})

	it('skips for non-main-thread query sources', async () => {
		await executeAdversarialVerification(
			makeContext(
				[
					assistantMsg([
						{
							name: FILE_EDIT_TOOL_NAME,
							input: { file_path: '/abs/a.ts', old_string: 'a', new_string: 'b' },
						},
					]),
				],
				{ querySource: 'compact' },
			),
			hoisted.appendSystemMessage,
		)
		expect(hoisted.verifyChange).not.toHaveBeenCalled()
	})

	it('passes the last user message as originalQuery', async () => {
		await executeAdversarialVerification(
			makeContext([
				userMsg('first question'),
				assistantMsg([
					{
						name: FILE_EDIT_TOOL_NAME,
						input: { file_path: '/abs/a.ts', old_string: 'a', new_string: 'b' },
					},
				]),
				userMsg('the real driving query'),
			]),
			hoisted.appendSystemMessage,
		)
		expect(hoisted.verifyChange.mock.calls[0][0].originalQuery).toBe('the real driving query')
	})
})
