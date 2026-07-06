/**
 * Olympuz Marketing & Growth — Intent detector.
 *
 * Rule-based: surfaces marketing requests and classifies the kind (campaign /
 * content / social / email / video / profile). Pure, no I/O.
 */

import type { MarketingIntent, MarketingKind } from './types.js'

/** Phrases that signal a marketing request, grouped by kind. */
export const MARKETING_CUES: Array<{ kind: MarketingKind; phrases: string[] }> = [
	{
		kind: 'campaign',
		phrases: [
			'marketing campaign',
			'launch campaign',
			'growth campaign',
			'ad campaign',
			'run a campaign',
			'go to market',
			'promote',
			'market my',
			'market the',
		],
	},
	{
		kind: 'social',
		phrases: [
			'post on',
			'social media',
			'post to twitter',
			'post to x',
			'linkedin post',
			'tiktok',
			'instagram reel',
			'youtube short',
			'manage my socials',
			'social profile',
		],
	},
	{
		kind: 'email',
		phrases: [
			'email campaign',
			'send an email',
			'newsletter',
			'send a blast',
			'drip sequence',
			'email list',
			'cold email',
			'reply to emails',
		],
	},
	{
		kind: 'video',
		phrases: [
			'marketing video',
			'promo video',
			'make a short',
			'create a short',
			'video ad',
			'reel',
			'generate a video',
		],
	},
	{
		kind: 'content',
		phrases: [
			'landing page copy',
			'ad copy',
			'write copy',
			'brand voice',
			'blog post',
			'content calendar',
			'messaging',
		],
	},
	{
		kind: 'profile',
		phrases: [
			'create a profile',
			'set up profiles',
			'official profile',
			'company profile',
			'make an email',
			'create an email',
			'brand account',
		],
	},
]

const GENERIC_MARKETING_TERMS = [
	'marketing',
	'campaign',
	'brand',
	'audience',
	'funnel',
	'conversion',
	'ctr',
	'engagement',
	'lead gen',
	'growth',
]

function classify(message: string): { kind: MarketingKind; triggers: string[] } {
	const triggers: string[] = []
	const matches: Array<{ kind: MarketingKind; count: number }> = []
	for (const group of MARKETING_CUES) {
		let count = 0
		for (const phrase of group.phrases) {
			if (message.includes(phrase)) {
				triggers.push(phrase)
				count++
			}
		}
		if (count > 0) matches.push({ kind: group.kind, count })
	}
	if (matches.length === 0) return { kind: 'unknown', triggers }
	matches.sort((a, b) => b.count - a.count)
	return { kind: matches[0]!.kind, triggers }
}

/**
 * Detect a marketing request in a natural-language message.
 * Confidence: +0.5 per cue phrase, +0.2 for a generic marketing term, capped at 1.
 */
export function detectMarketingIntent(message: string): MarketingIntent {
	const lower = message.toLowerCase()
	const { kind, triggers } = classify(lower)
	let confidence = Math.min(0.5 * triggers.length, 0.95)
	if (kind === 'unknown') {
		for (const term of GENERIC_MARKETING_TERMS) {
			if (lower.includes(term)) {
				confidence = Math.max(confidence, 0.45)
				triggers.push(term)
				break
			}
		}
	}
	const isMarketingRequest = confidence >= 0.5
	return {
		isMarketingRequest,
		confidence: kind === 'unknown' && triggers.length === 0 ? 0 : confidence,
		kind: isMarketingRequest ? kind : 'unknown',
		triggers,
	}
}

/** Convenience boolean. */
export function isMarketingIntent(message: string): boolean {
	return detectMarketingIntent(message).isMarketingRequest
}
