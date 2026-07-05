/**
 * Olympuz Departments — human-approval gate (shared safety primitive).
 *
 * Both new departments have outward-facing / hard-to-reverse actions:
 *   - Marketing: every publish / send / post (the user's explicit "a human can
 *     fix/reverse what isn't right after seeing everything published").
 *   - Ops: destructive computer control (real mouse / keyboard / shell on the
 *     user's actual machine).
 *
 * Rather than invent a new subsystem, this reuses the codebase's existing
 * `checkPermissions → { behavior: 'allow' | 'ask' | 'deny' }` primitive, which
 * is already wired to the interactive permission UX. A gated tool's
 * `checkPermissions` delegates here.
 *
 * Pure — builds the permission result; performs no action.
 */

export type ApprovalPolicy = 'allow' | 'ask-always' | 'ask-destructive'

export type PermissionBehavior = 'allow' | 'ask' | 'deny'

export interface PermissionResult {
	behavior: PermissionBehavior
	updatedInput: unknown
	message?: string
}

export interface BuildApprovalCheckOptions {
	/** The tool input being authorized (passed through as updatedInput). */
	input: unknown
	/** Human-readable description, e.g. "post to X", "send email", "mouse click at (120, 340)". */
	summary: string
	policy: ApprovalPolicy
	/** For 'ask-destructive': whether THIS specific action is destructive. */
	destructive?: boolean
}

/** Resolve whether an action requires human approval under the given policy. */
export function needsApproval(policy: ApprovalPolicy, destructive: boolean): boolean {
	if (policy === 'ask-always') return true
	if (policy === 'ask-destructive') return destructive
	return false
}

/**
 * Build a `checkPermissions`-style result for a gated department action.
 * - 'allow'             -> never ask (read-only ops: screenshot, vision, listen, speak).
 * - 'ask-always'        -> always ask (Marketing publish / send / post).
 * - 'ask-destructive'   -> ask only when `destructive` is true (Ops mouse/keyboard/shell).
 */
export function buildApprovalCheck(opts: BuildApprovalCheckOptions): PermissionResult {
	const ask = needsApproval(opts.policy, Boolean(opts.destructive))
	if (!ask) return { behavior: 'allow', updatedInput: opts.input }
	return {
		behavior: 'ask',
		updatedInput: opts.input,
		message: `[department approval] ${opts.summary} — approve before it runs.`,
	}
}
