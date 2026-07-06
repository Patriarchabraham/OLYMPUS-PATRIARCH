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
 * All three departments (Studio, Ops, Marketing) are wired here. Each is one
 * import + one line; each injector early-returns its input when its department is
 * inactive, so the order is immaterial to the inactive (default) path.
 */

import { composeMarketingAppendSystemPrompt as composeMarketingAppend } from '../marketing/inject.js'
import { composeOpsAppendSystemPrompt as composeOpsAppend } from '../ops/inject.js'
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
	out = composeOpsAppend(out)
	out = composeMarketingAppend(out)
	return out
}
