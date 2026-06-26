import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
	DEFAULT_LOCAL_ENDPOINT,
	DEFAULT_LOCAL_MODEL,
	getLocalEndpoint,
	getLocalModelName,
	invalidateReadinessCache,
	isLocalReady,
} from '../localModel.js'

const originalEnv = { ...process.env }

beforeEach(() => {
	delete process.env.OLYMPUZ_LOCAL_MODEL
	delete process.env.OLYMPUZ_LOCAL_ENDPOINT
	delete process.env.OLYMPUZ_LOCAL_AUTO_PULL
	invalidateReadinessCache()
})

afterEach(() => {
	for (const [k, v] of Object.entries(originalEnv)) {
		if (v !== undefined) process.env[k] = v
	}
})

describe('localModel config', () => {
	it('defaults to Gemma 3 4B', () => {
		expect(getLocalModelName()).toBe(DEFAULT_LOCAL_MODEL)
		expect(DEFAULT_LOCAL_MODEL).toBe('gemma3:4b')
	})

	it('defaults to localhost Ollama endpoint', () => {
		expect(getLocalEndpoint()).toBe(DEFAULT_LOCAL_ENDPOINT)
		expect(DEFAULT_LOCAL_ENDPOINT).toBe('http://localhost:11434')
	})

	it('respects OLYMPUZ_LOCAL_MODEL env override', () => {
		process.env.OLYMPUZ_LOCAL_MODEL = 'qwen2.5-coder:3b'
		expect(getLocalModelName()).toBe('qwen2.5-coder:3b')
	})

	it('respects OLYMPUZ_LOCAL_ENDPOINT env override', () => {
		process.env.OLYMPUZ_LOCAL_ENDPOINT = 'http://my-server:8080'
		expect(getLocalEndpoint()).toBe('http://my-server:8080')
	})
})

describe('localModel.isLocalReady', () => {
	it('returns false when no server is reachable', async () => {
		process.env.OLYMPUZ_LOCAL_ENDPOINT = 'http://127.0.0.1:1' // port 1 = nothing listening
		const ready = await isLocalReady()
		expect(ready).toBe(false)
	}, 5000)

	it('caches readiness for 30 seconds', async () => {
		process.env.OLYMPUZ_LOCAL_ENDPOINT = 'http://127.0.0.1:1'
		await isLocalReady()
		const start = Date.now()
		await isLocalReady()
		const elapsed = Date.now() - start
		// Cache hit should be near-instant (< 5ms).
		expect(elapsed).toBeLessThan(5)
	})

	it('respects cache invalidation', async () => {
		// First call: endpoint is unreachable.
		process.env.OLYMPUZ_LOCAL_ENDPOINT = 'http://127.0.0.1:1'
		expect(await isLocalReady()).toBe(false)

		// Change endpoint and invalidate cache — next call should re-probe
		// the new endpoint (and still return false since it's also unreachable).
		process.env.OLYMPUZ_LOCAL_ENDPOINT = 'http://127.0.0.1:2'
		invalidateReadinessCache()
		expect(await isLocalReady()).toBe(false)
	})
})
