import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
	MARKETING_AGENT_TYPES,
	MARKETING_AGENTS,
} from '../tools/AgentTool/built-in/marketingAgents.js'
import { getBuiltInAgents } from '../tools/AgentTool/builtInAgents.js'
import { MarketingBuildTool } from '../tools/MarketingBuildTool/MarketingBuildTool.js'
import { resetGlobalGraph } from '../utils/knowledgeGraph.js'
import { runMarketingCurator } from './curator.js'
import { composeMarketingAppendSystemPrompt } from './inject.js'
import {
	DEFAULT_MARKETING_CONFIG,
	getMarketingEngine,
	isMarketingActive,
	resetMarketingEngine,
} from './marketingEngine.js'

describe('marketing integration — full flow + test-safety invariants', () => {
	const originalConfigDir = process.env.CLAUDE_CONFIG_DIR
	const originalEnv = process.env.OLYMPUZ_MARKETING_ENABLED
	const configDir = mkdtempSync(join(tmpdir(), 'olympuz-mkt-integ-'))
	process.env.CLAUDE_CONFIG_DIR = configDir

	beforeEach(() => {
		resetMarketingEngine()
		resetGlobalGraph()
		delete process.env.OLYMPUZ_MARKETING_ENABLED
	})

	afterEach(() => {
		resetMarketingEngine()
		resetGlobalGraph()
	})

	afterAll(() => {
		resetMarketingEngine()
		resetGlobalGraph()
		if (originalConfigDir === undefined) delete process.env.CLAUDE_CONFIG_DIR
		else process.env.CLAUDE_CONFIG_DIR = originalConfigDir
		if (originalEnv === undefined) delete process.env.OLYMPUZ_MARKETING_ENABLED
		else process.env.OLYMPUZ_MARKETING_ENABLED = originalEnv
		rmSync(configDir, { recursive: true, force: true })
	})

	it('INACTIVE by default under vitest: no injection, no marketing agents, MarketingBuild dormant', () => {
		expect(isMarketingActive()).toBe(false)
		expect(composeMarketingAppendSystemPrompt(undefined)).toBe(undefined)
		expect(composeMarketingAppendSystemPrompt('existing')).toBe('existing')
		const mktAgents = getBuiltInAgents().filter((a) => a.agentType.startsWith('marketing-'))
		expect(mktAgents).toHaveLength(0)
		expect(MarketingBuildTool.isEnabled()).toBe(false)
	})

	it('stays inactive under vitest even when config.enabled is flipped (test-safety)', () => {
		getMarketingEngine().setConfig({ enabled: true })
		expect(isMarketingActive()).toBe(false)
		const mktAgents = getBuiltInAgents().filter((a) => a.agentType.startsWith('marketing-'))
		expect(mktAgents).toHaveLength(0)
	})

	it('OLYMPUZ_MARKETING_ENABLED is a hard kill switch', () => {
		getMarketingEngine().__setTestForceActive(true)
		expect(isMarketingActive()).toBe(true)
		process.env.OLYMPUZ_MARKETING_ENABLED = 'false'
		expect(isMarketingActive()).toBe(false)
		delete process.env.OLYMPUZ_MARKETING_ENABLED
	})

	it('ACTIVE when forced: PRD injected with version + the publish gate', () => {
		getMarketingEngine().__setTestForceActive(true)
		expect(isMarketingActive()).toBe(true)
		const injected = composeMarketingAppendSystemPrompt(undefined)!
		expect(typeof injected).toBe('string')
		expect(injected).toContain(DEFAULT_MARKETING_CONFIG.prdVersion)
		expect(injected.toLowerCase()).toContain('marketing')
		expect(injected.toLowerCase()).toContain('approval')
		const withBase = composeMarketingAppendSystemPrompt('base')!
		expect(withBase.startsWith('base')).toBe(true)
		expect(withBase.length).toBeGreaterThan('base'.length)
	})

	it('ACTIVE when forced: 9 marketing agents registered + MarketingBuild enabled', () => {
		getMarketingEngine().__setTestForceActive(true)
		const mktAgents = getBuiltInAgents().filter((a) => a.agentType.startsWith('marketing-'))
		expect(mktAgents).toHaveLength(MARKETING_AGENTS.length)
		for (const t of [
			'marketing-director',
			'marketing-strategist',
			'marketing-social-manager',
			'marketing-email-manager',
			'marketing-curator',
		]) {
			expect(MARKETING_AGENT_TYPES.has(t)).toBe(true)
		}
		expect(MarketingBuildTool.isEnabled()).toBe(true)
	})

	it('end-to-end: planCampaign → runMarketingCurator → knowledge base persists + is recallable', async () => {
		const engine = getMarketingEngine()
		const plan = engine.planCampaign(engine.detectIntent('launch campaign for Olympuz'))
		expect(plan.tasks.at(-1)!.role).toBe('marketing-curator')

		const { persisted } = await runMarketingCurator({
			brief: 'launch Olympuz',
			kind: 'campaign',
			plan,
			creatives: [{ name: 'hero', medium: 'image', prompt: 'on-brand hero' }],
			copy: [{ name: 'headline', text: 'Ship campaigns in minutes' }],
		})
		expect(persisted).toBeGreaterThan(0)

		const hit = await engine
			.runMarketingCurator({ brief: 'recall', kind: 'campaign' })
			.then(async () =>
				(await import('./curator.js')).recallMarketingRelevant('marketing campaign'),
			)
		expect(hit.toLowerCase()).toContain('marketing')
	})
})
