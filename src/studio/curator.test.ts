import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { loadProjectGraph, resetGlobalGraph } from '../utils/knowledgeGraph.js'
import {
	extractAssets,
	knowledgeStats,
	persistAssets,
	recallRelevant,
	recordLearning,
	runCurator,
} from './curator.js'
import { generateDesignTokens } from './designTokens.js'
import type { StudioRunResult } from './types.js'

describe('studio curator — the employee that always updates the database', () => {
	const originalConfigDir = process.env.CLAUDE_CONFIG_DIR
	const configDir = mkdtempSync(join(tmpdir(), 'olympuz-studio-curator-'))
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

	const tokens = generateDesignTokens({ baseColor: '#2563eb', mood: 'calm', platform: 'web' })

	it('extractAssets is pure and mines palette + tokens from a run', () => {
		const run: StudioRunResult = { brief: 'landing page for a fintech', platform: 'web', tokens }
		const assets = extractAssets(run)
		const types = assets.map((a) => a.type)
		expect(types).toContain('studio-palette')
		expect(types).toContain('studio-tokens')
		const palette = assets.find((a) => a.type === 'studio-palette')!
		expect(palette.name).toContain('2563eb')
		expect(palette.attributes.bg).toMatch(/^#?[0-9a-f]{6}$/i)
		expect(palette.attributes.mood).toBe('calm')
		const tok = assets.find((a) => a.type === 'studio-tokens')!
		expect(tok.name).toContain('web')
		expect(tok.attributes.fontFamily.length).toBeGreaterThan(0)
	})

	it('extractAssets adds a copy asset when notes are present', () => {
		const run: StudioRunResult = {
			brief: 'b',
			platform: 'web',
			tokens,
			notes: 'Ship faster today.',
		}
		const assets = extractAssets(run)
		const copy = assets.find((a) => a.type === 'studio-copy')
		expect(copy).toBeDefined()
		expect(copy!.attributes.text).toBe('Ship faster today.')
	})

	it('extractAssets yields nothing when there are no tokens and no notes', () => {
		const run: StudioRunResult = { brief: 'b', platform: 'web' }
		expect(extractAssets(run)).toEqual([])
	})

	it('persistAssets writes entities to the knowledge graph', async () => {
		const run: StudioRunResult = { brief: 'landing page', platform: 'web', tokens }
		const assets = extractAssets(run)
		const n = await persistAssets(assets)
		expect(n).toBe(assets.length)
		const graph = loadProjectGraph(process.cwd())
		const studio = Object.values(graph.entities).filter((e) => e.type.startsWith('studio-'))
		expect(studio.length).toBeGreaterThanOrEqual(2)
	})

	it('runCurator extracts + persists and updates the studio entity count', async () => {
		const run: StudioRunResult = {
			brief: 'fintech landing',
			platform: 'web',
			tokens,
			notes: 'Hero copy.',
		}
		const before = knowledgeStats().studioEntities
		const { assets, persisted } = await runCurator(run)
		expect(persisted).toBe(assets.length)
		expect(knowledgeStats().studioEntities).toBe(before + assets.length)
	})

	it('recallRelevant returns persisted studio knowledge', async () => {
		await runCurator({ brief: 'calm fintech', platform: 'web', tokens })
		const hit = await recallRelevant('calm tokens')
		expect(hit.toLowerCase()).toContain('studio')
	})

	it('recordLearning persists a searchable summary', async () => {
		await recordLearning(
			'GSAP ScrollTrigger pinned hero pin works best with Lenis smooth scroll.',
			['gsap', 'scrolltrigger', 'lenis', 'hero'],
		)
		const hit = await recallRelevant('GSAP ScrollTrigger')
		expect(hit.toLowerCase()).toContain('lenis')
	})

	it('recordLearning ignores empty content', async () => {
		const before = knowledgeStats().summaries
		await recordLearning('   ', ['x'])
		expect(knowledgeStats().summaries).toBe(before)
	})

	it('knowledgeStats reports studio-scoped counts', () => {
		const stats = knowledgeStats()
		expect(typeof stats.entities).toBe('number')
		expect(typeof stats.studioEntities).toBe('number')
		expect(stats.studioEntities).toBeLessThanOrEqual(stats.entities)
	})
})
