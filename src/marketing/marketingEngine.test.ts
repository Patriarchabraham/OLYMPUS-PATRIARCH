import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
	DEFAULT_MARKETING_CONFIG,
	getMarketingEngine,
	isMarketingActive,
	isMarketingKillSwitchOn,
	resetMarketingEngine,
	resolveMarketingEnabled,
} from './marketingEngine.js'

const originalEnv = process.env.OLYMPUZ_MARKETING_ENABLED

describe('marketing engine — enabled-by-default activation + test-safety', () => {
	beforeEach(() => {
		resetMarketingEngine()
		delete process.env.OLYMPUZ_MARKETING_ENABLED
	})
	afterEach(() => {
		resetMarketingEngine()
		if (originalEnv === undefined) delete process.env.OLYMPUZ_MARKETING_ENABLED
		else process.env.OLYMPUZ_MARKETING_ENABLED = originalEnv
	})

	it('is ENABLED by default (mirrors Studio)', () => {
		expect(DEFAULT_MARKETING_CONFIG.enabled).toBe(true)
		expect(DEFAULT_MARKETING_CONFIG.autoActivate).toBe(true)
		expect(DEFAULT_MARKETING_CONFIG.publish.approvalPolicy).toBe('ask-always')
		expect(DEFAULT_MARKETING_CONFIG.publish.logging).toBe(true)
		// ...but dormant under vitest regardless of config:
		expect(isMarketingActive()).toBe(false)
	})

	it('stays inactive under vitest even when config.enabled is true (test-safety)', () => {
		const engine = getMarketingEngine()
		engine.setConfig({ enabled: true })
		expect(engine.isMarketingActive()).toBe(false)
	})

	it('force-active escape hatch works under vitest', () => {
		const engine = getMarketingEngine()
		engine.__setTestForceActive(true)
		expect(engine.isMarketingActive()).toBe(true)
		expect(isMarketingActive()).toBe(true)
	})

	it('shouldAutoActivate fires on marketing intent (allowed for Marketing, unlike Ops)', () => {
		const engine = getMarketingEngine()
		engine.__setTestForceActive(true)
		expect(engine.shouldAutoActivate('launch campaign for Olympuz')).toBe(true)
		expect(engine.shouldAutoActivate('hello world')).toBe(false)
	})

	it('resolveMarketingEnabled: env wins; acts as a hard kill switch', () => {
		expect(resolveMarketingEnabled({ ...DEFAULT_MARKETING_CONFIG, enabled: true })).toBe(true)
		expect(resolveMarketingEnabled({ ...DEFAULT_MARKETING_CONFIG, enabled: false })).toBe(false)
		process.env.OLYMPUZ_MARKETING_ENABLED = 'false'
		expect(resolveMarketingEnabled({ ...DEFAULT_MARKETING_CONFIG, enabled: true })).toBe(false)
		expect(isMarketingKillSwitchOn()).toBe(true)
		process.env.OLYMPUZ_MARKETING_ENABLED = 'true'
		expect(resolveMarketingEnabled({ ...DEFAULT_MARKETING_CONFIG, enabled: false })).toBe(true)
		expect(isMarketingKillSwitchOn()).toBe(false)
		delete process.env.OLYMPUZ_MARKETING_ENABLED
	})

	it('OLYMPUZ_MARKETING_ENABLED is a HARD kill switch over the force-active hatch', () => {
		const engine = getMarketingEngine()
		engine.__setTestForceActive(true)
		expect(engine.isMarketingActive()).toBe(true)
		process.env.OLYMPUZ_MARKETING_ENABLED = 'false'
		expect(engine.isMarketingActive()).toBe(false)
		delete process.env.OLYMPUZ_MARKETING_ENABLED
	})

	it('applyAdmin threads admin directives into governance', () => {
		const engine = getMarketingEngine()
		engine.__setTestForceActive(true)
		engine.applyAdmin('director.publish.approvalPolicy=ask-always')
		const plan = engine.planCampaign(engine.detectIntent('launch campaign'))
		expect(plan.delegationInstructions).toContain('publish.approvalPolicy = ask-always')
	})

	it('delegates detectIntent / planCampaign / runMarketingCurator', async () => {
		const engine = getMarketingEngine()
		const intent = engine.detectIntent('send an email blast')
		expect(intent.kind).toBe('email')
		const plan = engine.planCampaign(intent)
		expect(plan.tasks.at(-1)!.role).toBe('marketing-curator')
		const { persisted } = await engine.runMarketingCurator({
			brief: 'b',
			kind: 'email',
			copy: [{ name: 'subject', text: 'Olympuz' }],
		})
		expect(persisted).toBeGreaterThan(0)
	})

	it('buildPrdInjection returns the compressed PRD', () => {
		expect(getMarketingEngine().buildPrdInjection().toLowerCase()).toContain('marketing')
	})
})
