import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { getOpsEngine, resetOpsEngine } from '../../ops/opsEngine.js'
import { OPS_PRD_VERSION } from '../../ops/principles.js'
import { resetGlobalGraph } from '../../utils/knowledgeGraph.js'
import command from './ops.js'

const originalEnv = process.env.OLYMPUZ_OPS_ENABLED

async function run(args: string): Promise<string> {
	const blocks = await (
		command as { getPromptForCommand: (a: string) => Promise<{ type: string; text: string }[]> }
	).getPromptForCommand(args)
	return blocks[0]!.text
}

describe('/ops command', () => {
	const originalConfigDir = process.env.CLAUDE_CONFIG_DIR
	const configDir = mkdtempSync(join(tmpdir(), 'olympuz-ops-cmd-'))
	process.env.CLAUDE_CONFIG_DIR = configDir

	beforeEach(() => {
		resetOpsEngine()
		resetGlobalGraph()
		delete process.env.OLYMPUZ_OPS_ENABLED
	})

	afterAll(() => {
		resetOpsEngine()
		resetGlobalGraph()
		if (originalEnv === undefined) delete process.env.OLYMPUZ_OPS_ENABLED
		else process.env.OLYMPUZ_OPS_ENABLED = originalEnv
		if (originalConfigDir === undefined) delete process.env.CLAUDE_CONFIG_DIR
		else process.env.CLAUDE_CONFIG_DIR = originalConfigDir
		rmSync(configDir, { recursive: true, force: true })
	})

	it('help / empty prints the usage including the PRD version + opt-in notice', async () => {
		const help = await run('')
		expect(help).toContain('[Ops]')
		expect(help).toContain(OPS_PRD_VERSION)
		expect(help).toContain('/ops run')
		expect(help).toContain('/ops team')
		expect(help.toLowerCase()).toContain('opt-in')
	})

	it('run <task> emits the department plan for a browser task', async () => {
		const out = await run('run open the browser and scrape the leaderboard')
		expect(out).toContain('Ops Department')
		expect(out).toContain('surface=browser')
		expect(out.toLowerCase()).toContain('execute this plan')
	})

	it('team list describes the native swarm capability', async () => {
		const out = await run('team list')
		expect(out).toContain('[Ops team capability]')
		expect(out).toContain('TeamCreate')
		expect(out).toContain('subagent_type')
	})

	it('team new <goal> plans a specialist roster', async () => {
		const out = await run('team new monitor the dashboard and alert me')
		expect(out).toContain('[Ops team plan]')
		expect(out).toContain('ops-director')
	})

	it('team spawn <role> tells the model how to spawn one specialist', async () => {
		const out = await run('team spawn ops-browser-operator')
		expect(out).toContain('subagent_type="ops-browser-operator"')
	})

	it('review reports knowledge + state', async () => {
		const out = await run('review')
		expect(out).toContain('[Ops review]')
		expect(out).toContain('Knowledge base')
	})

	it('principles prints the full PRD', async () => {
		const out = await run('principles')
		expect(out.length).toBeGreaterThan(500)
		expect(out).toContain(OPS_PRD_VERSION)
	})

	it('admin list reports defaults when nothing is set', async () => {
		const out = await run('admin list')
		expect(out).toContain('defaults')
	})

	it('admin set applies a directive and admin get reads it back on the same engine', async () => {
		const set = await run('admin set browser.scope=example.com,github.com')
		expect(set).toContain('Applied: browser.scope=example.com,github.com')
		expect(set).toContain('browser.scope = example.com|github.com')
		const got = await run('admin get browser scope')
		expect(got).toContain('example.com')
	})

	it('admin set accepts a Director override', async () => {
		const out = await run('admin set director.computer.approvalPolicy=ask-always')
		expect(out).toContain('[director] computer.approvalPolicy = ask-always')
	})

	it('knowledge stats reports counts', async () => {
		const out = await run('knowledge stats')
		expect(out).toContain('Knowledge base')
		expect(out).toMatch(/\d+ ops entities/)
	})

	it('knowledge recall returns a message for an empty graph', async () => {
		const out = await run('knowledge recall login macro')
		expect(out.length).toBeGreaterThan(0)
	})

	it('enable / disable flip the engine config', async () => {
		const en = await run('enable')
		expect(en).toContain('ENABLED')
		expect(getOpsEngine().config.enabled).toBe(true)
		const dis = await run('disable')
		expect(dis).toContain('DISABLED')
		expect(getOpsEngine().config.enabled).toBe(false)
	})

	it('status reports the active flag + config + kill-switch env', async () => {
		const out = await run('status')
		expect(out).toContain('isOpsActive()')
		expect(out).toContain('approvalPolicy=ask-destructive')
		expect(out).toContain('OLYMPUZ_OPS_ENABLED=')
	})

	it('unknown subcommand falls back to help', async () => {
		const out = await run('bogus')
		expect(out).toContain('Unknown subcommand')
		expect(out).toContain('/ops run')
	})
})
