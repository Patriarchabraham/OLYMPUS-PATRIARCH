/**
 * Olympuz Marketing & Growth — Curator.
 *
 * The "employee that always updates the database." After a campaign run, mines
 * the result for REUSABLE assets — winning creatives (image/video + the prompt
 * that made them), winning copy, audience/persona descriptors, and whole
 * campaign architectures — and persists them to the project knowledge graph, so
 * the next campaign starts from accumulated performance, not zero.
 *
 * The ONLY marketing module that touches the knowledge graph. `extractMarketingAssets`
 * is pure; the rest are thin async wrappers over the KG API.
 */

import {
	addGlobalEntity,
	addGlobalSummary,
	getGlobalGraph,
	searchGlobalGraph,
} from '../utils/knowledgeGraph.js'
import type { MarketingAsset, MarketingRunResult } from './types.js'

/** Stringify a value for KG attribute storage. */
function str(v: unknown): string {
	if (typeof v === 'string') return v
	if (typeof v === 'number' || typeof v === 'boolean') return String(v)
	return JSON.stringify(v)
}

/**
 * Mine a completed run for reusable assets. Pure — no I/O.
 * Yields a marketing-creative per recorded creative, marketing-copy per recorded
 * copy item, marketing-audience when an audience is described, and a
 * marketing-campaign when the run carried a plan.
 */
export function extractMarketingAssets(run: MarketingRunResult): MarketingAsset[] {
	const assets: MarketingAsset[] = []

	for (const c of run.creatives ?? []) {
		assets.push({
			type: 'marketing-creative',
			name: `creative:${run.kind}:${c.name}`,
			attributes: {
				kind: run.kind,
				name: c.name,
				medium: c.medium,
				prompt: c.prompt.slice(0, 300),
				path: c.path ?? '',
			},
		})
	}

	for (const cp of run.copy ?? []) {
		assets.push({
			type: 'marketing-copy',
			name: `copy:${run.kind}:${cp.name}`,
			attributes: {
				kind: run.kind,
				name: cp.name,
				text: cp.text.slice(0, 300),
			},
		})
	}

	if (run.audience) {
		assets.push({
			type: 'marketing-audience',
			name: `audience:${run.kind}:${run.audience.slice(0, 40)}`,
			attributes: {
				kind: run.kind,
				description: run.audience.slice(0, 300),
			},
		})
	}

	if (run.plan) {
		assets.push({
			type: 'marketing-campaign',
			name: `campaign:${run.kind}:${run.brief.slice(0, 40)}`,
			attributes: {
				kind: run.kind,
				brief: run.brief.slice(0, 160),
				roles: run.plan.roles.map((r) => r.role).join(','),
				taskCount: str(run.plan.tasks.length),
			},
		})
	}

	return assets
}

/** Persist assets to the knowledge graph. Returns count written. */
export async function persistMarketingAssets(assets: MarketingAsset[]): Promise<number> {
	for (const a of assets) {
		await addGlobalEntity(a.type, a.name, a.attributes)
	}
	return assets.length
}

/** Record a free-form marketing learning as a searchable summary. */
export async function recordMarketingLearning(content: string, keywords: string[]): Promise<void> {
	const cleaned = content.trim()
	if (!cleaned) return
	await addGlobalSummary(cleaned, keywords)
}

/** Recall knowledge-graph content relevant to a new marketing task. */
export async function recallMarketingRelevant(query: string): Promise<string> {
	return searchGlobalGraph(query)
}

/** Counts of marketing-flavored entities + summaries (for /marketing knowledge stats). */
export function marketingKnowledgeStats(): {
	entities: number
	summaries: number
	marketingEntities: number
} {
	const graph = getGlobalGraph()
	const entities = Object.values(graph.entities)
	const marketingEntities = entities.filter((e) => e.type.startsWith('marketing-')).length
	return { entities: entities.length, summaries: graph.summaries.length, marketingEntities }
}

/** End-to-end curation of a run: extract + persist. */
export async function runMarketingCurator(
	run: MarketingRunResult,
): Promise<{ assets: MarketingAsset[]; persisted: number }> {
	const assets = extractMarketingAssets(run)
	const persisted = await persistMarketingAssets(assets)
	return { assets, persisted }
}
