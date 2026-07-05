import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
	DEFAULT_OPS_CONFIG,
	getOpsEngine,
	isOpsActive,
	resetOpsEngine,
	resolveEnabled,
} from './opsEngine.js'

const originalEnv = process.env.OLYMPUZ_OPS_ENABLED

describe('ops engine — opt-in activation + test-safety', () => {
	beforeEach(() => {
		resetOpsEngine()
		delete process.env.OLYMPUZ_OPS_ENABLED
	})
	afterEach(() => {
		resetOpsEngine()
		if (originalEnv === undefined) delete process.env.OLYMPUZ_OPS_ENABLED
		else process.env.OLYMPUZ_OPS_ENABLED = originalEnv
	})

	it('is OPT-IN: disabled by default', () => {
		expect(DEFAULT_OPS_CONFIG.enabled).toBe(false)
		expect(DEFAULT_OPS_CONFIG.autoActivate).toBe(false)
		expect(isOpsActive()).toBe(false)
	})

	it('stays inactive under vitest even when config.enabled is flipped (test-safety)', () => {
		const engine = getOpsEngine()
		engine.setConfig({ enabled: true })
		expect(engine.isOpsActive()).toBe(false) // because isTestEnv()
	})

	it('force-active escape hatch works under vitest', () => {
		const engine = getOpsEngine()
		engine.__setTestForceActive(true)
		expect(engine.isOpsActive()).toBe(true)
		expect(isOpsActive()).toBe(true)
	})

	it('shouldAutoActivate is always false (explicit opt-in only)', () => {
		const engine = getOpsEngine()
		engine.__setTestForceActive(true)
		expect(engine.shouldAutoActivate('control my pc and click')).toBe(false)
	})

	it('resolveEnabled: env wins; acts as a hard kill switch', () => {
		expect(resolveEnabled({ ...DEFAULT_OPS_CONFIG, enabled: false })).toBe(false)
		expect(resolveEnabled({ ...DEFAULT_OPS_CONFIG, enabled: true })).toBe(true)
		process.env.OLYMPUZ_OPS_ENABLED = 'true'
		expect(resolveEnabled({ ...DEFAULT_OPS_CONFIG, enabled: false })).toBe(true)
		process.env.OLYMPUZ_OPS_ENABLED = '0'
		expect(resolveEnabled({ ...DEFAULT_OPS_CONFIG, enabled: true })).toBe(false) // kill switch
		delete process.env.OLYMPUZ_OPS_ENABLED
	})

	it('delegates detectIntent / planOps / runOpsCurator', async () => {
		const engine = getOpsEngine()
		const intent = engine.detectIntent('open the browser and scrape')
		expect(intent.surface).toBe('browser')
		const plan = engine.planOps(intent)
		expect(plan.roles.length).toBeGreaterThan(0)
		expect(plan.tasks.at(-1)!.role).toBe('ops-curator')
		const { persisted } = await engine.runOpsCurator({
			brief: 'b',
			surface: 'browser',
			selectors: [{ name: 'x', selector: '.x', surface: 'browser' }],
		})
		expect(persisted).toBeGreaterThan(0)
	})

	it('buildPrdInjection returns the compressed PRD', () => {
		expect(getOpsEngine().buildPrdInjection().toLowerCase()).toContain('agentic operations')
	})
})
