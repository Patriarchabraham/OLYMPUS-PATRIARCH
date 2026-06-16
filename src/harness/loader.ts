/**
 * Harness corpus loader.
 *
 * Single in-memory store, lazily hydrated either from the filesystem corpus
 * (dev/tsx, or dist/harness/corpus after `npm run build:harness`) or from a
 * compressed bundle via loadFromBundle(). All getters are synchronous and
 * degrade gracefully — returning null/empty when no corpus is available, so
 * callers (role addenda, system prompt section) fall back to their defaults
 * instead of failing.
 *
 * No import cycle: this module imports only the AgentRole TYPE from
 * ../swarm/types.js (erased at compile time).
 */

import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { unzipSync } from 'fflate'
import type { AgentRole } from '../swarm/types.js'
import type { HarnessEntry } from './types.js'

const CORPUS_DIRNAME = 'corpus'

// Candidate roots, in priority order:
//   1. next to this module  -> dev (src/harness/corpus)
//   2. <cwd>/dist/harness/corpus -> bundled CLI after `build:harness`
const here = dirname(fileURLToPath(import.meta.url))
const ROOTS = [join(here, CORPUS_DIRNAME), join(process.cwd(), 'dist', 'harness', CORPUS_DIRNAME)]

/** Maps each AgentRole to its corpus file (1:1 with src/swarm/types.ts). */
const ROLE_FILES: Record<AgentRole, string> = {
	researcher: '20-role-researcher.md',
	coder: '20-role-coder.md',
	tester: '20-role-tester.md',
	reviewer: '20-role-reviewer.md',
	architect: '20-role-architect.md',
	dataAnalyst: '20-role-data-analyst.md',
	general: '20-role-general.md',
}

const store = new Map<string, string>()
let hydrated = false

/** Populate the store from the first filesystem root that exists. */
function hydrateFromFilesystem(): void {
	if (hydrated) return
	for (const root of ROOTS) {
		if (!existsSync(root)) continue
		try {
			for (const f of readdirSync(root)) {
				if (!f.endsWith('.md')) continue
				store.set(f, readFileSync(join(root, f), 'utf8'))
			}
			hydrated = true
			return
		} catch {}
	}
	hydrated = true // attempted; store may be empty (graceful degradation)
}

/** Harness addendum for a role, or null if unavailable (caller uses base addendum). */
export function getRoleAddendum(role: AgentRole): string | null {
	hydrateFromFilesystem()
	return store.get(ROLE_FILES[role]) ?? null
}

/** A doctrine section by stem (e.g. '00-operating-doctrine'), or null. */
export function getDoctrineSection(name: string): string | null {
	hydrateFromFilesystem()
	return store.get(`${name}.md`) ?? null
}

/** Every corpus file concatenated in sorted filename order. */
export function getFullCorpus(): string {
	hydrateFromFilesystem()
	return [...store.keys()]
		.sort()
		.map((k) => `# ${k}\n\n${store.get(k) ?? ''}`)
		.join('\n\n---\n\n')
}

/** All corpus entries (path + content), sorted — used by the bundle builder and tests. */
export function listCorpus(): HarnessEntry[] {
	hydrateFromFilesystem()
	return [...store.keys()].sort().map((path) => ({ path, content: store.get(path) ?? '' }))
}

/**
 * Hydrate the store from a compressed bundle (the distributable artifact).
 * Returns true if at least one corpus file was loaded. Overrides any prior
 * filesystem hydration.
 */
export function loadFromBundle(zipPath: string): boolean {
	try {
		const bytes = readFileSync(zipPath)
		const files = unzipSync(bytes as unknown as Uint8Array)
		let loaded = 0
		for (const [name, data] of Object.entries(files)) {
			if (!name.endsWith('.md')) continue
			store.set(name, Buffer.from(data).toString('utf8'))
			loaded++
		}
		if (loaded > 0) hydrated = true
		return loaded > 0
	} catch {
		return false
	}
}

/** Test-only: reset hydration state and store. */
export function _resetHarnessLoader(): void {
	store.clear()
	hydrated = false
}
