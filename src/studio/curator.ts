/**
 * Olympuz Studio — Curator.
 *
 * This is the agentic "employee that always updates the database." After a
 * department run, the curator mines the result for REUSABLE assets (the color
 * system, the token set, any copy) and persists them to the project knowledge
 * graph, so the next build in the same vein starts from accumulated taste
 * rather than zero. It can also recall what is relevant to a new brief.
 *
 * This is the ONLY studio module that touches the knowledge graph.
 *
 * `extractAssets` is pure; the rest are thin async wrappers over the KG API.
 */

import {
	addGlobalEntity,
	addGlobalSummary,
	getGlobalGraph,
	searchGlobalGraph,
} from '../utils/knowledgeGraph.js'
import type { DesignTokens, StudioAsset, StudioRunResult } from './types.js'

/** Stringify a value for KG attribute storage (attributes are Record<string,string>). */
function str(v: unknown): string {
	if (typeof v === 'string') return v
	if (typeof v === 'number' || typeof v === 'boolean') return String(v)
	return JSON.stringify(v)
}

function paletteAttributes(tokens: DesignTokens): Record<string, string> {
	const s = tokens.color.semantic
	return {
		base: tokens.baseColor,
		mood: tokens.mood,
		platform: tokens.platform,
		contrastVerified: str(tokens.contrastVerified),
		bg: s.bg.hex,
		fg: s.fg.hex,
		accent: s.accent.hex,
		accentFg: s.accentFg.hex,
		border: s.border.hex,
		muted: s.muted.hex,
		surface: s.surface.hex,
	}
}

function tokensAttributes(tokens: DesignTokens): Record<string, string> {
	const t = tokens.typography
	return {
		mood: tokens.mood,
		platform: tokens.platform,
		base: tokens.baseColor,
		fontFamily: t.fontFamily,
		fontFamilyDisplay: t.fontFamilyDisplay,
		baseSize: str(t.sizes.base),
		radius2xl: str(tokens.radius['2xl']),
		spacing: tokens.spacing.join('|'),
		motionFast: str(tokens.motion.duration.fast),
		motionBase: str(tokens.motion.duration.base),
		contrastVerified: str(tokens.contrastVerified),
	}
}

/**
 * Mine a completed run for reusable assets. Pure — no I/O.
 * Yields a studio-palette + studio-tokens asset when tokens are present, and a
 * studio-copy asset when the run carried copy/notes.
 */
export function extractAssets(runResult: StudioRunResult): StudioAsset[] {
	const assets: StudioAsset[] = []

	if (runResult.tokens) {
		const tokens = runResult.tokens
		const baseTag =
			tokens.baseColor === 'neutral-adaptive' ? 'neutral' : tokens.baseColor.replace('#', '')
		assets.push({
			type: 'studio-palette',
			name: `palette:${baseTag}:${tokens.mood}`,
			attributes: paletteAttributes(tokens),
		})
		assets.push({
			type: 'studio-tokens',
			name: `tokens:${tokens.platform}:${tokens.mood}`,
			attributes: tokensAttributes(tokens),
		})
	}

	if (runResult.notes && runResult.notes.trim().length > 0) {
		assets.push({
			type: 'studio-copy',
			name: `copy:${runResult.platform}`,
			attributes: { brief: runResult.brief.slice(0, 120), text: runResult.notes },
		})
	}

	return assets
}

/**
 * Persist assets to the knowledge graph (deduped by type+name by the KG).
 * Returns the number of assets written.
 */
export async function persistAssets(assets: StudioAsset[]): Promise<number> {
	for (const a of assets) {
		await addGlobalEntity(a.type, a.name, a.attributes)
	}
	return assets.length
}

/**
 * Record a free-form studio learning (a research finding, a winning effect
 * recipe) as a searchable summary. The "always update the database" path for
 * knowledge that isn't a structured asset.
 */
export async function recordLearning(content: string, keywords: string[]): Promise<void> {
	const cleaned = content.trim()
	if (!cleaned) return
	await addGlobalSummary(cleaned, keywords)
}

/** Recall knowledge-graph content relevant to a new brief. */
export async function recallRelevant(query: string): Promise<string> {
	return searchGlobalGraph(query)
}

/** Counts of studio-flavored entities + summaries in the graph (for `/studio knowledge stats`). */
export function knowledgeStats(): { entities: number; summaries: number; studioEntities: number } {
	const graph = getGlobalGraph()
	const entities = Object.values(graph.entities)
	const studioEntities = entities.filter((e) => e.type.startsWith('studio-')).length
	return { entities: entities.length, summaries: graph.summaries.length, studioEntities }
}

/**
 * End-to-end curation of a run: extract + persist.
 * Returns the extracted assets and how many were written.
 */
export async function runCurator(
	runResult: StudioRunResult,
): Promise<{ assets: StudioAsset[]; persisted: number }> {
	const assets = extractAssets(runResult)
	const persisted = await persistAssets(assets)
	return { assets, persisted }
}
