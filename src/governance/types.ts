/**
 * Governance Engine Types — 100x Code Governance System
 *
 * Defines all types for multi-dimensional code quality analysis,
 * architecture guardrails, and auto-fix generation.
 */

// ============================================================
// Core Types
// ============================================================

/** 12 governance dimensions for code quality analysis */
export type GovernanceDimension =
	| 'security'
	| 'performance'
	| 'maintainability'
	| 'architecture'
	| 'types'
	| 'testing'
	| 'documentation'
	| 'accessibility'
	| 'errorHandling'
	| 'naming'
	| 'dependencyHealth'
	| 'complexity'

/** Severity levels for governance findings */
export type FindingSeverity = 'info' | 'warning' | 'error' | 'critical'

/** A single governance finding (issue detected) */
export interface GovernanceFinding {
	/** Severity level */
	severity: FindingSeverity
	/** Which dimension this finding belongs to */
	dimension: GovernanceDimension
	/** Human-readable description */
	message: string
	/** File location (optional) */
	location?: { file: string; line?: number; column?: number }
	/** Rule identifier e.g. "GOV-SEC-001" */
	ruleId: string
	/** Suggested auto-fix (if available) */
	autoFix?: string
	/** Links to documentation or patterns */
	references?: string[]
}

/** Score for a single dimension */
export interface DimensionScore {
	/** Score value 0-1 */
	value: number
	/** Configurable weight for this dimension */
	weight: number
	/** Findings discovered for this dimension */
	findings: GovernanceFinding[]
	/** Whether an auto-fix is available */
	autoFixAvailable: boolean
}

/** Complete governance score for a file or module */
export interface GovernanceScore {
	/** Weighted composite score 0-1 */
	overall: number
	/** Per-dimension scores */
	dimensions: Record<GovernanceDimension, DimensionScore>
	/** When this score was computed */
	timestamp: number
	/** File path (if file-level score) */
	fileId?: string
	/** Module name (if module-level score) */
	moduleName?: string
	/** Total number of findings */
	totalFindings: number
	/** Number of auto-fixes available */
	autoFixesAvailable: number
}

// ============================================================
// Architecture Guardrails
// ============================================================

/** Types of architecture violations */
export type ViolationType = 'circular' | 'wrong_direction' | 'boundary_cross' | 'layer_violation'

/** An architecture rule defining allowed/forbidden imports */
export interface ArchitectureRule {
	/** Source module (e.g., "reasoning") */
	sourceModule: string
	/** Glob patterns for allowed import paths */
	allowedImports: string[]
	/** Glob patterns for forbidden import paths */
	forbiddenImports: string[]
	/** Human-readable description of the rule */
	description: string
}

/** A detected architecture violation */
export interface ArchitectureViolation {
	/** Module that contains the violation */
	fromModule: string
	/** Module being imported */
	toModule: string
	/** Type of violation */
	violationType: ViolationType
	/** What directions are allowed */
	allowedDirections: string[]
	/** The actual import path */
	actualImport: string
	/** File where the violation occurs */
	file: string
	/** Line number */
	line?: number
}

// ============================================================
// Configuration
// ============================================================

/** Default weights for governance dimensions */
export const DEFAULT_DIMENSION_WEIGHTS: Record<GovernanceDimension, number> = {
	security: 0.15,
	performance: 0.1,
	maintainability: 0.12,
	architecture: 0.1,
	types: 0.08,
	testing: 0.08,
	documentation: 0.07,
	accessibility: 0.05,
	errorHandling: 0.08,
	naming: 0.05,
	dependencyHealth: 0.06,
	complexity: 0.06,
}

/** Governance engine configuration */
export interface GovernanceConfig {
	/** Which dimensions to analyze (default: all) */
	enabledDimensions: GovernanceDimension[]
	/** Per-dimension weights */
	dimensionWeights: Record<GovernanceDimension, number>
	/** Minimum acceptable score (gate threshold) */
	minimumScore: number
	/** Architecture rules to enforce */
	architectureRules: ArchitectureRule[]
	/** Whether to persist score history */
	persistHistory: boolean
	/** Directory for persistent state */
	dataDir?: string
	/** Whether auto-fix analysis is enabled */
	autoFixEnabled: boolean
}

