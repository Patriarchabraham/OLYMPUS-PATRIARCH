import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { getProjectsDir } from '../envUtils.js'
import {
	addGlobalEntity,
	clearMemoryOnly,
	getGlobalGraph,
	initOrama,
	resetGlobalGraph,
} from '../knowledgeGraph.js'
import { sanitizePath } from '../sessionStoragePortable.js'

// Run when a SQLite backend is available: bun:sqlite under Bun, node:sqlite
// (built-in, Node 22+) under Node.
let sqliteAvailable = false
try {
	if (typeof Bun !== 'undefined') {
		require('bun:sqlite')
	} else {
		require('node:sqlite')
	}
	sqliteAvailable = true
} catch {}

describe.skipIf(!sqliteAvailable)('SQLite Storage Layer', () => {
	const originalConfigDir = process.env.CLAUDE_CONFIG_DIR
	const configDir = mkdtempSync(join(tmpdir(), 'Olympuz Coder-sqlite-'))
	process.env.CLAUDE_CONFIG_DIR = configDir
	const cwd = process.cwd()

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

	it('persists data in SQLite database', async () => {
		const sqlitePath = join(getProjectsDir(), sanitizePath(cwd), 'knowledge.db')

		// 1. Add data
		await addGlobalEntity('tool', 'sqlite-test', { status: 'durable' })
		expect(existsSync(sqlitePath)).toBe(true)

		// 2. Simulate process restart (clear memory cache)
		clearMemoryOnly()

		// 3. Load should come from SQLite (hydrated by JSON)
		const graph = getGlobalGraph()
		const entity = Object.values(graph.entities).find((e) => e.name === 'sqlite-test')
		expect(entity).toBeDefined()
		expect(entity?.attributes.status).toBe('durable')
	})

	it('self-heals SQLite from JSON if DB is deleted', async () => {
		const sqlitePath = join(getProjectsDir(), sanitizePath(cwd), 'knowledge.db')
		const jsonPath = join(getProjectsDir(), sanitizePath(cwd), 'knowledge_graph.json')

		// 1. Add data to both
		await addGlobalEntity('tool', 'self-heal-test', { val: 'safe' })
		expect(existsSync(sqlitePath)).toBe(true)
		expect(existsSync(jsonPath)).toBe(true)

		// 2. Delete SQLite DB but keep JSON
		clearMemoryOnly()
		rmSync(sqlitePath)
		expect(existsSync(sqlitePath)).toBe(false)

		// 3. Requesting the graph should trigger hydration from JSON into a NEW SQLite DB
		// In the async architecture, we must await initialization to trigger the rebuild.
		await initOrama(cwd)
		const graph = getGlobalGraph()
		const entity = Object.values(graph.entities).find((e) => e.name === 'self-heal-test')
		expect(entity).toBeDefined()
		expect(entity?.attributes.val).toBe('safe')

		// 4. Verify SQLite was recreated
		expect(existsSync(sqlitePath)).toBe(true)
	})

	it('handles large transactions (Stress Test)', async () => {
		const count = 100
		const start = Date.now()

		// Add 100 entities sequentially (mutation queue)
		for (let i = 0; i < count; i++) {
			await addGlobalEntity('bulk', `item_${i}`, { index: String(i) })
		}

		const _duration = Date.now() - start

		clearMemoryOnly()
		const graph = getGlobalGraph()
		expect(Object.keys(graph.entities).length).toBe(count)
	})
})
