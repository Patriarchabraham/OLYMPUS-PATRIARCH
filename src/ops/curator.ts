/**
 * Olympuz Agentic Operations — Curator.
 *
 * The agentic "employee that always updates the database." After an ops run, the
 * curator mines the result for REUSABLE know-how — recorded macros (click/type
 * sequences), winning selectors (CSS / a11y), and whole workflows — and persists
 * them to the project knowledge graph, so the next automation in the same vein
 * starts from accumulated skill rather than zero.
 *
 * This is the ONLY ops module that touches the knowledge graph. `extractOpsAssets`
 * is pure; the rest are thin async wrappers over the KG API.
 */

import {
	addGlobalEntity,
	addGlobalSummary,
	getGlobalGraph,
	searchGlobalGraph,
} from '../utils/knowledgeGraph.js'
import type { OpsAsset, OpsRunResult } from './types.js'

/** Stringify a value for KG attribute storage. */
function str(v: unknown): string {
	if (typeof v === 'string') return v
	if (typeof v === 'number' || typeof v === 'boolean') return String(v)
	return JSON.stringify(v)
}

/**
 * Mine a completed run for reusable assets. Pure — no I/O.
 * Yields an ops-macro per recorded macro, an ops-selector per recorded selector,
 * and an ops-workflow when the run carried a plan.
 */
export function extractOpsAssets(runResult: OpsRunResult): OpsAsset[] {
	const assets: OpsAsset[] = []

	for (const macro of runResult.macros ?? []) {
		assets.push({
			type: 'ops-macro',
			name: `macro:${runResult.surface}:${macro.name}`,
			attributes: {
				surface: runResult.surface,
				name: macro.name,
				steps: macro.steps.join(' | '),
				brief: runResult.brief.slice(0, 120),
			},
		})
	}

	for (const sel of runResult.selectors ?? []) {
		assets.push({
			type: 'ops-selector',
			name: `selector:${sel.surface}:${sel.name}`,
			attributes: {
				surface: sel.surface,
				name: sel.name,
				selector: sel.selector,
			},
		})
	}

	if (runResult.plan) {
		assets.push({
			type: 'ops-workflow',
			name: `workflow:${runResult.surface}:${runResult.brief.slice(0, 40)}`,
			attributes: {
				surface: runResult.surface,
				brief: runResult.brief.slice(0, 160),
				roles: runResult.plan.roles.map((r) => r.role).join(','),
				taskCount: str(runResult.plan.tasks.length),
			},
		})
	}

	return assets
}

/** Persist assets to the knowledge graph (deduped by type+name). Returns count written. */
export async function persistOpsAssets(assets: OpsAsset[]): Promise<number> {
	for (const a of assets) {
		await addGlobalEntity(a.type, a.name, a.attributes)
	}
	return assets.length
}

/** Record a free-form ops learning (a finding, a winning recipe) as a searchable summary. */
export async function recordOpsLearning(content: string, keywords: string[]): Promise<void> {
	const cleaned = content.trim()
	if (!cleaned) return
	await addGlobalSummary(cleaned, keywords)
}

/** Recall knowledge-graph content relevant to a new ops task. */
export async function recallOpsRelevant(query: string): Promise<string> {
	return searchGlobalGraph(query)
}

/** Counts of ops-flavored entities + summaries (for `/ops knowledge stats`). */
export function opsKnowledgeStats(): {
	entities: number
	summaries: number
	opsEntities: number
} {
	const graph = getGlobalGraph()
	const entities = Object.values(graph.entities)
	const opsEntities = entities.filter((e) => e.type.startsWith('ops-')).length
	return { entities: entities.length, summaries: graph.summaries.length, opsEntities }
}

/** End-to-end curation of a run: extract + persist. */
export async function runOpsCurator(
	runResult: OpsRunResult,
): Promise<{ assets: OpsAsset[]; persisted: number }> {
	const assets = extractOpsAssets(runResult)
	const persisted = await persistOpsAssets(assets)
	return { assets, persisted }
}
