import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CognitionResult } from '../../../cognition/types.js'
import { FILE_EDIT_TOOL_NAME } from '../../../tools/FileEditTool/constants.js'
import { FILE_WRITE_TOOL_NAME } from '../../../tools/FileWriteTool/prompt.js'
import type { Message } from '../../../types/message.js'

// Hoisted mocks so vi.mock factories can reference them (factories run before imports).
const hoisted = vi.hoisted(() => ({
	createGenerateFn: vi.fn(),
	cognize: vi.fn(),
	setGenerateFn: vi.fn(),
	appendSystemMessage: vi.fn(),
}))

vi.mock('../../../cognition/metaCognitiveEngine.js', () => ({
	cognize: hoisted.cognize,
}))
vi.mock('../../../cortex/index.js', () => ({
	getCortexEngine: () => ({ setGenerateFn: hoisted.setGenerateFn }),
}))
vi.mock('../../../reasoning/generateFnFactory.js', () => ({
	createGenerateFn: hoisted.createGenerateFn,
}))
vi.mock('../../../bootstrap/state.js', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../../../bootstrap/state.js')>()
	return { ...actual, getIsRemoteMode: () => false }
})

import { executeMetaCognition, initMetaCognition } from '../metaCognition.js'

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

/** A single Write of N lines (one path, N-line content) → 1 changed file, N lines. */
function writeTurn(lines: number): Message[] {
	const content = Array.from({ length: lines }, (_, i) => `line ${i}`).join('\n')
	return [
		userMsg('build the feature'),
		assistantMsg([{ name: FILE_WRITE_TOOL_NAME, input: { file_path: '/abs/x.ts', content } }]),
	]
}

/** A CognitionResult factory: high-confidence, no blind spots by default (silent path). */
function result(over: Record<string, unknown> = {}): CognitionResult {
	return {
		query: 'q',
		intent: { explicit: 'q', implicit: '', meta: '', predictive: '', constraints: [] },
		conclusion: 'a considered conclusion',
		confidence: { measured: 0.9, cortex: 0.9, reasoningQuality: 0.9, verification: 0.9 },
		verification: { provider: 'p', agreement: 0.9, contradictions: [] },
		provenance: {
			strategiesTried: ['cot'],
			escalations: 0,
			convergencePasses: 0,
			converged: true,
			metaInsightsCount: 1,
			blindSpots: [],
			modelAvailable: true,
			durationMs: 10,
		},
		augmentedContext: '',
		...over,
	} as CognitionResult
}

beforeEach(() => {
	hoisted.createGenerateFn.mockReset()
	hoisted.cognize.mockReset()
	hoisted.setGenerateFn.mockReset()
	hoisted.appendSystemMessage.mockReset()
	delete process.env.CLAUDE_CODE_ENABLE_META_COGNITION
	// Default: LLM available, high-confidence result (silent), runner wired.
	hoisted.createGenerateFn.mockResolvedValue(async () => 'ok')
	hoisted.cognize.mockResolvedValue(result())
	initMetaCognition()
})

