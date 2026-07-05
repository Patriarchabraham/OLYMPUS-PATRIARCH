import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { loadProjectGraph, resetGlobalGraph } from '../utils/knowledgeGraph.js'
import {
	extractOpsAssets,
	opsKnowledgeStats,
	persistOpsAssets,
	recallOpsRelevant,
	recordOpsLearning,
	runOpsCurator,
} from './curator.js'
import { planOpsDepartment } from './department.js'
import { detectOpsIntent } from './intent.js'
import type { OpsRunResult } from './types.js'

describe('ops curator — the employee that always updates the database', () => {
	const originalConfigDir = process.env.CLAUDE_CONFIG_DIR
	const configDir = mkdtempSync(join(tmpdir(), 'olympuz-ops-curator-'))
	process.env.CLAUDE_CONFIG_DIR = configDir

	beforeEach(() => {
		resetGlobalGraph()
	})

	afterAll(() => {
		resetGlobalGraph()
		if (originalConfigDir === undefined) {
			delete process.env.CLAUDE_CONFIG_DIR
		} else {
			process.env.CLAUDE_CONFIG_DIR = originalConfigDir
		}
		rmSync(configDir, { recursive: true, force: true })
	})

	it('extractOpsAssets is pure and mines macros + selectors + workflow', () => {
		const plan = planOpsDepartment(detectOpsIntent('open the browser and scrape'), {
			director: { policies: {} },
			admins: {},
		})
		const run: OpsRunResult = {
			brief: 'scrape the leaderboard',
			surface: 'browser',
			plan,
			macros: [{ name: 'login', steps: ['goto example.com', 'click #user', 'type bob'] }],
			selectors: [{ name: 'price', selector: '.price', surface: 'browser' }],
		}
		const assets = extractOpsAssets(run)
		const types = assets.map((a) => a.type)
		expect(types).toContain('ops-macro')
		expect(types).toContain('ops-selector')
		expect(types).toContain('ops-workflow')
		const macro = assets.find((a) => a.type === 'ops-macro')!
		expect(macro.attributes.steps).toContain('click #user')
	})

	it('extractOpsAssets yields nothing for an empty run', () => {
		expect(extractOpsAssets({ brief: 'b', surface: 'computer' })).toEqual([])
	})

	it('persistOpsAssets writes ops entities to the knowledge graph', async () => {
		const run: OpsRunResult = {
			brief: 'open app',
			surface: 'computer',
			selectors: [{ name: 'save', selector: '[aria-label=Save]', surface: 'computer' }],
		}
		const assets = extractOpsAssets(run)
		const n = await persistOpsAssets(assets)
		expect(n).toBe(assets.length)
		const graph = loadProjectGraph(process.cwd())
		const ops = Object.values(graph.entities).filter((e) => e.type.startsWith('ops-'))
		expect(ops.length).toBeGreaterThanOrEqual(1)
	})

	it('runOpsCurator updates the ops entity count', async () => {
		const run: OpsRunResult = {
			brief: 'macro run',
			surface: 'browser',
			macros: [{ name: 'm', steps: ['a', 'b'] }],
		}
		const before = opsKnowledgeStats().opsEntities
		const { persisted } = await runOpsCurator(run)
		expect(persisted).toBeGreaterThan(0)
		expect(opsKnowledgeStats().opsEntities).toBe(before + persisted)
	})

	it('recallRelevant returns persisted ops knowledge', async () => {
		await runOpsCurator({
			brief: 'browser scrape',
			surface: 'browser',
			selectors: [{ name: 'price', selector: '.price', surface: 'browser' }],
		})
		const hit = await recallOpsRelevant('browser selector price')
		expect(hit.toLowerCase()).toContain('ops')
	})

	it('recordLearning persists a searchable summary and ignores empties', async () => {
		const before = opsKnowledgeStats().summaries
		await recordOpsLearning('Playwright waitUntil=domcontentloaded avoids timeout on SPAs.', [
			'playwright',
			'spa',
			'wait',
		])
		expect(opsKnowledgeStats().summaries).toBe(before + 1)
		await recordOpsLearning('   ', ['x'])
		expect(opsKnowledgeStats().summaries).toBe(before + 1)
	})
})
