import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { composeOpsAppendSystemPrompt } from './inject.js'
import { getOpsEngine, resetOpsEngine } from './opsEngine.js'

describe('ops inject — composeOpsAppendSystemPrompt', () => {
	beforeEach(() => resetOpsEngine())
	afterEach(() => resetOpsEngine())

	it('is a pass-through when Ops is inactive (default under vitest)', () => {
		expect(composeOpsAppendSystemPrompt(undefined)).toBe(undefined)
		expect(composeOpsAppendSystemPrompt('existing')).toBe('existing')
	})

	it('appends the Ops PRD when Ops is force-active', () => {
		getOpsEngine().__setTestForceActive(true)
		const out = composeOpsAppendSystemPrompt(undefined) as string
		expect(out).toBeTruthy()
		expect(out.toLowerCase()).toContain('agentic operations')
		const withBase = composeOpsAppendSystemPrompt('base') as string
		expect(withBase.startsWith('base')).toBe(true)
		expect(withBase.length).toBeGreaterThan('base'.length)
	})
})