describe('executeMetaCognition', () => {
	it('is a no-op when no files were edited (cognize not called)', async () => {
		await executeMetaCognition(makeContext([userMsg('hi')]), hoisted.appendSystemMessage)
		expect(hoisted.createGenerateFn).not.toHaveBeenCalled()
		expect(hoisted.cognize).not.toHaveBeenCalled()
		expect(hoisted.appendSystemMessage).not.toHaveBeenCalled()
	})

	it('skips below the change threshold (cognize not called)', async () => {
		await executeMetaCognition(makeContext(writeTurn(5)), hoisted.appendSystemMessage)
		expect(hoisted.cognize).not.toHaveBeenCalled()
	})

	it('runs the pipeline on a non-trivial turn (>50 lines) and wires cortex', async () => {
		await executeMetaCognition(makeContext(writeTurn(60)), hoisted.appendSystemMessage)
		expect(hoisted.createGenerateFn).toHaveBeenCalledTimes(1)
		expect(hoisted.setGenerateFn).toHaveBeenCalledTimes(1) // cortex wired before cognize
		expect(hoisted.cognize).toHaveBeenCalledTimes(1)
	})

	it('is a silent no-op when no LLM is available (createGenerateFn → null)', async () => {
		hoisted.createGenerateFn.mockResolvedValue(null)
		await executeMetaCognition(makeContext(writeTurn(60)), hoisted.appendSystemMessage)
		expect(hoisted.cognize).not.toHaveBeenCalled()
		expect(hoisted.appendSystemMessage).not.toHaveBeenCalled()
	})

	it('stays silent when measured confidence is high with no blind spots', async () => {
		hoisted.cognize.mockResolvedValue(
			result({
				confidence: { measured: 0.95, cortex: 0.95, reasoningQuality: 0.95, verification: 0.95 },
			}),
		)
		await executeMetaCognition(makeContext(writeTurn(60)), hoisted.appendSystemMessage)
		expect(hoisted.appendSystemMessage).not.toHaveBeenCalled()
	})

	it('surfaces a warning when measured confidence is low', async () => {
		hoisted.cognize.mockResolvedValue(
			result({
				confidence: { measured: 0.3, cortex: 0.3, reasoningQuality: 0.3, verification: 0.3 },
			}),
		)
		await executeMetaCognition(makeContext(writeTurn(60)), hoisted.appendSystemMessage)
		expect(hoisted.appendSystemMessage).toHaveBeenCalledTimes(1)
		const msg = hoisted.appendSystemMessage.mock.calls[0][0]
		expect(msg.level).toBe('warning')
		expect(msg.content).toContain('low-confidence')
	})

	it('surfaces an info advisory when blind spots are flagged despite high confidence', async () => {
		hoisted.cognize.mockResolvedValue(
			result({
				provenance: {
					strategiesTried: ['cot'],
					escalations: 0,
					convergencePasses: 0,
					converged: true,
					metaInsightsCount: 1,
					blindSpots: ['error handling', 'edge case: empty input'],
					modelAvailable: true,
					durationMs: 10,
				},
			}),
		)
		await executeMetaCognition(makeContext(writeTurn(60)), hoisted.appendSystemMessage)
		expect(hoisted.appendSystemMessage).toHaveBeenCalledTimes(1)
		const msg = hoisted.appendSystemMessage.mock.calls[0][0]
		expect(msg.level).toBe('info')
		expect(msg.content).toContain('blind spot')
		expect(msg.content).toContain('error handling')
	})

	it('stays silent when the result degraded (modelAvailable false)', async () => {
		hoisted.cognize.mockResolvedValue(
			result({
				provenance: {
					strategiesTried: [],
					escalations: 0,
					convergencePasses: 0,
					converged: false,
					metaInsightsCount: 0,
					blindSpots: [],
					modelAvailable: false,
					durationMs: 1,
				},
			}),
		)
		await executeMetaCognition(makeContext(writeTurn(60)), hoisted.appendSystemMessage)
		expect(hoisted.appendSystemMessage).not.toHaveBeenCalled()
	})

	it('skips when the env kill-switch is falsy', async () => {
		process.env.CLAUDE_CODE_ENABLE_META_COGNITION = '0'
		await executeMetaCognition(makeContext(writeTurn(60)), hoisted.appendSystemMessage)
		expect(hoisted.cognize).not.toHaveBeenCalled()
	})

	it('skips for subagents (agentId set)', async () => {
		await executeMetaCognition(
			makeContext(writeTurn(60), { agentId: 'agent-1' }),
			hoisted.appendSystemMessage,
		)
		expect(hoisted.cognize).not.toHaveBeenCalled()
	})

	it('skips for non-main-thread query sources', async () => {
		await executeMetaCognition(
			makeContext(writeTurn(60), { querySource: 'compact' }),
			hoisted.appendSystemMessage,
		)
		expect(hoisted.cognize).not.toHaveBeenCalled()
	})

	it('passes the last user message as the query to cognize', async () => {
		await executeMetaCognition(
			makeContext([...writeTurn(60), userMsg('the real driving query')]),
			hoisted.appendSystemMessage,
		)
		expect(hoisted.cognize.mock.calls[0][0]).toBe('the real driving query')
	})

	it('treats multiple Edits across >3 distinct files as non-trivial', async () => {
		const edits = Array.from({ length: 4 }, (_, i) => ({
			name: FILE_EDIT_TOOL_NAME,
			input: { file_path: `/abs/${i}.ts`, old_string: 'a', new_string: 'b' },
		}))
		await executeMetaCognition(
			makeContext([userMsg('refactor'), assistantMsg(edits)]),
			hoisted.appendSystemMessage,
		)
		expect(hoisted.cognize).toHaveBeenCalledTimes(1)
	})
})
