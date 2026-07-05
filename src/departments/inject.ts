/**
 * Olympuz Departments — system-prompt injection orchestrator.
 *
 * Composes the append-system-prompt contributions from EVERY active department
 * (Studio, Agentic Operations, Marketing & Growth). Each department's injector
 * early-returns its input when that department is inactive, so under vitest —
 * where no department is active — this function is a pass-through and the
 * 2639-test suite is byte-for-byte unaffected.
 *
 * The CLI/SDK call sites import this function aliased as `composeAppendSystemPrompt`,
 * so Studio's own injector (`src/studio/inject.ts`) remains the single source of
 * truth for its contribution and its existing tests are unchanged.
 *
 * Phase 0 wires Studio only. Phase 1 adds Ops; Phase 2 adds Marketing — each is
 * one import + one line here, and each phase is independently green.
 */
import { composeAppendSystemPrompt as composeStudioAppend } from '../studio/inject.js'

/**
 * Compose the effective append-system-prompt by stacking every active
 * department's PRD contribution onto `existing`. Inactive departments are
 * no-ops, so this returns `existing` UNCHANGED (including undefined) when no
 * department is active.
 */
export function composeAllDepartmentInjections(existing: string | undefined): string | undefined {
	let out = existing
	out = composeStudioAppend(out)
	// Phase 1: out = composeOpsAppend(out)
	// Phase 2: out = composeMarketingAppend(out)
	return out
}
