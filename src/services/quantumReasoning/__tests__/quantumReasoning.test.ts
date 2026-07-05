import { beforeEach, describe, expect, it, vi } from 'vitest'
import { FILE_EDIT_TOOL_NAME } from '../../../tools/FileEditTool/constants.js'
import { FILE_WRITE_TOOL_NAME } from '../../../tools/FileWriteTool/prompt.js'
import type { Message } from '../../../types/message.js'

// Hoisted mocks so vi.mock factories can reference them (factories run before imports).
const hoisted = vi.hoisted(() => ({
	createGenerateFn: vi.fn(),
	process: vi.fn(),
	appendSystemMessage: vi.fn(),
}))

vi.mock('../../../quantum/quantumEngine.js', () => ({
	QuantumEngine: class {
		setGenerateFn() {}
		process = hoisted.process
	},
}))
vi.mock('../../../reasoning/generateFnFactory.js', () => ({
	createGenerateFn: hoisted.createGenerateFn,
}))
vi.mock('../../../bootstrap/state.js', async (importOriginal) => {
	const actual = await importOriginal<typeof import('../../../bootstrap/state.js')>()
	return { ...actual, getIsRemoteMode: () => false }
})

import { clearQuantumLoopStore, getLoopEntryCount } from '../../../quantum/quantumLoopStore.js'
import { executeQuantumReasoning, initQuantumReasoning } from '../quantumReasoning.js'

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

/** A high-confidence analysis (silent path). */
function analysis(over: Record<string, unknown> = {}) {
	return {
		id: 'qa_test',
		query: 'the driving query',
		confidence: 0.9,
		degraded: false,
		states: [{ dimension: 'security', confidence: 0.9, solution: 'a strong approach' }],
		dimensionsCovered: ['security'],
		entanglements: [],
		tunnelResults: [],
		collapseResult: null,
		timestamp: 0,
		...over,
	}
}

beforeEach(() => {
	hoisted.createGenerateFn.mockReset()
	hoisted.process.mockReset()
	hoisted.appendSystemMessage.mockReset()
	delete process.env.CLAUDE_CODE_ENABLE_QUANTUM
	// The carry-forward store is module-level (process memory); reset between
	// tests so a prior test's recorded blind spot can't leak into the next.
	clearQuantumLoopStore()
	// Default: LLM available, high-confidence analysis (silent), runner wired.
	hoisted.createGenerateFn.mockResolvedValue(async () => 'ok')
	hoisted.process.mockResolvedValue(analysis())
	initQuantumReasoning()
})

