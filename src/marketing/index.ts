/** Olympuz Marketing & Growth department — public surface. */

export {
	extractMarketingAssets,
	marketingKnowledgeStats,
	persistMarketingAssets,
	recallMarketingRelevant,
	recordMarketingLearning,
	runMarketingCurator,
} from './curator.js'
export {
	formatCampaignPlanForDelegation,
	MARKETING_ROLES,
	planCampaign,
} from './department.js'
export {
	applyMarketingDirective,
	KNOWN_MARKETING_POLICY_KEYS,
	loadMarketingGovernance,
	marketingGovernanceNotes,
	parseMarketingDirective,
	resolveMarketingPolicy,
	setMarketingPolicyFromDirective,
} from './governance.js'
export { composeMarketingAppendSystemPrompt } from './inject.js'
export { detectMarketingIntent, isMarketingIntent, MARKETING_CUES } from './intent.js'
export {
	DEFAULT_MARKETING_CONFIG,
	getMarketingEngine,
	isMarketingActive,
	isMarketingKillSwitchOn,
	isTestEnv,
	MarketingEngine,
	resetMarketingEngine,
	resolveMarketingEnabled,
} from './marketingEngine.js'
export {
	MARKETING_PRD,
	MARKETING_PRD_COMPRESSED,
	MARKETING_PRD_SECTIONS,
	MARKETING_PRD_VERSION,
} from './principles.js'
