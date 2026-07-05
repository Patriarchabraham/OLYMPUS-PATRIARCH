/**
 * Olympuz Studio — Intent detection (drives auto-activation).
 *
 * Pure rule + keyword scorer. Classifies a user message into a StudioIntent:
 * whether it's a build request, which platform (web/android/windows), which kind
 * (website/landing/app/dashboard/system/component), and a confidence score.
 *
 * Deterministic — no LLM, no I/O. Tested directly.
 */

import type { StudioIntent, StudioKind, StudioPlatform } from './types.js'

const BUILD_VERBS = [
	'build',
	'create',
	'make',
	'generate',
	'design',
	'develop',
	'scaffold',
	'prototype',
	'code',
	'implement',
	'write',
	'craft',
	'produce',
	'architect',
	'ship',
	'construct',
	'assemble',
]

const BUILD_NOUNS = [
	'website',
	'web app',
	'webapp',
	'web application',
	'landing page',
	'landing',
	'dashboard',
	'app',
	'application',
	'system',
	'platform',
	'portal',
	'ui',
	'interface',
	'page',
	'site',
	'store',
	'ecommerce',
	'e-commerce',
	'portfolio',
	'saas',
	'admin panel',
	'mobile app',
	'desktop app',
	'component',
	'frontend',
	'front-end',
]

const PLATFORM_KEYWORDS: Record<Exclude<StudioPlatform, never>, string[]> = {
	android: [
		'android',
		'kotlin',
		'jetpack',
		'compose',
		'play store',
		'apk',
		'aab',
		'material 3',
		'material3',
	],
	windows: [
		'windows',
		'win10',
		'win 10',
		'win11',
		'win 11',
		'winui',
		'wpf',
		'uwp',
		'msix',
		'.net',
		'dotnet',
		'fluent',
		'desktop app',
		'windows app',
		'windows 10',
		'windows 11',
	],
	web: [
		'web',
		'website',
		'site',
		'html',
		'css',
		'react',
		'next',
		'next.js',
		'vue',
		'svelte',
		'landing',
		'browser',
		'tailwind',
		'dashboard',
		'admin panel',
		'analytics',
		'console',
	],
}

const KIND_RULES: Array<{ kind: StudioKind; words: string[] }> = [
	{ kind: 'landing', words: ['landing page', 'landing', 'hero page'] },
	{ kind: 'dashboard', words: ['dashboard', 'admin panel', 'analytics', 'console'] },
	{
		kind: 'website',
		words: [
			'website',
			'web app',
			'webapp',
			'site',
			'web application',
			'store',
			'ecommerce',
			'e-commerce',
			'portfolio',
			'blog',
		],
	},
	{ kind: 'system', words: ['saas', 'system', 'platform', 'portal', 'backend', 'api'] },
	{
		kind: 'component',
		words: ['component', 'button', 'form', 'modal', 'card', 'widget', 'navbar', 'sidebar'],
	},
	{ kind: 'app', words: ['app', 'application', 'mobile app', 'desktop app'] },
]

function lower(msg: string): string {
	return msg.toLowerCase()
}

function countMatches(text: string, dict: string[]): string[] {
	const hits: string[] = []
	for (const w of dict) if (text.includes(w)) hits.push(w)
	return hits
}

/**
 * Detect Studio intent in a user message.
 *
 * Confidence model (deterministic, 0..1):
 *   +0.35 any build verb
 *   +0.35 any build noun
 *   +0.15 a platform cue
 *   +0.15 a kind cue
 * A build request requires at least one verb AND one noun (confidence >= 0.7).
 */
export function detectStudioIntent(message: string): StudioIntent {
	const text = lower(message)
	const verbHits = countMatches(text, BUILD_VERBS)
	const nounHits = countMatches(text, BUILD_NOUNS)

	const triggers: string[] = []
	if (verbHits.length) triggers.push(`verb:${verbHits.join('|')}`)
	if (nounHits.length) triggers.push(`noun:${nounHits.join('|')}`)

	// Platform
	let platform: StudioIntent['platform'] = 'unknown'
	const androidHits = countMatches(text, PLATFORM_KEYWORDS.android)
	const windowsHits = countMatches(text, PLATFORM_KEYWORDS.windows)
	const webHits = countMatches(text, PLATFORM_KEYWORDS.web)
	// windows cue takes priority over web when both present (e.g. "windows desktop app" vs generic "app").
	if (windowsHits.length) {
		platform = 'windows'
		triggers.push(`platform:windows:${windowsHits.join('|')}`)
	} else if (androidHits.length) {
		platform = 'android'
		triggers.push(`platform:android:${androidHits.join('|')}`)
	} else if (webHits.length) {
		platform = 'web'
		triggers.push(`platform:web:${webHits.join('|')}`)
	}

	// Kind
	let kind: StudioKind = 'unknown'
	for (const rule of KIND_RULES) {
		if (countMatches(text, rule.words).length) {
			kind = rule.kind
			triggers.push(`kind:${kind}`)
			break
		}
	}

	// Confidence
	let confidence = 0
	if (verbHits.length) confidence += 0.35
	if (nounHits.length) confidence += 0.35
	if (platform !== 'unknown') confidence += 0.15
	if (kind !== 'unknown') confidence += 0.15
	confidence = Math.min(1, confidence)

	const isBuildRequest = verbHits.length > 0 && nounHits.length > 0

	return { isBuildRequest, confidence, platform, kind, triggers }
}

/** True when a message looks like a build/design request worth auto-activating on. */
export function isStudioBuildIntent(message: string): boolean {
	return detectStudioIntent(message).isBuildRequest
}
