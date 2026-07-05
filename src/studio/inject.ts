/**
 * Olympuz Studio — System-prompt injection (RISK-1 keystone).
 *
 * `composeAppendSystemPrompt` is the ONLY function that decides whether the
 * Studio PRD is appended to a session's system prompt. It is gated on
 * `isStudioActive()`, which is itself false under `isTestEnv()` — so the
 * existing 2639-test suite is byte-for-byte unaffected unless a test forces
 * active. When inactive it returns `existing` UNCHANGED (including undefined).
 *
 * Wiring (Phase 4) wraps the `appendSystemPrompt` source at its call sites
 * (query.ts / print.ts); it never edits systemPrompt.ts.
 */

import { getStudioEngine, isStudioActive } from './studioEngine.js'

/**
 * Compose the effective append-system-prompt value.
 * - Inactive (default in tests / when disabled): pass-through, no change.
 * - Active: append the compressed Studio PRD to whatever existed.
 */
export function composeAppendSystemPrompt(existing: string | undefined): string | undefined {
	if (!isStudioActive()) return existing
	const prd = getStudioEngine().buildPrdInjection()
	if (!prd) return existing
	return existing ? `${existing}\n\n${prd}` : prd
}
