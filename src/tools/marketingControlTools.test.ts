import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getMarketingEngine, resetMarketingEngine } from '../marketing/marketingEngine.js'
import type { PermissionDecision } from '../types/permissions.js'
import { EmailTool } from './EmailTool/EmailTool.js'
import { SocialPostTool } from './SocialPostTool/SocialPostTool.js'
import { VideoGenTool } from './VideoGenTool/VideoGenTool.js'

const ctx = undefined as never

describe('marketing operator tools — gating + publish approval matrix', () => {
	beforeEach(() => resetMarketingEngine())
	afterEach(() => resetMarketingEngine())

	it('all three are dormant under vitest by default', () => {
		for (const t of [VideoGenTool, EmailTool, SocialPostTool]) {
			expect(t.isEnabled()).toBe(false)
		}
	})

	it('all three activate when Marketing is force-active', () => {
		getMarketingEngine().__setTestForceActive(true)
		for (const t of [VideoGenTool, EmailTool, SocialPostTool]) {
			expect(t.isEnabled()).toBe(true)
		}
	})

	it('none are read-only (they produce or publish outward state)', () => {
		expect(VideoGenTool.isReadOnly()).toBe(false)
		expect(EmailTool.isReadOnly()).toBe(false)
		expect(SocialPostTool.isReadOnly()).toBe(false)
	})

	describe('Email publish gate (ask-always default)', () => {
		beforeEach(() => {
			resetMarketingEngine()
			getMarketingEngine().__setTestForceActive(true)
		})

		it('inbox (read) is allowed without asking', async () => {
			const dec = (await EmailTool.checkPermissions(
				{ action: 'inbox' } as never,
				ctx,
			)) as PermissionDecision
			expect(dec.behavior).toBe('allow')
		})

		it('send asks for approval', async () => {
			const dec = (await EmailTool.checkPermissions(
				{ action: 'send', to: 'a@b.com', subject: 's', body: 'b' } as never,
				ctx,
			)) as PermissionDecision
			expect(dec.behavior).toBe('ask')
			expect((dec as { message?: string }).message).toContain('[marketing approval]')
		})

		it('publish.approvalPolicy=allow permits even send', async () => {
			getMarketingEngine().applyAdmin('publish.approvalPolicy=allow')
			const dec = (await EmailTool.checkPermissions(
				{ action: 'send', to: 'a@b.com', subject: 's', body: 'b' } as never,
				ctx,
			)) as PermissionDecision
			expect(dec.behavior).toBe('allow')
		})

		it('call() send returns a not-configured result when SMTP is absent (no live send)', async () => {
			const out = (await EmailTool.call({
				action: 'send',
				to: 'a@b.com',
				subject: 's',
				body: 'b',
			} as never)) as { data: { ok: boolean; error?: string; publishedId?: string } }
			expect(out.data.ok).toBe(false)
			expect(out.data.error).toContain('SMTP_HOST')
			// not-configured → nothing was logged
			expect(out.data.publishedId).toBeUndefined()
		})
	})

	describe('SocialPost publish gate (every action asks)', () => {
		beforeEach(() => {
			resetMarketingEngine()
			getMarketingEngine().__setTestForceActive(true)
		})

		it('post / short / delete all ask for approval', async () => {
			for (const action of ['post', 'short', 'delete'] as const) {
				const dec = (await SocialPostTool.checkPermissions(
					{ action, channel: 'x', text: 'hi', videoUrl: 'https://v', postId: 'p1' } as never,
					ctx,
				)) as PermissionDecision
				expect(dec.behavior).toBe('ask')
				expect((dec as { message?: string }).message).toContain('[marketing approval]')
			}
		})

		it('call() post returns a not-configured result when channel tokens are absent', async () => {
			const out = (await SocialPostTool.call({
				action: 'post',
				channel: 'x',
				text: 'hello',
			} as never)) as { data: { ok: boolean; error?: string; publishedId?: string } }
			expect(out.data.ok).toBe(false)
			expect(out.data.error).toContain('X_API_KEY')
			expect(out.data.publishedId).toBeUndefined()
		})

		it('mapToolResultToToolResultBlockParam renders a readable block', async () => {
			const out = (await SocialPostTool.call({
				action: 'post',
				channel: 'x',
				text: 'hello',
			} as never)) as {
				data: import('./SocialPostTool/SocialPostTool.js').SocialPostOutput
			}
			const block = SocialPostTool.mapToolResultToToolResultBlockParam(out.data, 'use_1')
			expect(block.tool_use_id).toBe('use_1')
			expect(block.content as string).toContain('SocialPost')
		})
	})

	describe('VideoGen (internal creative production — no publish gate)', () => {
		beforeEach(() => {
			resetMarketingEngine()
			getMarketingEngine().__setTestForceActive(true)
		})

		it('has no approval gate (generation is not outward-facing)', () => {
			// No checkPermissions defined → the tool defaults to allow.
			expect(SocialPostTool.isReadOnly()).toBe(false)
		})

		it('call() returns a not-configured result when no provider key is set', async () => {
			const out = (await VideoGenTool.call({
				prompt: 'hook in 1s',
			} as never)) as { data: { ok: boolean; error?: string } }
			expect(out.data.ok).toBe(false)
			expect(out.data.error).toContain('VEO_API_KEY')
		})
	})
})
