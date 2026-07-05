/**
 * Olympuz Agentic Operations — System-prompt injection.
 *
 * `composeOpsAppendSystemPrompt` appends the Ops PRD only when `isOpsActive()`
 * (opt-in + not a test run). When inactive it returns `existing` UNCHANGED
 * (including undefined). Stacked into the session prompt by the shared
 * departments injector (`src/departments/inject.ts`).
 */

import { getOpsEngine, isOpsActive } from './opsEngine.js'

/** Compose Ops's contribution to the append-system-prompt. */
export function composeOpsAppendSystemPrompt(existing: string | undefined): string | undefined {
	if (!isOpsActive()) return existing
	const prd = getOpsEngine().buildPrdInjection()
	if (!prd) return existing
	return existing ? `${existing}\n\n${prd}` : prd
}
