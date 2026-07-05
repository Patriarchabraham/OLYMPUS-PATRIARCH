import { afterEach, describe, expect, it } from 'vitest'
import { getStudioEngine, resetStudioEngine } from '../studio/studioEngine.js'
import { composeAllDepartmentInjections } from './inject.js'

describe('departments inject — composeAllDepartmentInjections (RISK-1 keystone)', () => {
	afterEach(() => {
		resetStudioEngine()
	})

	it('is a pass-through when no department is active (default under vitest)', () => {
		expect(composeAllDepartmentInjections(undefined)).toBe(undefined)
		expect(composeAllDepartmentInjections('you are helpful')).toBe('you are helpful')
	})

	it('does not rename or alter Studio contribution — stacks Studio PRD when Studio is forced active', () => {
		getStudioEngine().__setTestForceActive(true)
		const out = composeAllDepartmentInjections(undefined) as string
		expect(out).toBeTruthy()
		expect(out.toLowerCase()).toContain('studio')
		const withBase = composeAllDepartmentInjections('base prompt') as string
		expect(withBase.startsWith('base prompt')).toBe(true)
		expect(withBase.length).toBeGreaterThan('base prompt'.length)
	})

	it('returns the base unchanged when the active contribution is empty', () => {
		// Studio inactive (default) -> orchestrator must not invent content.
		expect(composeAllDepartmentInjections('base')).toBe('base')
	})
})