describe('executeQuantumReasoning', () => {
	it('is a no-op when no files were edited (process not called)', async () => {
		await executeQuantumReasoning(makeContext([userMsg('hi')]), hoisted.appendSystemMessage)
		expect(hoisted.createGenerateFn).not.toHaveBeenCalled()
		expect(hoisted.process).not.toHaveBeenCalled()
		expect(hoisted.appendSystemMessage).not.toHaveBeenCalled()
	})

	it('skips below the change threshold (process not called)', async () => {
		await executeQuantumReasoning(makeContext(writeTurn(5)), hoisted.appendSystemMessage)
		expect(hoisted.process).not.toHaveBeenCalled()
	})

	it('runs the pipeline on a non-trivial turn (>50 lines)', async () => {
		await executeQuantumReasoning(makeContext(writeTurn(60)), hoisted.appendSystemMessage)
		expect(hoisted.createGenerateFn).toHaveBeenCalledTimes(1)
		expect(hoisted.process).toHaveBeenCalledTimes(1)
	})

	it('is a silent no-op when no LLM is available (createGenerateFn → null)', async () => {
		hoisted.createGenerateFn.mockResolvedValue(null)
		await executeQuantumReasoning(makeContext(writeTurn(60)), hoisted.appendSystemMessage)
		expect(hoisted.process).not.toHaveBeenCalled()
		expect(hoisted.appendSystemMessage).not.toHaveBeenCalled()
	})

	it('stays silent when the collapse is high-confidence', async () => {
		hoisted.process.mockResolvedValue(analysis({ confidence: 0.95 }))
		await executeQuantumReasoning(makeContext(writeTurn(60)), hoisted.appendSystemMessage)
		expect(hoisted.appendSystemMessage).not.toHaveBeenCalled()
	})

	it('surfaces an advisory when the collapse is low-confidence', async () => {
		hoisted.process.mockResolvedValue(analysis({ confidence: 0.3 }))
		await executeQuantumReasoning(makeContext(writeTurn(60)), hoisted.appendSystemMessage)
		expect(hoisted.appendSystemMessage).toHaveBeenCalledTimes(1)
		const msg = hoisted.appendSystemMessage.mock.calls[0][0]
		expect(msg.level).toBe('info')
		expect(msg.content).toContain('low-confidence')
	})

	it('stays silent when the analysis degraded (no usable candidates)', async () => {
		hoisted.process.mockResolvedValue(analysis({ degraded: true, states: [], confidence: 0 }))
		await executeQuantumReasoning(makeContext(writeTurn(60)), hoisted.appendSystemMessage)
		expect(hoisted.appendSystemMessage).not.toHaveBeenCalled()
	})

	it('skips when the env kill-switch is falsy', async () => {
		process.env.CLAUDE_CODE_ENABLE_QUANTUM = '0'
		await executeQuantumReasoning(makeContext(writeTurn(60)), hoisted.appendSystemMessage)
		expect(hoisted.process).not.toHaveBeenCalled()
	})

	it('skips for subagents (agentId set)', async () => {
		await executeQuantumReasoning(
			makeContext(writeTurn(60), { agentId: 'agent-1' }),
			hoisted.appendSystemMessage,
		)
		expect(hoisted.process).not.toHaveBeenCalled()
	})

	it('skips for non-main-thread query sources', async () => {
		await executeQuantumReasoning(
			makeContext(writeTurn(60), { querySource: 'compact' }),
			hoisted.appendSystemMessage,
		)
		expect(hoisted.process).not.toHaveBeenCalled()
	})

	it('passes the last user message as the query to process', async () => {
		await executeQuantumReasoning(
			makeContext([...writeTurn(60), userMsg('the real driving query')]),
			hoisted.appendSystemMessage,
		)
		expect(hoisted.process.mock.calls[0][0]).toBe('the real driving query')
	})

	it('treats multiple Edits across >3 distinct files as non-trivial', async () => {
		const edits = Array.from({ length: 4 }, (_, i) => ({
			name: FILE_EDIT_TOOL_NAME,
			input: { file_path: `/abs/${i}.ts`, old_string: 'a', new_string: 'b' },
		}))
		await executeQuantumReasoning(
			makeContext([userMsg('refactor'), assistantMsg(edits)]),
			hoisted.appendSystemMessage,
		)
		expect(hoisted.process).toHaveBeenCalledTimes(1)
	})

	it('records non-degraded analyses into the carry-forward store', async () => {
		hoisted.process.mockResolvedValue(analysis({ confidence: 0.3 }))
		await executeQuantumReasoning(makeContext(writeTurn(60)), hoisted.appendSystemMessage)
		expect(getLoopEntryCount()).toBe(1)
	})

	it('does not record degraded analyses into the carry-forward store', async () => {
		hoisted.process.mockResolvedValue(analysis({ degraded: true, states: [], confidence: 0 }))
		await executeQuantumReasoning(makeContext(writeTurn(60)), hoisted.appendSystemMessage)
		expect(getLoopEntryCount()).toBe(0)
	})

	it('carries forward an open blind spot to a later high-confidence turn', async () => {
		// Turn A: low-confidence → flags a blind spot and injects the carry.
		hoisted.process.mockResolvedValue(analysis({ confidence: 0.3 }))
		await executeQuantumReasoning(makeContext(writeTurn(60)), hoisted.appendSystemMessage)
		expect(hoisted.appendSystemMessage).toHaveBeenCalledTimes(1)

		// Turn B: high-confidence on its own — but turn A's blind spot is still in
		// the window, so the agent is reminded. This is the closed loop: a flagged
		// blind spot survives past the single turn that found it.
		hoisted.appendSystemMessage.mockClear()
		hoisted.process.mockResolvedValue(analysis({ confidence: 0.95 }))
		await executeQuantumReasoning(makeContext(writeTurn(60)), hoisted.appendSystemMessage)
		expect(hoisted.appendSystemMessage).toHaveBeenCalledTimes(1)
		const carry = hoisted.appendSystemMessage.mock.calls[0]?.[0]?.content
		expect(carry).toContain('low-confidence')
	})

	it('goes silent once the window has no open blind spots', async () => {
		// Two high-confidence turns → nothing is flagged → no carry to inject.
		hoisted.process.mockResolvedValue(analysis({ confidence: 0.95 }))
		await executeQuantumReasoning(makeContext(writeTurn(60)), hoisted.appendSystemMessage)
		expect(hoisted.appendSystemMessage).not.toHaveBeenCalled()
		expect(getLoopEntryCount()).toBe(1) // still recorded, just not a blind spot
	})
})
