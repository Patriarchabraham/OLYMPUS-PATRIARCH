import { afterEach, describe, expect, it } from 'vitest'
import { composeMarketingAppendSystemPrompt } from './inject.js'
import { getMarketingEngine, resetMarketingEngine } from './marketingEngine.js'
import { MARKETING_PRD_VERSION } from './principles.js'

describe('marketing inject — composeMarketingAppendSystemPrompt (RISK-1 keystone)', () => {
	afterEach(() => {
		resetMarketingEngine()
	})

	it('is a pass-through when Marketing is inactive (default under vitest)', () => {
		expect(composeMarketingAppendSystemPrompt(undefined)).toBe(undefined)
		expect(composeMarketingAppendSystemPrompt('you are helpful')).toBe('you are helpful')
	})

	it('does not invent content when the active contribution is empty', () => {
		expect(composeMarketingAppendSystemPrompt('base')).toBe('base')
	})

	it('appends the Marketing PRD when force-active', () => {
		getMarketingEngine().__setTestForceActive(true)
		const out = composeMarketingAppendSystemPrompt(undefined) as string
		expect(out).toBeTruthy()
		expect(out).toContain(MARKETING_PRD_VERSION)
		expect(out.toLowerCase()).toContain('marketing')
		expect(out.toLowerCase()).toContain('approval')
	})

	it('preserves the existing prompt and stacks onto it', () => {
		getMarketingEngine().__setTestForceActive(true)
		const withBase = composeMarketingAppendSystemPrompt('base prompt') as string
		expect(withBase.startsWith('base prompt')).toBe(true)
		expect(withBase.length).toBeGreaterThan('base prompt'.length)
	})
})
