import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { getMarketingEngine, resetMarketingEngine } from '../../marketing/marketingEngine.js'
import { MARKETING_PRD_VERSION } from '../../marketing/principles.js'
import { resetGlobalGraph } from '../../utils/knowledgeGraph.js'
import command from './marketing.js'

const originalEnv = process.env.OLYMPUZ_MARKETING_ENABLED

async function run(args: string): Promise<string> {
	const blocks = await (
		command as { getPromptForCommand: (a: string) => Promise<{ type: string; text: string }[]> }
	).getPromptForCommand(args)
	return blocks[0]!.text
}

describe('/marketing command', () => {
	const originalConfigDir = process.env.CLAUDE_CONFIG_DIR
	const configDir = mkdtempSync(join(tmpdir(), 'olympuz-mkt-cmd-'))
	process.env.CLAUDE_CONFIG_DIR = configDir

	beforeEach(() => {
		resetMarketingEngine()
		resetGlobalGraph()
		delete process.env.OLYMPUZ_MARKETING_ENABLED
	})

	afterAll(() => {
		resetMarketingEngine()
		resetGlobalGraph()
		if (originalEnv === undefined) delete process.env.OLYMPUZ_MARKETING_ENABLED
		else process.env.OLYMPUZ_MARKETING_ENABLED = originalEnv
		if (originalConfigDir === undefined) delete process.env.CLAUDE_CONFIG_DIR
		else process.env.CLAUDE_CONFIG_DIR = originalConfigDir
		rmSync(configDir, { recursive: true, force: true })
	})

	it('help / empty prints the usage including the PRD version + publish-gate notice', async () => {
		const help = await run('')
		expect(help).toContain('[Marketing]')
		expect(help).toContain(MARKETING_PRD_VERSION)
		expect(help).toContain('/marketing run')
		expect(help).toContain('/marketing review')
		expect(help.toLowerCase()).toContain('approval')
	})

	it('run <brief> emits the campaign plan for a campaign brief', async () => {
		const out = await run('run launch a campaign for Olympuz on x and linkedin')
		expect(out).toContain('Marketing Department')
		expect(out).toContain('kind=')
		expect(out.toLowerCase()).toContain('execute this plan')
	})

	it('review reports nothing published yet on a fresh log', async () => {
		const out = await run('review')
		expect(out).toContain('[Marketing review]')
		expect(out.toLowerCase()).toContain('no published')
	})

	it('principles prints the full PRD', async () => {
		const out = await run('principles')
		expect(out.length).toBeGreaterThan(500)
		expect(out).toContain(MARKETING_PRD_VERSION)
	})

	it('admin list reports defaults when nothing is set', async () => {
		const out = await run('admin list')
		expect(out).toContain('defaults')
	})

	it('admin set applies a directive and admin get reads it back on the same engine', async () => {
		const set = await run('admin set social.channels=x,linkedin')
		expect(set).toContain('Applied: social.channels=x,linkedin')
		expect(set).toContain('social.channels = x|linkedin')
		const got = await run('admin get social channels')
		expect(got).toContain('x')
	})

	it('admin set accepts a Director override', async () => {
		const out = await run('admin set director.publish.approvalPolicy=ask-always')
		expect(out).toContain('[director] publish.approvalPolicy = ask-always')
	})

	it('knowledge stats reports counts', async () => {
		const out = await run('knowledge stats')
		expect(out).toContain('Knowledge base')
		expect(out).toMatch(/\d+ marketing entities/)
	})

	it('enable / disable flip the engine config', async () => {
		const en = await run('enable')
		expect(en).toContain('ENABLED')
		expect(getMarketingEngine().config.enabled).toBe(true)
		const dis = await run('disable')
		expect(dis).toContain('DISABLED')
		expect(getMarketingEngine().config.enabled).toBe(false)
	})

	it('status reports the active flag + config + kill-switch env', async () => {
		const out = await run('status')
		expect(out).toContain('isMarketingActive()')
		expect(out).toContain('OLYMPUZ_MARKETING_ENABLED=')
	})

	it('unknown subcommand falls back to help', async () => {
		const out = await run('bogus')
		expect(out).toContain('Unknown subcommand')
		expect(out).toContain('/marketing run')
	})
})
