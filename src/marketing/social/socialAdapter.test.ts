import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
	configuredChannels,
	deletePost,
	isChannelAvailable,
	post,
	uploadShort,
} from './socialAdapter.js'

const KEYS = [
	'X_API_KEY',
	'X_API_SECRET',
	'X_ACCESS_TOKEN',
	'X_API_URL',
	'META_ACCESS_TOKEN',
	'META_PAGE_ID',
	'META_API_URL',
	'LINKEDIN_ACCESS_TOKEN',
	'LINKEDIN_PERSON_URN',
	'LINKEDIN_API_URL',
	'TIKTOK_ACCESS_TOKEN',
	'TIKTOK_API_URL',
	'YOUTUBE_ACCESS_TOKEN',
	'YOUTUBE_API_URL',
]
const original: Record<string, string | undefined> = {}

describe('marketing socialAdapter — no-op when unconfigured', () => {
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

	it('configuredChannels is empty and no channel is available without tokens', () => {
		expect(configuredChannels()).toEqual([])
		for (const c of ['x', 'meta', 'linkedin', 'tiktok', 'youtube'] as const) {
			expect(isChannelAvailable(c)).toBe(false)
		}
	})

	it('post returns a not-configured result naming the channel tokens', async () => {
		const r = await post({ channel: 'x', text: 'hello' })
		expect(r.ok).toBe(false)
		expect(r.error).toContain('X_API_KEY')
	})

	it('uploadShort delegates to post and returns the same gating', async () => {
		const r = await uploadShort({ channel: 'youtube', text: 'short', videoUrl: 'https://x/v.mp4' })
		expect(r.ok).toBe(false)
		expect(r.error).toContain('YOUTUBE_ACCESS_TOKEN')
	})

	it('deletePost returns a not-configured result (the reversal path)', async () => {
		const r = await deletePost('linkedin', '123')
		expect(r.ok).toBe(false)
		expect(r.error).toContain('LINKEDIN_ACCESS_TOKEN')
	})
})
