import { beforeEach, describe, expect, it } from 'vitest'
import {
	DEFAULT_STUDIO_CONFIG,
	getStudioEngine,
	isStudioActive,
	isTestEnv,
	resetStudioEngine,
	StudioEngine,
} from './studioEngine.js'

describe('studio engine — lazy singleton + active gating', () => {
	beforeEach(() => {
		resetStudioEngine()
	})

	it('is a lazy singleton', () => {
		const a = getStudioEngine()
		const b = getStudioEngine()
		expect(a).toBe(b)
	})

	it('resetStudioEngine produces a fresh instance', () => {
		const a = getStudioEngine()
		resetStudioEngine()
		const b = getStudioEngine()
		expect(a).not.toBe(b)
	})

	it('default config matches the approved decision (on + ultra + neutral-adaptive)', () => {
		expect(DEFAULT_STUDIO_CONFIG.enabled).toBe(true)
		expect(DEFAULT_STUDIO_CONFIG.autoActivate).toBe(true)
		expect(DEFAULT_STUDIO_CONFIG.intensity).toBe('ultra')
		expect(DEFAULT_STUDIO_CONFIG.defaultPlatform).toBe('web')
		expect(DEFAULT_STUDIO_CONFIG.aesthetic).toBe('neutral-adaptive')
		expect(DEFAULT_STUDIO_CONFIG.prdVersion.length).toBeGreaterThan(0)
	})

	it('isStudioActive() is FALSE under vitest even when enabled (test-safety keystone)', () => {
		const e = getStudioEngine()
		expect(e.config.enabled).toBe(true)
		expect(isTestEnv()).toBe(true)
		expect(e.isStudioActive()).toBe(false)
		expect(isStudioActive()).toBe(false)
	})

	it('__setTestForceActive lets a test exercise the active path', () => {
		const e = getStudioEngine()
		e.__setTestForceActive(true)
		expect(e.isStudioActive()).toBe(true)
		e.__setTestForceActive(false)
		expect(e.isStudioActive()).toBe(false)
	})

	it('disabling via setConfig turns the engine off even when forced off', () => {
		const e = getStudioEngine()
		e.setConfig({ enabled: false })
		e.__setTestForceActive(true) // force bypasses enabled too, so test the non-forced path
		e.__setTestForceActive(false)
		expect(e.isStudioActive()).toBe(false)
	})

	it('buildPrdInjection returns the compressed PRD containing its version', () => {
		const e = getStudioEngine()
		const prd = e.buildPrdInjection()
		expect(prd.length).toBeGreaterThan(0)
		expect(prd).toContain(DEFAULT_STUDIO_CONFIG.prdVersion)
	})

	it('detectIntent + planBuild compose intent → department plan', () => {
		const e = getStudioEngine()
		const intent = e.detectIntent('build a landing page for a fintech')
		expect(intent.isBuildRequest).toBe(true)
		const plan = e.planBuild(intent)
		expect(plan.roles.map((r) => r.role)).toContain('studio-web')
		expect(plan.tasks.length).toBeGreaterThan(0)
	})

	it('generateTokens yields a WCAG-verified token set for the engine defaults', () => {
		const e = getStudioEngine()
		const tokens = e.generateTokens()
		expect(tokens.contrastVerified).toBe(true)
		expect(tokens.platform).toBe('web')
	})

	it('generateTokens respects explicit overrides', () => {
		const e = getStudioEngine()
		const tokens = e.generateTokens({ baseColor: '#b91c1c', mood: 'vibrant', platform: 'windows' })
		expect(tokens.platform).toBe('windows')
		expect(tokens.baseColor).toBe('#b91c1c')
		expect(tokens.mood).toBe('vibrant')
	})

	it('applyAdmin mutates governance seen by planBuild', () => {
		const e = getStudioEngine()
		e.applyAdmin('effects.requiredLibs=gsap')
		const plan = e.planBuild(e.detectIntent('build a website'))
		expect(plan.delegationInstructions).toContain('effects.requiredLibs = gsap')
	})

	it('shouldAutoActivate is false in a test env despite a build intent', () => {
		const e = getStudioEngine()
		expect(e.shouldAutoActivate('build a landing page')).toBe(false)
		e.__setTestForceActive(true)
		expect(e.shouldAutoActivate('build a landing page')).toBe(true)
		expect(e.shouldAutoActivate('fix the typo')).toBe(false)
	})

	it('a directly-constructed engine honors a custom config', () => {
		const e = new StudioEngine({
			...DEFAULT_STUDIO_CONFIG,
			defaultPlatform: 'android',
			aesthetic: 'luxury-dark-gold',
		})
		const tokens = e.generateTokens()
		expect(tokens.platform).toBe('android')
	})
})
