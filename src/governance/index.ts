/**
 * Governance Module — 100x Code Governance System
 *
 * Permanent multi-dimensional code quality analysis with
 * architecture guardrails and auto-fix generation.
 */

// Engine
export { GovernanceEngine, getGovernanceEngine } from './governanceEngine.js'

// Scoring
export { scoreFile, scoreModule, computeWeightedScore, detectRegressions } from './scoringEngine.js'

// Static Analysis
export {
	analyzeComplexity,
	analyzeTypeSafety,
	analyzeErrorHandling,
	analyzeNaming,
	analyzeSecurity,
	extractImports,
	buildDependencyGraph,
	detectCircularDependencies,
	extractModuleFromPath,
} from './staticAnalyzer.js'

// Architecture
export {
	enforceArchitectureRules,
	getDefaultArchitectureRules,
	validateDependencyDirection,
	detectCircularDependencies as detectArchCircularDeps,
} from './architectureGuard.js'

// Auto-Fix
export { generateAutoFixes, formatFixAsDiff, applyAutoFix } from './autoFixGenerator.js'

// Types
export type {
	GovernanceDimension,
	FindingSeverity,
	GovernanceFinding,
	DimensionScore,
	GovernanceScore,
	ViolationType,
	ArchitectureRule,
	ArchitectureViolation,
	GovernanceConfig,
	AutoFixSuggestion,
	GovernanceReport,
	GovernanceHistoryEntry,
	ComplexityMetrics,
	TypeSafetyMetrics,
	ErrorHandlingMetrics,
	DependencyAnalysis,
} from './types.js'

export { DEFAULT_GOVERNANCE_CONFIG, DEFAULT_DIMENSION_WEIGHTS } from './types.js'
