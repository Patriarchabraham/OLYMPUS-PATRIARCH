import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getOpsEngine, resetOpsEngine } from '../ops/opsEngine.js'
import type { PermissionDecision } from '../types/permissions.js'
import { BrowserControlTool } from './BrowserControlTool/BrowserControlTool.js'
import { ListenTool } from './ListenTool/ListenTool.js'
import { SpeakTool } from './SpeakTool/SpeakTool.js'
import { VisionTool } from './VisionTool/VisionTool.js'

const ctx = undefined as never

describe('ops operator tools — gating + approval matrix', () => {
	beforeEach(() => resetOpsEngine())
	afterEach(() => resetOpsEngine())

	it('all four are dormant under vitest by default', () => {
		for (const t of [BrowserControlTool, VisionTool, SpeakTool, ListenTool]) {
			expect(t.isEnabled()).toBe(false)
		}
	})

	it('all four activate when Ops is force-active', () => {
		getOpsEngine().__setTestForceActive(true)
		for (const t of [BrowserControlTool, VisionTool, SpeakTool, ListenTool]) {
			expect(t.isEnabled()).toBe(true)
		}
	})

	it('read-only tools stay read-only', () => {
		expect(VisionTool.isReadOnly()).toBe(true)
		expect(SpeakTool.isReadOnly()).toBe(true)
		expect(ListenTool.isReadOnly()).toBe(true)
		expect(BrowserControlTool.isReadOnly()).toBe(false)
	})

	describe('BrowserControl approval gate (ask-destructive default)', () => {
		beforeEach(() => {
			resetOpsEngine()
			getOpsEngine().__setTestForceActive(true)
		})

		it('read-only navigation + screenshot are allowed without asking', async () => {
			const goto = (await BrowserControlTool.checkPermissions(
				{ action: 'goto', url: 'https://example.com' } as never,
				ctx,
			)) as PermissionDecision
			expect(goto.behavior).toBe('allow')
			const shot = (await BrowserControlTool.checkPermissions(
				{ action: 'screenshot', url: 'https://example.com' } as never,
				ctx,
			)) as PermissionDecision
			expect(shot.behavior).toBe('allow')
		})

		it('destructive click/fill/submit/evaluate ask for approval', async () => {
			for (const action of ['click', 'fill', 'submit', 'evaluate'] as const) {
				const dec = (await BrowserControlTool.checkPermissions(
					{
						action,
						url: 'https://example.com',
						selector: '#go',
						value: 'x',
						expression: '1+1',
					} as never,
					ctx,
				)) as PermissionDecision
				expect(dec.behavior).toBe('ask')
				expect((dec as { message?: string }).message).toContain('[ops approval]')
			}
		})

		it('browser.approvalPolicy=allow permits destructive actions', async () => {
			getOpsEngine().applyAdmin('browser.approvalPolicy=allow')
			const dec = (await BrowserControlTool.checkPermissions(
				{ action: 'submit', url: 'https://example.com', selector: '#' } as never,
				ctx,
			)) as PermissionDecision
			expect(dec.behavior).toBe('allow')
		})

		it('browser.approvalPolicy=ask-always asks even for navigation', async () => {
			getOpsEngine().applyAdmin('browser.approvalPolicy=ask-always')
			const dec = (await BrowserControlTool.checkPermissions(
				{ action: 'goto', url: 'https://example.com' } as never,
				ctx,
			)) as PermissionDecision
			expect(dec.behavior).toBe('ask')
		})

		it('call() returns a not-configured result when Playwright is absent (no live browser)', async () => {
			const out = (await BrowserControlTool.call({
				action: 'goto',
				url: 'https://example.com',
			} as never)) as { data: { ok: boolean; error?: string } }
			expect(out.data.ok).toBe(false)
			expect(out.data.error).toContain('Playwright')
		})

		it('mapToolResultToToolResultBlockParam renders a readable block', async () => {
			const out = (await BrowserControlTool.call({
				action: 'goto',
				url: 'https://example.com',
			} as never)) as {
				data: import('./BrowserControlTool/BrowserControlTool.js').BrowserControlOutput
			}
			const block = BrowserControlTool.mapToolResultToToolResultBlockParam(out.data, 'use_1')
			expect(block.tool_use_id).toBe('use_1')
			expect(block.type).toBe('tool_result')
			expect(block.content as string).toContain('BrowserControl')
		})
	})
})
