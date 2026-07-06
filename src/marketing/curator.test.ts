import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { loadProjectGraph, resetGlobalGraph } from '../utils/knowledgeGraph.js'
import {
	extractMarketingAssets,
	marketingKnowledgeStats,
	persistMarketingAssets,
	recallMarketingRelevant,
	recordMarketingLearning,
	runMarketingCurator,
} from './curator.js'
import { planCampaign } from './department.js'
import { detectMarketingIntent } from './intent.js'
import type { MarketingRunResult } from './types.js'

describe('marketing curator — the employee that always updates the database', () => {
	const originalConfigDir = process.env.CLAUDE_CONFIG_DIR
	const configDir = mkdtempSync(join(tmpdir(), 'olympuz-mkt-curator-'))
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

	it('extractMarketingAssets is pure and mines creative + copy + audience + campaign', () => {
		const plan = planCampaign(detectMarketingIntent('launch campaign'), {
			director: { policies: {} },
			admins: {},
		})
		const run: MarketingRunResult = {
			brief: 'launch Olympuz',
			kind: 'campaign',
			plan,
			creatives: [{ name: 'hero', medium: 'image', prompt: 'on-brand hero shot' }],
			copy: [{ name: 'headline', text: 'Ship campaigns in minutes' }],
			audience: 'technical founders',
		}
		const assets = extractMarketingAssets(run)
		const types = assets.map((a) => a.type)
		expect(types).toContain('marketing-creative')
		expect(types).toContain('marketing-copy')
		expect(types).toContain('marketing-audience')
		expect(types).toContain('marketing-campaign')
		const creative = assets.find((a) => a.type === 'marketing-creative')!
		expect(creative.attributes.prompt).toContain('on-brand hero shot')
	})

	it('extractMarketingAssets yields nothing for an empty run', () => {
		expect(extractMarketingAssets({ brief: 'b', kind: 'campaign' })).toEqual([])
	})

	it('persistMarketingAssets writes marketing entities to the knowledge graph', async () => {
		const run: MarketingRunResult = {
			brief: 'open',
			kind: 'social',
			copy: [{ name: 'tweet', text: 'hello Olympuz' }],
		}
		const assets = extractMarketingAssets(run)
		const n = await persistMarketingAssets(assets)
		expect(n).toBe(assets.length)
		const graph = loadProjectGraph(process.cwd())
		const mkt = Object.values(graph.entities).filter((e) => e.type.startsWith('marketing-'))
		expect(mkt.length).toBeGreaterThanOrEqual(1)
	})

	it('runMarketingCurator updates the marketing entity count', async () => {
		const run: MarketingRunResult = {
			brief: 'video run',
			kind: 'video',
			creatives: [{ name: 'promo', medium: 'video', prompt: 'hook in 1s' }],
		}
		const before = marketingKnowledgeStats().marketingEntities
		const { persisted } = await runMarketingCurator(run)
		expect(persisted).toBeGreaterThan(0)
		expect(marketingKnowledgeStats().marketingEntities).toBe(before + persisted)
	})

	it('recallMarketingRelevant returns persisted marketing knowledge', async () => {
		await runMarketingCurator({
			brief: 'copy run',
			kind: 'content',
			copy: [{ name: 'headline', text: 'Olympuz headline' }],
		})
		const hit = await recallMarketingRelevant('marketing copy headline')
		expect(hit.toLowerCase()).toContain('marketing')
	})

	it('recordMarketingLearning persists a searchable summary and ignores empties', async () => {
		const before = marketingKnowledgeStats().summaries
		await recordMarketingLearning('Shorts with captions burned in outperform sound-off 2x.', [
			'shorts',
			'captions',
			'video',
		])
		expect(marketingKnowledgeStats().summaries).toBe(before + 1)
		await recordMarketingLearning('   ', ['x'])
		expect(marketingKnowledgeStats().summaries).toBe(before + 1)
	})
})
