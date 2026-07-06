import { describe, expect, it } from 'vitest'
import { detectMarketingIntent, isMarketingIntent, MARKETING_CUES } from './intent.js'

describe('marketing intent — rule-based classification', () => {
	it('MARKETING_CUES covers every kind', () => {
		const kinds = new Set(MARKETING_CUES.map((c) => c.kind))
		expect(kinds).toEqual(new Set(['campaign', 'social', 'email', 'video', 'content', 'profile']))
	})

	it('detects a campaign request', () => {
		const r = detectMarketingIntent('launch campaign for our new app')
		expect(r.isMarketingRequest).toBe(true)
		expect(r.kind).toBe('campaign')
		expect(r.confidence).toBeGreaterThanOrEqual(0.5)
		expect(r.triggers).toContain('launch campaign')
	})

	it('classifies social vs email vs video vs content', () => {
		expect(detectMarketingIntent('post on x and linkedin').kind).toBe('social')
		expect(detectMarketingIntent('send an email blast to the list').kind).toBe('email')
		expect(detectMarketingIntent('generate a video for the launch').kind).toBe('video')
		expect(detectMarketingIntent('write copy for the hero section').kind).toBe('content')
	})

	it('"create an email" routes to profile (official account creation), not email send', () => {
		expect(detectMarketingIntent('create an email for the company').kind).toBe('profile')
		expect(detectMarketingIntent('set up official profiles').kind).toBe('profile')
	})

	it('a lone generic term is suggestive but not confident enough to fire', () => {
		const r = detectMarketingIntent('we need growth')
		expect(r.confidence).toBeLessThan(0.5)
		expect(r.isMarketingRequest).toBe(false)
		expect(r.kind).toBe('unknown')
		expect(r.triggers).toContain('growth')
	})

	it('non-marketing text yields zero confidence', () => {
		const r = detectMarketingIntent('hello world, how are you?')
		expect(r.confidence).toBe(0)
		expect(r.isMarketingRequest).toBe(false)
		expect(r.kind).toBe('unknown')
		expect(r.triggers).toEqual([])
	})

	it('isMarketingIntent convenience matches detect', () => {
		expect(isMarketingIntent('launch campaign')).toBe(true)
		expect(isMarketingIntent('hello world')).toBe(false)
	})
})
