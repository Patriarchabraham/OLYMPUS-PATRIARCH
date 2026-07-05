import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest'
import { OPS_AGENT_TYPES, OPS_AGENTS } from '../tools/AgentTool/built-in/opsAgents.js'
import { getBuiltInAgents } from '../tools/AgentTool/builtInAgents.js'
import { OpsBuildTool } from '../tools/OpsBuildTool/OpsBuildTool.js'
import { resetGlobalGraph } from '../utils/knowledgeGraph.js'
import { runOpsCurator } from './curator.js'
import { composeOpsAppendSystemPrompt } from './inject.js'
import { DEFAULT_OPS_CONFIG, getOpsEngine, isOpsActive, resetOpsEngine } from './opsEngine.js'

describe('ops integration — full flow + test-safety invariants', () => {
	const originalConfigDir = process.env.CLAUDE_CONFIG_DIR
	const originalEnv = process.env.OLYMPUZ_OPS_ENABLED
	const configDir = mkdtempSync(join(tmpdir(), 'olympuz-ops-integ-'))
	process.env.CLAUDE_CONFIG_DIR = configDir

	beforeEach(() => {
		resetOpsEngine()
		resetGlobalGraph()
		delete process.env.OLYMPUZ_OPS_ENABLED
	})

	afterEach(() => {
		resetOpsEngine()
		resetGlobalGraph()
	})

	afterAll(() => {
		resetOpsEngine()
		resetGlobalGraph()
		if (originalConfigDir === undefined) delete process.env.CLAUDE_CONFIG_DIR
		else process.env.CLAUDE_CONFIG_DIR = originalConfigDir
		if (originalEnv === undefined) delete process.env.OLYMPUZ_OPS_ENABLED
		else process.env.OLYMPUZ_OPS_ENABLED = originalEnv
		rmSync(configDir, { recursive: true, force: true })
	})

	it('INACTIVE by default under vitest: no injection, no ops agents, OpsBuild dormant', () => {
		expect(isOpsActive()).toBe(false)
		expect(composeOpsAppendSystemPrompt(undefined)).toBe(undefined)
		expect(composeOpsAppendSystemPrompt('existing')).toBe('existing')
		const opsAgents = getBuiltInAgents().filter((a) => a.agentType.startsWith('ops-'))
		expect(opsAgents).toHaveLength(0)
		expect(OpsBuildTool.isEnabled()).toBe(false)
	})

	it('stays inactive under vitest even when config.enabled is flipped (test-safety)', () => {
		getOpsEngine().setConfig({ enabled: true })
		expect(isOpsActive()).toBe(false)
		expect(OpsBuildTool.isEnabled()).toBe(false)
		const opsAgents = getBuiltInAgents().filter((a) => a.agentType.startsWith('ops-'))
		expect(opsAgents).toHaveLength(0)
	})

	it('OLYMPUZ_OPS_ENABLED is a hard kill switch', () => {
		getOpsEngine().__setTestForceActive(true)
		expect(isOpsActive()).toBe(true)
		process.env.OLYMPUZ_OPS_ENABLED = 'false'
		expect(isOpsActive()).toBe(false)
		delete process.env.OLYMPUZ_OPS_ENABLED
	})

	it('ACTIVE when forced: PRD injected, 10 ops agents registered, OpsBuild enabled', () => {
		getOpsEngine().__setTestForceActive(true)
		expect(isOpsActive()).toBe(true)

		const injected = composeOpsAppendSystemPrompt(undefined)
		expect(typeof injected).toBe('string')
		expect(injected!).toContain(DEFAULT_OPS_CONFIG.prdVersion)
		expect(injected!.toLowerCase()).toContain('agentic operations')

		const withBase = composeOpsAppendSystemPrompt('base')
		expect(withBase!.startsWith('base')).toBe(true)
		expect(withBase!.length).toBeGreaterThan('base'.length)

		const opsAgents = getBuiltInAgents().filter((a) => a.agentType.startsWith('ops-'))
		expect(opsAgents).toHaveLength(OPS_AGENTS.length)
		for (const t of [
			'ops-director',
			'ops-computer-operator',
			'ops-browser-operator',
			'ops-sentinel',
			'ops-curator',
		]) {
			expect(OPS_AGENT_TYPES.has(t)).toBe(true)
		}
		expect(OpsBuildTool.isEnabled()).toBe(true)
	})

	it('end-to-end: planOps → runOpsCurator → knowledge base persists + is recallable', async () => {
		const engine = getOpsEngine()
		const plan = engine.planOps(engine.detectIntent('open the browser and scrape the leaderboard'))
		expect(plan.tasks.at(-1)!.role).toBe('ops-curator')

		const { persisted } = await runOpsCurator({
			brief: 'scrape leaderboard',
			surface: 'browser',
			plan,
			selectors: [{ name: 'price', selector: '.price', surface: 'browser' }],
		})
		expect(persisted).toBeGreaterThan(0)

		const hit = await engine
			.runOpsCurator({
				brief: 'recall',
				surface: 'browser',
			})
			.then(async () => (await import('./curator.js')).recallOpsRelevant('browser selector price'))
		expect(hit.toLowerCase()).toContain('ops')
	})

	it('the PRD injection carries the safety bar + version', () => {
		getOpsEngine().__setTestForceActive(true)
		const injected = composeOpsAppendSystemPrompt(undefined)!
		expect(injected.toLowerCase()).toContain('approval')
		expect(injected).toContain(DEFAULT_OPS_CONFIG.prdVersion)
	})
})
