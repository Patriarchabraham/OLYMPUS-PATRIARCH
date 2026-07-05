import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { STUDIO_PRD_VERSION } from '../../studio/principles.js'
import { getStudioEngine, resetStudioEngine } from '../../studio/studioEngine.js'
import { resetGlobalGraph } from '../../utils/knowledgeGraph.js'
import command from './studio.js'

async function run(args: string): Promise<string> {
	const blocks = await (
		command as { getPromptForCommand: (a: string) => Promise<{ type: string; text: string }[]> }
	).getPromptForCommand(args)
	return blocks[0]!.text
}

describe('/studio command', () => {
	const originalConfigDir = process.env.CLAUDE_CONFIG_DIR
	const configDir = mkdtempSync(join(tmpdir(), 'olympuz-studio-cmd-'))
	process.env.CLAUDE_CONFIG_DIR = configDir

	beforeEach(() => {
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

	it('help / empty prints the usage including the PRD version', async () => {
		const help = await run('')
		expect(help).toContain('[Studio]')
		expect(help).toContain(STUDIO_PRD_VERSION)
		expect(help).toContain('/studio run')
		expect(help).toContain('/studio tokens')
	})

	it('run <brief> emits the department plan + tokens digest for a web brief', async () => {
		const out = await run('run build a landing page for a fintech')
		expect(out).toContain('Studio Department')
		expect(out).toContain('studio-web')
		expect(out).toContain('contrastAA=')
		expect(out.toLowerCase()).toContain('execute this plan')
	})

	it('tokens (no platform) emits CSS + Compose Kotlin + WinUI XAML', async () => {
		const out = await run('tokens #2563eb calm')
		expect(out).toContain('CSS custom properties')
		expect(out).toContain('Compose Kotlin')
		expect(out).toContain('WinUI XAML')
		expect(out).toContain('#2563eb')
	})

	it('tokens --platform windows emits only XAML', async () => {
		const out = await run('tokens #2563eb calm --platform windows')
		expect(out).toContain('WinUI XAML')
		expect(out).not.toContain('CSS custom properties')
		expect(out).not.toContain('Compose Kotlin')
	})

	it('principles prints the full PRD', async () => {
		const out = await run('principles')
		expect(out.length).toBeGreaterThan(500)
		expect(out).toContain(STUDIO_PRD_VERSION)
	})

	it('admin list reports defaults when nothing is set', async () => {
		const out = await run('admin list')
		expect(out).toContain('defaults')
	})

	it('admin set applies a directive and admin get reads it back on the same engine', async () => {
		const set = await run('admin set effects.requiredLibs=gsap')
		expect(set).toContain('Applied: effects.requiredLibs=gsap')
		expect(set).toContain('effects.requiredLibs = gsap')
		// The engine is a singleton, so the set persists into the next get.
		const got = await run('admin get effects requiredLibs')
		expect(got).toContain('gsap')
	})

	it('admin set accepts a Director override', async () => {
		const out = await run('admin set director.windows.stack=winui3')
		expect(out).toContain('[director] windows.stack = winui3')
	})

	it('knowledge stats reports counts', async () => {
		const out = await run('knowledge stats')
		expect(out).toContain('Knowledge base')
		expect(out).toMatch(/\d+ studio entities/)
	})

	it('knowledge recall returns a message for an empty graph', async () => {
		const out = await run('knowledge recall color systems')
		expect(out.length).toBeGreaterThan(0)
	})

	it('enable / disable flip the engine config', async () => {
		const en = await run('enable')
		expect(en).toContain('ENABLED')
		expect(getStudioEngine().config.enabled).toBe(true)
		const dis = await run('disable')
		expect(dis).toContain('DISABLED')
		expect(getStudioEngine().config.enabled).toBe(false)
	})

	it('status reports the active flag + config', async () => {
		const out = await run('status')
		expect(out).toContain('isStudioActive()')
		expect(out).toContain('intensity=ultra')
		expect(out).toContain('defaultPlatform=web')
	})

	it('unknown subcommand falls back to help', async () => {
		const out = await run('bogus')
		expect(out).toContain('Unknown subcommand')
		expect(out).toContain('/studio run')
	})
})
