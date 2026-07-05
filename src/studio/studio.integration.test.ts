import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getBuiltInAgents } from '../tools/AgentTool/builtInAgents.js'
import { StudioBuildTool } from '../tools/StudioBuildTool/StudioBuildTool.js'
import { resetGlobalGraph } from '../utils/knowledgeGraph.js'
import { knowledgeStats, recallRelevant, runCurator } from './curator.js'
import { composeAppendSystemPrompt } from './inject.js'
import {
	DEFAULT_STUDIO_CONFIG,
	getStudioEngine,
	isStudioActive,
	resetStudioEngine,
} from './studioEngine.js'

describe('studio integration — full flow + test-safety invariants', () => {
	const originalConfigDir = process.env.CLAUDE_CONFIG_DIR
	const configDir = mkdtempSync(join(tmpdir(), 'olympuz-studio-integ-'))
	process.env.CLAUDE_CONFIG_DIR = configDir

	beforeEach(() => {
		resetStudioEngine()
		resetGlobalGraph()
	})

	afterEach(() => {
		resetStudioEngine()
		resetGlobalGraph()
	})

	afterAll(() => {
		resetStudioEngine()
		resetGlobalGraph()
		if (originalConfigDir === undefined) {
			delete process.env.CLAUDE_CONFIG_DIR
		} else {
			process.env.CLAUDE_CONFIG_DIR = originalConfigDir
		}
		rmSync(configDir, { recursive: true, force: true })
	})

	it('INACTIVE by default under vitest: no injection, no studio agents, StudioBuild dormant', () => {
		expect(isStudioActive()).toBe(false)
		expect(composeAppendSystemPrompt(undefined)).toBe(undefined)
		expect(composeAppendSystemPrompt('existing')).toBe('existing')
		const studioAgents = getBuiltInAgents().filter((a) => a.agentType.startsWith('studio-'))
		expect(studioAgents).toHaveLength(0)
		expect(StudioBuildTool.isEnabled()).toBe(false)
	})

	it('ACTIVE when forced: PRD injected, 12 studio agents registered, StudioBuild enabled', () => {
		getStudioEngine().__setTestForceActive(true)
		expect(isStudioActive()).toBe(true)

		const injected = composeAppendSystemPrompt(undefined)
		expect(typeof injected).toBe('string')
		expect(injected!).toContain(DEFAULT_STUDIO_CONFIG.prdVersion)

		const withBase = composeAppendSystemPrompt('base')
		expect(withBase!.startsWith('base\n\n')).toBe(true)

		const studioAgents = getBuiltInAgents().filter((a) => a.agentType.startsWith('studio-'))
		expect(studioAgents).toHaveLength(12)
		expect(studioAgents.map((a) => a.agentType)).toContain('studio-windows')
		expect(StudioBuildTool.isEnabled()).toBe(true)
	})

	it('end-to-end: generateTokens → runCurator → knowledge base persists + is recallable', async () => {
		const engine = getStudioEngine()
		const tokens = engine.generateTokens({ baseColor: '#2563eb', mood: 'calm', platform: 'web' })
		expect(tokens.contrastVerified).toBe(true)

		const before = knowledgeStats().studioEntities
		const { persisted } = await runCurator({
			brief: 'calm fintech landing',
			platform: 'web',
			tokens,
			notes: 'Hero: bank on calm.',
		})
		expect(persisted).toBeGreaterThan(0)
		expect(knowledgeStats().studioEntities).toBe(before + persisted)

		const hit = await recallRelevant('calm tokens')
		expect(hit.toLowerCase()).toContain('studio')
	})

	it('the PRD injection carries the definition-of-done + version', () => {
		getStudioEngine().__setTestForceActive(true)
		const injected = composeAppendSystemPrompt(undefined)!
		expect(injected.toLowerCase()).toContain('definition of done')
		expect(injected).toContain(DEFAULT_STUDIO_CONFIG.prdVersion)
	})
})
