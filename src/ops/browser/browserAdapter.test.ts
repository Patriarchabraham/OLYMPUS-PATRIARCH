import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Force playwright to be treated as uninstalled regardless of the host box, so
// the no-op-when-unconfigured path is deterministic.
vi.mock('playwright', () => {
	throw new Error('not installed')
})

import {
	goto,
	isBrowserAvailable,
	launchSession,
	resetBrowserLoader,
	screenshotPage,
} from './browserAdapter.js'

describe('ops browserAdapter — no-op when unconfigured', () => {
	beforeEach(() => resetBrowserLoader())
	afterEach(() => resetBrowserLoader())

	it('isBrowserAvailable is false when playwright is absent', async () => {
		expect(await isBrowserAvailable()).toBe(false)
	})

	it('launchSession returns guidance when unavailable', async () => {
		const r = await launchSession()
		expect(r.ok).toBe(false)
		expect(r.error).toContain('Playwright')
	})

	it('goto returns a not-configured result', async () => {
		const r = await goto('https://example.com')
		expect(r.ok).toBe(false)
		expect(r.error).toContain('Playwright')
	})

	it('screenshotPage returns a not-configured result', async () => {
		const r = await screenshotPage('https://example.com')
		expect(r.ok).toBe(false)
	})
})
