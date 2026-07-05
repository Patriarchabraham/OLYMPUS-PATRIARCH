import { describe, expect, it } from 'vitest'
import { detectStudioIntent, isStudioBuildIntent } from './intent.js'

describe('studio intent detection', () => {
	it('flags a clear web build request', () => {
		const i = detectStudioIntent('build a landing page for a fintech startup')
		expect(i.isBuildRequest).toBe(true)
		expect(i.platform).toBe('web')
		expect(i.kind).toBe('landing')
		expect(i.confidence).toBeGreaterThanOrEqual(0.85)
	})

	it('detects an Android app request', () => {
		const i = detectStudioIntent(
			'create an android app for tracking runs in Kotlin with Jetpack Compose',
		)
		expect(i.isBuildRequest).toBe(true)
		expect(i.platform).toBe('android')
		expect(i.kind).toBe('app')
	})

	it('detects a Windows desktop app request', () => {
		const i = detectStudioIntent(
			'generate a Windows 11 inventory desktop app with WinUI and MSIX packaging',
		)
		expect(i.isBuildRequest).toBe(true)
		expect(i.platform).toBe('windows')
		expect(i.kind).toBe('app')
	})

	it('detects a dashboard / admin panel as web', () => {
		const i = detectStudioIntent('build a dashboard for our analytics')
		expect(i.isBuildRequest).toBe(true)
		expect(i.platform).toBe('web')
		expect(i.kind).toBe('dashboard')
	})

	it('detects a SaaS/system request', () => {
		const i = detectStudioIntent('scaffold a SaaS platform with a billing portal')
		expect(i.isBuildRequest).toBe(true)
		expect(i.kind).toBe('system')
	})

	it('rejects non-build messages', () => {
		for (const msg of [
			'fix the typo in index.ts',
			'what is the capital of France?',
			'',
			'ok',
			'rerun the tests',
			'explain how this function works',
		]) {
			expect(detectStudioIntent(msg).isBuildRequest).toBe(false)
		}
	})

	it('platform stays unknown when no platform cue is present', () => {
		const i = detectStudioIntent('build an app for managing tasks')
		expect(i.isBuildRequest).toBe(true)
		expect(i.platform).toBe('unknown')
	})

	it('windows cue wins over generic web cue', () => {
		const i = detectStudioIntent('build a windows desktop app')
		expect(i.platform).toBe('windows')
	})

	it('populates triggers for traceability', () => {
		const i = detectStudioIntent('design a landing page')
		expect(i.triggers.length).toBeGreaterThan(0)
		expect(i.triggers.some((t) => t.startsWith('verb:'))).toBe(true)
	})

	it('isStudioBuildIntent helper matches detector', () => {
		expect(isStudioBuildIntent('create a website')).toBe(true)
		expect(isStudioBuildIntent('hello there')).toBe(false)
	})
})
