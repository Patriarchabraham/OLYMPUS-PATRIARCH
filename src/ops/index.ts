/**
 * Olympuz Agentic Operations — public API barrel.
 */

export {
	extractOpsAssets,
	opsKnowledgeStats,
	persistOpsAssets,
	recallOpsRelevant,
	recordOpsLearning,
	runOpsCurator,
} from './curator.js'
export {
	formatOpsPlanForDelegation,
	OPS_ROLES,
	planOpsDepartment,
} from './department.js'
export {
	applyOpsDirective,
	loadOpsGovernance,
	opsGovernanceNotes,
	parseOpsDirective,
	resolveOpsPolicy,
	setOpsPolicyFromDirective,
} from './governance.js'
export { composeOpsAppendSystemPrompt } from './inject.js'
export { detectOpsIntent, isOpsIntent } from './intent.js'
export {
	DEFAULT_OPS_CONFIG,
	getOpsEngine,
	isOpsActive,
	isTestEnv,
	OpsEngine,
	resetOpsEngine,
} from './opsEngine.js'
export { OPS_PRD, OPS_PRD_COMPRESSED, OPS_PRD_SECTIONS, OPS_PRD_VERSION } from './principles.js'
export type {
	OpsAsset,
	OpsAssetType,
	OpsConfig,
	OpsDomain,
	OpsGovernance,
	OpsIntent,
	OpsPlan,
	OpsRole,
	OpsRunResult,
	OpsSurface,
	OpsTask,
} from './types.js'
