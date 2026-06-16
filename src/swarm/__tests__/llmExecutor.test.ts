import type { BetaMessage } from '@anthropic-ai/sdk/resources/beta/messages.mjs'
import { describe, expect, it, vi } from 'vitest'

// The executor's callModel seam replaces sideQuery(), and the `model` option
// overrides getSmallFastModel(). Stub both so the test never loads their
// transitive import graph — which hits a pre-existing vitest .js->.ts
// resolution failure (AskUserQuestionTool/prompt.js) in this WIP tree,
// unrelated to this module's logic.
vi.mock('../../utils/sideQuery.js', () => ({ sideQuery: vi.fn() }))
vi.mock('../../utils/model/model.js', () => ({ getSmallFastModel: () => 'test-model' }))

import { buildTaskPrompt, createLlmAgentExecutor } from '../llmExecutor.js'
import type { SwarmAgentInfo, SwarmTask } from '../types.js'

type ModelResponse = Pick<BetaMessage, 'content' | 'stop_reason'>

/** Build a minimal model response (only the fields llmExecutor reads). */
function textResponse(text: string): ModelResponse {
	return {
		content: [{ type: 'text', text }],
		stop_reason: 'end_turn',
	} as unknown as ModelResponse
}

function makeTask(description = 'do X'): SwarmTask {
	return {
		id: 't1',
		description,
		assignedRole: 'coder',
		priority: 5,
		status: 'pending',
		dependencies: [],
		createdAt: 0,
	}
}

function makeAgent(role: SwarmAgentInfo['role'] = 'coder'): SwarmAgentInfo {
	return { id: 'a1', role, capabilities: ['implementation'], status: 'idle' }
}

describe('createLlmAgentExecutor', () => {
	it('returns success when the model produces text', async () => {
		const executor = createLlmAgentExecutor({
			model: 'test-model',
			callModel: async () => textResponse('result body'),
		})
		const res = await executor(makeTask(), makeAgent())
		expect(res.success).toBe(true)
		expect(res.output).toBe('result body')
		expect(res.taskId).toBe('t1')
		expect(res.metadata?.agentRole).toBe('coder')
		expect(res.metadata?.model).toBe('test-model')
	})

	it('marks ERROR: output as failure', async () => {
		const executor = createLlmAgentExecutor({
			model: 'test-model',
			callModel: async () => textResponse('ERROR: no model access'),
		})
		const res = await executor(makeTask(), makeAgent())
		expect(res.success).toBe(false)
	})

	it('surfaces model errors as failure with errorClass', async () => {
		const executor = createLlmAgentExecutor({
			model: 'test-model',
			callModel: async () => {
				throw new TypeError('boom')
			},
		})
		const res = await executor(makeTask(), makeAgent())
		expect(res.success).toBe(false)
		expect(res.metadata?.errorClass).toBe('TypeError')
	})
})

describe('buildTaskPrompt', () => {
	it('includes the task description and agent role', () => {
		const prompt = buildTaskPrompt(makeTask('implement foo'), makeAgent('architect'))
		expect(prompt).toContain('implement foo')
		expect(prompt).toContain('architect')
	})
})
