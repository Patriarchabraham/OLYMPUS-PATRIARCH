import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import {
	getPublish,
	listPublishes,
	markReversed,
	publishedLogPath,
	recordPublish,
} from './publishedLog.js'

describe('departments publishedLog — Marketing audit trail', () => {
	const originalConfigDir = process.env.CLAUDE_CONFIG_DIR
	let configDir: string

	beforeAll(() => {
		configDir = mkdtempSync(join(tmpdir(), 'olympuz-depts-log-'))
		process.env.CLAUDE_CONFIG_DIR = configDir
	})

	beforeEach(() => {
		// fresh log per test
		rmSync(publishedLogPath(), { force: true })
	})

	afterAll(() => {
		if (originalConfigDir === undefined) {
			delete process.env.CLAUDE_CONFIG_DIR
		} else {
			process.env.CLAUDE_CONFIG_DIR = originalConfigDir
		}
		rmSync(configDir, { recursive: true, force: true })
	})

	it('recordPublish appends and the entry is retrievable, newest first', () => {
		const a = recordPublish({
			channel: 'x',
			action: 'post',
			content: 'hello world',
			reversible: true,
			reversalHint: 'delete via X API',
		})
		expect(a.id).toBeTruthy()
		expect(a.status).toBe('published')
		const list = listPublishes()
		expect(list).toHaveLength(1)
		expect(list[0]!.id).toBe(a.id)
		expect(getPublish(a.id)?.content).toBe('hello world')
	})

	it('listPublishes filters by channel and status', () => {
		recordPublish({ channel: 'x', action: 'post', content: 'a', reversible: true })
		recordPublish({ channel: 'email', action: 'email', content: 'b', reversible: false })
		expect(listPublishes()).toHaveLength(2)
		expect(listPublishes({ channel: 'email' })).toHaveLength(1)
		expect(listPublishes({ channel: 'x' })[0]!.channel).toBe('x')
		expect(listPublishes({ status: 'reversed' })).toHaveLength(0)
	})

	it('markReversed flips status and the entry stays in the log', () => {
		const a = recordPublish({
			channel: 'linkedin',
			action: 'post',
			content: 'hiring',
			reversible: true,
			reversalHint: 'delete post',
		})
		const reversed = markReversed(a.id)
		expect(reversed?.status).toBe('reversed')
		expect(getPublish(a.id)?.status).toBe('reversed')
		expect(listPublishes({ status: 'reversed' })).toHaveLength(1)
	})

	it('markReversed returns undefined for an unknown id', () => {
		expect(markReversed('does-not-exist')).toBeUndefined()
	})

	it('recordPublish honors an explicit id/timestamp (deterministic tests)', () => {
		const a = recordPublish({
			id: 'fixed-id',
			timestamp: 1000,
			channel: 'x',
			action: 'post',
			content: 'c',
			reversible: true,
		})
		expect(a.id).toBe('fixed-id')
		expect(a.timestamp).toBe(1000)
	})
})
