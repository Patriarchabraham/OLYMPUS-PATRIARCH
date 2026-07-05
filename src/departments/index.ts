/**
 * Olympuz Departments — public API barrel.
 *
 * Shared cross-department primitives: the injection orchestrator (stacks every
 * active department's PRD), the human-approval gate (reuses checkPermissions),
 * and the published-action log (Marketing's review/reversal audit trail).
 */

export {
	type ApprovalPolicy,
	type BuildApprovalCheckOptions,
	buildApprovalCheck,
	needsApproval,
	type PermissionBehavior,
	type PermissionResult,
} from './approval.js'
export { composeAllDepartmentInjections } from './inject.js'
export {
	getPublish,
	listPublishes,
	markReversed,
	type PublishedEntry,
	type PublishStatus,
	publishedLogPath,
	recordPublish,
} from './publishedLog.js'
