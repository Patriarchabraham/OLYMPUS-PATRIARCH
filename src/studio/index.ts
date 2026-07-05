/**
 * Olympuz Studio — public API barrel.
 *
 * The Studio Design & Generation Department: an always-on, knowledge-driven,
 * multi-agent department that makes every web / Android / Windows build
 * "the best and most complete possible." Composes the existing design infra
 * (designEvolution, src/design) rather than duplicating it.
 */

export {
	extractAssets,
	knowledgeStats,
	persistAssets,
	recallRelevant,
	recordLearning,
	runCurator,
} from './curator.js'
export {
	formatPlanForDelegation,
	planDepartment,
	STUDIO_ROLES,
} from './department.js'
export {
	buildMotionTokens,
	buildSpacingScale,
	buildTypographyScale,
	deriveSemanticTokens,
	generateDesignTokens,
	generateRamp,
	tokensToComposeKotlin,
	tokensToCSS,
	tokensToWinUIXaml,
} from './designTokens.js'
export {
	applyAdminDirective,
	governanceNotes,
	loadGovernance,
	parseAdminDirective,
	resolvePolicy,
	setPolicyFromDirective,
} from './governance.js'
export { detectStudioIntent, isStudioBuildIntent } from './intent.js'
export {
	ALIVE_ELEGANCE_DIRECTIVE,
	DESIGN_STANDARDS,
	STUDIO_PRD,
	STUDIO_PRD_COMPRESSED,
	STUDIO_PRD_SECTIONS,
	STUDIO_PRD_VERSION,
} from './principles.js'
export type { GenerateTokensOptions } from './studioEngine.js'
export {
	DEFAULT_STUDIO_CONFIG,
	getStudioEngine,
	isStudioActive,
	isTestEnv,
	resetStudioEngine,
	StudioEngine,
} from './studioEngine.js'
export * from './types.js'