/** Default governance configuration */
export const DEFAULT_GOVERNANCE_CONFIG: GovernanceConfig = {
	enabledDimensions: [
		'security',
		'performance',
		'maintainability',
		'architecture',
		'types',
		'testing',
		'documentation',
		'accessibility',
		'errorHandling',
		'naming',
		'dependencyHealth',
		'complexity',
	],
	dimensionWeights: DEFAULT_DIMENSION_WEIGHTS,
	minimumScore: 0.7,
	architectureRules: [],
	persistHistory: true,
	autoFixEnabled: true,
}

// ============================================================
// Analysis Results
// ============================================================

/** Auto-fix suggestion */
export interface AutoFixSuggestion {
	/** The finding this fix addresses */
	ruleId: string
	/** Human-readable description */
	description: string
	/** Original code */
	original: string
	/** Fixed code */
	fixed: string
	/** Confidence in the fix 0-1 */
	confidence: number
	/** File path */
	filePath: string
	/** Line number */
	line?: number
}

/** Full governance report for a project scan */
export interface GovernanceReport {
	/** Overall project score */
	overallScore: number
	/** Per-file scores */
	fileScores: Map<string, GovernanceScore>
	/** Per-module scores */
	moduleScores: Map<string, GovernanceScore>
	/** Architecture violations detected */
	violations: ArchitectureViolation[]
	/** All findings across all files */
	allFindings: GovernanceFinding[]
	/** Auto-fix suggestions */
	autoFixes: AutoFixSuggestion[]
	/** When this report was generated */
	timestamp: number
	/** How long the scan took */
	durationMs: number
	/** Number of files analyzed */
	filesAnalyzed: number
	/** Regressions detected (vs. previous scan) */
	regressions: string[]
}

/** History entry for tracking governance over time */
export interface GovernanceHistoryEntry {
	/** When this entry was recorded */
	timestamp: number
	/** File -> overall score mapping */
	scores: Record<string, number>
	/** Files that regressed below threshold */
	regressions: string[]
	/** Files that improved */
	improvements: string[]
	/** Total findings count */
	totalFindings: number
	/** Number of auto-fixes applied */
	autoFixesApplied: number
}

/** Complexity metrics for a single file */
export interface ComplexityMetrics {
	/** Cyclomatic complexity (branch count + 1) */
	cyclomatic: number
	/** Maximum nesting depth */
	maxNestingDepth: number
	/** Average function length (lines) */
	avgFunctionLength: number
	/** Longest function (lines) */
	longestFunction: number
	/** Total lines of code */
	totalLines: number
	/** Lines of actual code (not blank/comments) */
	codeLines: number
	/** Number of functions */
	functionCount: number
}

/** Type safety metrics */
export interface TypeSafetyMetrics {
	/** Number of `any` usages */
	anyCount: number
	/** Number of `as` casts */
	castCount: number
	/** Number of functions missing return types */
	missingReturnTypes: number
	/** Number of untyped parameters */
	untypedParams: number
	/** Number of non-null assertions (!) */
	nonNullAssertions: number
}

/** Error handling metrics */
export interface ErrorHandlingMetrics {
	/** Number of bare catch blocks */
	bareCatchCount: number
	/** Number of catch with `any` or no type */
	untypedCatchCount: number
	/** Number of unhandled promise patterns */
	unhandledPromiseCount: number
	/** Number of empty catch blocks */
	emptyCatchCount: number
}

/** Dependency analysis result */
export interface DependencyAnalysis {
	/** Import graph: file -> imported files */
	importGraph: Map<string, string[]>
	/** Circular dependency chains */
	circularDependencies: string[][]
	/** Module -> set of files */
	moduleFiles: Map<string, Set<string>>
}
