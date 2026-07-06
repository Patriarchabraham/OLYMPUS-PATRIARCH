import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { generateVideo, isVideoAvailable, selectVideoProvider } from './videoAdapter.js'

const KEYS = [
	'VEO_API_KEY',
	'VEO_API_URL',
	'SORA_API_KEY',
	'SORA_API_URL',
	'RUNWAY_API_KEY',
	'RUNWAY_API_URL',
	'KLING_API_KEY',
	'KLING_API_URL',
]
const original: Record<string, string | undefined> = {}

describe('marketing videoAdapter — no-op when unconfigured', () => {
	beforeEach(() => {
		for (const k of KEYS) {
			original[k] = process.env[k]
			delete process.env[k]
		}
	})
	afterEach(() => {
		for (const k of KEYS) {
			if (original[k] === undefined) delete process.env[k]
			else process.env[k] = original[k]
		}
	})

	it('isVideoAvailable is false when no provider key is set', () => {
		expect(isVideoAvailable()).toBe(false)
		expect(selectVideoProvider()).toBeNull()
	})

	it('generateVideo returns a not-configured result listing the provider envs', async () => {
		const r = await generateVideo({ prompt: 'hook in 1s' })
		expect(r.ok).toBe(false)
		expect(r.error).toContain('VEO_API_KEY')
	})

	it('selects a provider when its key is set, but still needs the endpoint URL', async () => {
		process.env.VEO_API_KEY = 'k'
		expect(isVideoAvailable()).toBe(true)
		expect(selectVideoProvider()?.provider).toBe('veo')
		const r = await generateVideo({ prompt: 'hook in 1s' })
		expect(r.ok).toBe(false)
		expect(r.error).toContain('VEO_API_URL')
		expect(r.provider).toBe('veo')
	})
})
