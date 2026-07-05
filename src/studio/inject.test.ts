import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { composeAppendSystemPrompt } from './inject.js'
import { DEFAULT_STUDIO_CONFIG, getStudioEngine, resetStudioEngine } from './studioEngine.js'

describe('studio inject — composeAppendSystemPrompt (RISK-1 keystone)', () => {
	beforeEach(() => {
		resetStudioEngine()
	})

	afterEach(() => {
		resetStudioEngine()
	})

	it('passes existing through UNCHANGED (undefined) when inactive — the default in tests', () => {
		expect(composeAppendSystemPrompt(undefined)).toBe(undefined)
	})

	it('passes a non-empty existing string through unchanged when inactive', () => {
		expect(composeAppendSystemPrompt('you are helpful')).toBe('you are helpful')
	})

	it('appends the PRD exactly once when forced active, with no existing prompt', () => {
		const e = getStudioEngine()
		e.__setTestForceActive(true)
		const out = composeAppendSystemPrompt(undefined)
		expect(typeof out).toBe('string')
		expect(out!.length).toBeGreaterThan(0)
		expect(out).toContain(DEFAULT_STUDIO_CONFIG.prdVersion)
	})

	it('appends the PRD after the existing prompt with a blank-line separator', () => {
		const e = getStudioEngine()
		e.__setTestForceActive(true)
		const out = composeAppendSystemPrompt('base prompt') as string
		expect(out.startsWith('base prompt\n\n')).toBe(true)
		const prd = e.buildPrdInjection()
		expect(out).toBe(`base prompt\n\n${prd}`)
		// PRD body appears exactly once (not duplicated)
		expect(out.split(prd).length - 1).toBe(1)
	})

	it('does not inject when the engine is disabled (the /studio disable path)', () => {
		const e = getStudioEngine()
		e.setConfig({ enabled: false })
		// not forced → isStudioActive() = enabled(false) && !isTestEnv() = false
		expect(e.isStudioActive()).toBe(false)
		expect(composeAppendSystemPrompt('x')).toBe('x')
		expect(composeAppendSystemPrompt(undefined)).toBe(undefined)
	})

	it('toggling force off removes the injection again', () => {
		const e = getStudioEngine()
		e.__setTestForceActive(true)
		expect(composeAppendSystemPrompt(undefined)).not.toBe(undefined)
		e.__setTestForceActive(false)
		expect(composeAppendSystemPrompt(undefined)).toBe(undefined)
	})
})
