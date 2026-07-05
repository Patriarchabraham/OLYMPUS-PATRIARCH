/**
 * Olympuz Agentic Operations — Intent detection.
 *
 * Pure rule + keyword scorer. Classifies a user message into an OpsIntent: is
 * it an operations request, which control surface (computer/browser/vision/
 * voice/automation), and a confidence score. Deterministic — no LLM, no I/O.
 */

import type { OpsIntent, OpsSurface } from './types.js'

const OPS_CUES = [
	'control my pc',
	'control the computer',
	'use my computer',
	'drive the browser',
	'open the browser and',
	'open a browser and',
	'automate',
	'automation',
	'click',
	'click on',
	'type into',
	'fill the form',
	'submit the form',
	'screenshot',
	'screen shot',
	'read the screen',
	'watch the screen',
	'look at the screen',
	'see the screen',
	'listen',
	'hear',
	'speak',
	'say ',
	'talk',
	'voice',
	'mouse',
	'keyboard',
	'press the key',
	'scroll',
	'team of agents',
	'agent team',
	'spawn an agent',
	'my machine',
	'on my pc',
	'on this pc',
	'on my computer',
	'on my laptop',
	'on my notebook',
	'take over',
	'do it on the computer',
	'web browser',
	'navigate to',
	'scrape',
	'fill out',
	'log in for me',
]

const SURFACE_KEYWORDS: Record<Exclude<OpsSurface, 'unknown' | 'automation'>, string[]> = {
	computer: [
		'control my pc',
		'control the computer',
		'my machine',
		'on my pc',
		'on this pc',
		'on my computer',
		'on my laptop',
		'on my notebook',
		'mouse',
		'keyboard',
		'press the key',
		'click',
		'scroll',
		'desktop',
		'take over',
	],
	browser: [
		'drive the browser',
		'open the browser',
		'open a browser',
		'web browser',
		'navigate to',
		'scrape',
		'fill the form',
		'fill out',
		'submit the form',
		'log in for me',
		'browse',
	],
	vision: [
		'read the screen',
		'watch the screen',
		'look at the screen',
		'see the screen',
		'screenshot',
		'screen shot',
		'what is on screen',
		'ocr',
	],
	voice: ['listen', 'hear', 'speak', 'say ', 'talk', 'voice', 'transcribe', 'microphone'],
}

function lower(msg: string): string {
	return msg.toLowerCase()
}

function countMatches(text: string, dict: string[]): string[] {
	const hits: string[] = []
	for (const w of dict) if (text.includes(w)) hits.push(w)
	return hits
}

/**
 * Detect Ops intent in a user message.
 *
 * Confidence model (deterministic, 0..1):
 *   +0.5 any ops cue
 *   +0.3 a surface cue
 *   +0.2 an automation/team cue
 * An ops request requires at least one ops cue (confidence >= 0.5).
 */
export function detectOpsIntent(message: string): OpsIntent {
	const text = lower(message)
	const triggers: string[] = []

	const cueHits = countMatches(text, OPS_CUES)
	if (cueHits.length) triggers.push(`cue:${cueHits.slice(0, 3).join('|')}`)

	let surface: OpsSurface = 'unknown'
	let bestSurfaceHits = 0
	for (const s of ['computer', 'browser', 'vision', 'voice'] as const) {
		const hits = countMatches(text, SURFACE_KEYWORDS[s])
		if (hits.length > bestSurfaceHits) {
			bestSurfaceHits = hits.length
			surface = s
			triggers.push(`surface:${s}:${hits.slice(0, 2).join('|')}`)
		}
	}

	const automationHits = countMatches(text, [
		'automate',
		'automation',
		'team of agents',
		'agent team',
		'spawn an agent',
	])
	if (automationHits.length && surface === 'unknown') {
		surface = 'automation'
		triggers.push(`surface:automation:${automationHits[0]}`)
	} else if (automationHits.length) {
		triggers.push(`automation:${automationHits[0]}`)
	}

	let confidence = 0
	if (cueHits.length) confidence += 0.5
	if (bestSurfaceHits > 0) confidence += 0.3
	if (automationHits.length) confidence += 0.2
	confidence = Math.min(1, confidence)

	const isOpsRequest = cueHits.length > 0 || automationHits.length > 0 || bestSurfaceHits > 0

	return { isOpsRequest, confidence, surface, triggers }
}

/** True when a message reads like an operations request. */
export function isOpsIntent(message: string): boolean {
	return detectOpsIntent(message).isOpsRequest
}
