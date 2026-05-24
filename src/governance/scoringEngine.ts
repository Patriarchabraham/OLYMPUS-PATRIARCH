/**
 * ScoringEngine — Multi-dimensional code quality scoring.
 *
 * Combines static analysis results into weighted dimension scores
 * and computes overall governance scores for files and modules.
 */

import type {
	DimensionScore,
	GovernanceConfig,
	GovernanceDimension,
	GovernanceFinding,
	GovernanceScore,
} from './types.js'
import { DEFAULT_DIMENSION_WEIGHTS } from './types.js'
import {
	analyzeComplexity,
	analyzeErrorHandling,
	analyzeNaming,
	analyzeSecurity,
	analyzeTypeSafety,
} from './staticAnalyzer.js'

// ============================================================
// Dimension Scoring Helpers
// ============================================================

/** Clamp a number between min and max */
function clamp(value: number, min: number, max: number): number {
	return Math.max(min, Math.min(max, value))
}

/** Score complexity dimension (0-1) */
function scoreComplexity(source: string): { score: number; findings: GovernanceFinding[] } {
	const metrics = analyzeComplexity(source, '')
	const findings: GovernanceFinding[] = []

	let score = 1.0

	// Penalize high cyclomatic complexity
	if (metrics.cyclomatic > 20) {
		findings.push({ severity: 'error', dimension: 'complexity', message: `Cyclomatic complexity ${metrics.cyclomatic} exceeds threshold (20)`, ruleId: 'GOV-CMP-001' })
		score -= 0.3
	} else if (metrics.cyclomatic > 10) {
		findings.push({ severity: 'warning', dimension: 'complexity', message: `Cyclomatic complexity ${metrics.cyclomatic} is high (threshold: 10)`, ruleId: 'GOV-CMP-001' })
		score -= 0.15
	}

	// Penalize deep nesting
	if (metrics.maxNestingDepth > 6) {
		findings.push({ severity: 'error', dimension: 'complexity', message: `Nesting depth ${metrics.maxNestingDepth} exceeds threshold (6)`, ruleId: 'GOV-CMP-002' })
		score -= 0.2
	} else if (metrics.maxNestingDepth > 4) {
		findings.push({ severity: 'warning', dimension: 'complexity', message: `Nesting depth ${metrics.maxNestingDepth} is high`, ruleId: 'GOV-CMP-002' })
		score -= 0.1
	}

	// Penalize long functions
	if (metrics.longestFunction > 100) {
		findings.push({ severity: 'error', dimension: 'complexity', message: `Longest function is ${metrics.longestFunction} lines (threshold: 100)`, ruleId: 'GOV-CMP-003' })
		score -= 0.15
	} else if (metrics.longestFunction > 50) {
		findings.push({ severity: 'warning', dimension: 'complexity', message: `Longest function is ${metrics.longestFunction} lines`, ruleId: 'GOV-CMP-003' })
		score -= 0.05
	}

	return { score: clamp(score, 0, 1), findings }
}

/** Score type safety dimension (0-1) */
function scoreTypes(source: string): { score: number; findings: GovernanceFinding[] } {
	const metrics = analyzeTypeSafety(source)
	const findings: GovernanceFinding[] = []
	let score = 1.0

	if (metrics.anyCount > 0) {
		findings.push({ severity: 'error', dimension: 'types', message: `Found ${metrics.anyCount} \`any\` usage(s)`, ruleId: 'GOV-TYP-001', autoFix: 'Replace `any` with `unknown` or a specific type' })
		score -= metrics.anyCount * 0.1
	}

	if (metrics.castCount > 3) {
		findings.push({ severity: 'warning', dimension: 'types', message: `${metrics.castCount} type casts found — excessive casting suggests type issues`, ruleId: 'GOV-TYP-002' })
		score -= 0.1
	}

	if (metrics.missingReturnTypes > 0) {
		findings.push({ severity: 'info', dimension: 'types', message: `${metrics.missingReturnTypes} function(s) missing explicit return types`, ruleId: 'GOV-TYP-003' })
		score -= metrics.missingReturnTypes * 0.02
	}

	if (metrics.nonNullAssertions > 5) {
		findings.push({ severity: 'warning', dimension: 'types', message: `${metrics.nonNullAssertions} non-null assertions found`, ruleId: 'GOV-TYP-004' })
		score -= 0.05
	}

	return { score: clamp(score, 0, 1), findings }
}

/** Score error handling dimension (0-1) */
function scoreErrorHandling(source: string): { score: number; findings: GovernanceFinding[] } {
	const metrics = analyzeErrorHandling(source)
	const findings: GovernanceFinding[] = []
	let score = 1.0

	if (metrics.bareCatchCount > 0) {
		findings.push({ severity: 'warning', dimension: 'errorHandling', message: `${metrics.bareCatchCount} bare catch block(s) without error variable`, ruleId: 'GOV-ERR-001', autoFix: 'Add typed catch variable: catch (error: unknown)' })
		score -= metrics.bareCatchCount * 0.1
	}

	if (metrics.untypedCatchCount > 0) {
		findings.push({ severity: 'warning', dimension: 'errorHandling', message: `${metrics.untypedCatchCount} untyped catch variable(s)`, ruleId: 'GOV-ERR-002', autoFix: 'Type catch as: catch (error: unknown)' })
		score -= metrics.untypedCatchCount * 0.05
	}

	if (metrics.emptyCatchCount > 0) {
		findings.push({ severity: 'error', dimension: 'errorHandling', message: `${metrics.emptyCatchCount} empty catch block(s) — errors silently swallowed`, ruleId: 'GOV-ERR-003' })
		score -= metrics.emptyCatchCount * 0.15
	}

	if (metrics.unhandledPromiseCount > 0) {
		findings.push({ severity: 'warning', dimension: 'errorHandling', message: `${metrics.unhandledPromiseCount} unhandled promise(s) (.then without .catch)`, ruleId: 'GOV-ERR-004' })
		score -= metrics.unhandledPromiseCount * 0.05
	}

	return { score: clamp(score, 0, 1), findings }
}

/** Score naming dimension (0-1) */
function scoreNaming(source: string): { score: number; findings: GovernanceFinding[] } {
	const findings = analyzeNaming(source)
	let score = 1.0

	for (const finding of findings) {
		score -= finding.severity === 'warning' ? 0.02 : 0.01
	}

	return { score: clamp(score, 0, 1), findings }
}

/** Score security dimension (0-1) */
function scoreSecurity(source: string): { score: number; findings: GovernanceFinding[] } {
	const findings = analyzeSecurity(source)
	let score = 1.0

	for (const finding of findings) {
		if (finding.severity === 'critical') score = 0
		else if (finding.severity === 'error') score -= 0.3
		else if (finding.severity === 'warning') score -= 0.1
	}

	return { score: clamp(score, 0, 1), findings }
}

/** Score documentation dimension (0-1) */
function scoreDocumentation(source: string): { score: number; findings: GovernanceFinding[] } {
	const findings: GovernanceFinding[] = []
	let score = 1.0
	const lines = source.split('\n')

	// Check for JSDoc on exported functions
	const exportedFuncPattern = /export\s+(?:async\s+)?function\s+(\w+)/g
	let match: RegExpExecArray | null
	while ((match = exportedFuncPattern.exec(source)) !== null) {
		const funcName = match[1]
		const funcStart = match.index
		// Check if there's a JSDoc comment before the function
		const before = source.slice(Math.max(0, funcStart - 200), funcStart)
		if (!before.includes('/**') && !before.includes('* @')) {
			findings.push({
				severity: 'info',
				dimension: 'documentation',
				message: `Exported function "${funcName}" missing JSDoc documentation`,
				ruleId: 'GOV-DOC-001',
				autoFix: `Add JSDoc comment before function "${funcName}"`,
			})
			score -= 0.03
		}
	}

	// Check for module-level file comment
	if (lines.length > 0 && !lines[0].startsWith('/**') && !lines[0].startsWith('//')) {
		findings.push({
			severity: 'info',
			dimension: 'documentation',
			message: 'File missing module-level documentation comment',
			ruleId: 'GOV-DOC-002',
		})
		score -= 0.02
	}

	return { score: clamp(score, 0, 1), findings }
}

/** Score performance dimension (0-1) */
function scorePerformance(source: string): { score: number; findings: GovernanceFinding[] } {
	const findings: GovernanceFinding[] = []
	let score = 1.0
	const lines = source.split('\n')

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i]

		// Sync file operations in potentially async context
		if (/\breadFileSync|writeFileSync|existsSync|mkdirSync|readdirSync|statSync/.test(line)) {
			findings.push({
				severity: 'warning',
				dimension: 'performance',
				message: `Synchronous file operation on line ${i + 1} — consider async alternative`,
				location: { file: '', line: i + 1 },
				ruleId: 'GOV-PRF-001',
			})
			score -= 0.02
		}

		// Nested loops (O(n^2) potential)
		if (/\bfor\s*\(/.test(line)) {
			const nextLines = lines.slice(i + 1, i + 10).join('\n')
			if (/\bfor\s*\(/.test(nextLines)) {
				findings.push({
					severity: 'warning',
					dimension: 'performance',
					message: `Nested loop detected near line ${i + 1} — potential O(n^2)`,
					location: { file: '', line: i + 1 },
					ruleId: 'GOV-PRF-002',
				})
				score -= 0.05
			}
		}
	}

	return { score: clamp(score, 0, 1), findings }
}

/** Score accessibility dimension (0-1) */
function scoreAccessibility(source: string): { score: number; findings: GovernanceFinding[] } {
	const findings: GovernanceFinding[] = []
	let score = 1.0
	const lines = source.split('\n')

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i]

		// Only check TSX/JSX content
		if (!line.includes('<')) continue

		// Image without alt
		if (/<img[^>]*>/i.test(line) && !/alt\s*=/.test(line)) {
			findings.push({
				severity: 'error',
				dimension: 'accessibility',
				message: 'Image element missing alt attribute',
				location: { file: '', line: i + 1 },
				ruleId: 'GOV-A11Y-001',
			})
			score -= 0.1
		}

		// Button without aria-label (if no text content)
		if (/<button[^>]*>\s*<\/button>/i.test(line)) {
			findings.push({
				severity: 'warning',
				dimension: 'accessibility',
				message: 'Empty button element — consider adding aria-label',
				location: { file: '', line: i + 1 },
				ruleId: 'GOV-A11Y-002',
			})
			score -= 0.05
		}
	}

	return { score: clamp(score, 0, 1), findings }
}

/** Score dependency health dimension (0-1) */
function scoreDependencyHealth(
	circularCount: number,
	totalImports: number,
): { score: number; findings: GovernanceFinding[] } {
	const findings: GovernanceFinding[] = []
	let score = 1.0

	if (circularCount > 0) {
		findings.push({
			severity: 'error',
			dimension: 'dependencyHealth',
			message: `${circularCount} circular dependencies detected`,
			ruleId: 'GOV-DEP-001',
		})
		score -= circularCount * 0.2
	}

	if (totalImports > 30) {
		findings.push({
			severity: 'warning',
			dimension: 'dependencyHealth',
			message: `High import count (${totalImports}) — consider splitting module`,
			ruleId: 'GOV-DEP-002',
		})
		score -= 0.05
	}

	return { score: clamp(score, 0, 1), findings }
}

/** Score testing dimension (0-1) */
function scoreTesting(
	filePath: string,
	totalLines: number,
): { score: number; findings: GovernanceFinding[] } {
	const findings: GovernanceFinding[] = []
	let score = 0.5 // Default neutral — can't determine test coverage statically

	// Check if this IS a test file
	if (filePath.includes('.test.') || filePath.includes('.spec.') || filePath.includes('__tests__')) {
		return { score: 1.0, findings: [] }
	}

	// Check if test file exists near this file
	if (filePath.endsWith('.ts') && !filePath.endsWith('.d.ts')) {
		const testPath = filePath.replace('.ts', '.test.ts')
		const specPath = filePath.replace('.ts', '.spec.ts')
		// We can't check filesystem here, so we flag large files without tests
		if (totalLines > 200) {
			findings.push({
				severity: 'info',
				dimension: 'testing',
				message: `Large file (${totalLines} lines) — ensure test coverage: ${testPath} or ${specPath}`,
				ruleId: 'GOV-TST-001',
			})
			score -= 0.1
		}
	}

	return { score: clamp(score, 0, 1), findings }
}

/** Score maintainability dimension (0-1) — composite of other dimensions */
function scoreMaintainability(
	complexityScore: number,
	namingScore: number,
	documentationScore: number,
	totalLines: number,
): { score: number; findings: GovernanceFinding[] } {
	const findings: GovernanceFinding[] = []
	let score = complexityScore * 0.4 + namingScore * 0.3 + documentationScore * 0.3

	if (totalLines > 500) {
		findings.push({
			severity: 'info',
			dimension: 'maintainability',
			message: `File is ${totalLines} lines — consider splitting into smaller modules`,
			ruleId: 'GOV-MNT-001',
		})
		score -= 0.05
	}

	return { score: clamp(score, 0, 1), findings }
}

/** Score architecture dimension (0-1) */
function scoreArchitecture(violationCount: number): { score: number; findings: GovernanceFinding[] } {
	const findings: GovernanceFinding[] = []
	let score = 1.0

	if (violationCount > 0) {
		findings.push({
			severity: 'error',
			dimension: 'architecture',
			message: `${violationCount} architecture violation(s) detected`,
			ruleId: 'GOV-ARC-001',
		})
		score -= violationCount * 0.2
	}

	return { score: clamp(score, 0, 1), findings }
}

// ============================================================
// Public API
// ============================================================

/**
 * Compute weighted overall score from dimension scores.
 */
export function computeWeightedScore(
	dimensions: Record<GovernanceDimension, DimensionScore>,
	weights: Record<GovernanceDimension, number>,
): number {
	let totalWeight = 0
	let weightedSum = 0

	for (const dim of Object.keys(dimensions) as GovernanceDimension[]) {
		const w = weights[dim]
		const s = dimensions[dim].value
		weightedSum += s * w
		totalWeight += w
	}

	return totalWeight > 0 ? clamp(weightedSum / totalWeight, 0, 1) : 0
}

/**
 * Score a single file across all governance dimensions.
 * @param source - Source code content
 * @param filePath - Path of the file
 * @param config - Governance configuration
 * @param circularDeps - Number of circular deps involving this file
 * @param archViolations - Number of architecture violations
 */
export function scoreFile(
	source: string,
	filePath: string,
	config: GovernanceConfig,
	circularDeps = 0,
	archViolations = 0,
): GovernanceScore {
	const dimensions = {} as Record<GovernanceDimension, DimensionScore>
	const weights = config.dimensionWeights

	// Run all dimension scorers
	const complexity = scoreComplexity(source)
	const types = scoreTypes(source)
	const errorHandling = scoreErrorHandling(source)
	const naming = scoreNaming(source)
	const security = scoreSecurity(source)
	const documentation = scoreDocumentation(source)
	const performance = scorePerformance(source)
	const accessibility = scoreAccessibility(source)
	const testing = scoreTesting(filePath, source.split('\n').length)
	const dependencyHealth = scoreDependencyHealth(circularDeps, (source.match(/import\s/g) ?? []).length)
	const architecture = scoreArchitecture(archViolations)
	const maintainability = scoreMaintainability(complexity.score, naming.score, documentation.score, source.split('\n').length)

	const allScorers: [GovernanceDimension, { score: number; findings: GovernanceFinding[] }][] = [
		['complexity', complexity],
		['types', types],
		['errorHandling', errorHandling],
		['naming', naming],
		['security', security],
		['documentation', documentation],
		['performance', performance],
		['accessibility', accessibility],
		['testing', testing],
		['dependencyHealth', dependencyHealth],
		['architecture', architecture],
		['maintainability', maintainability],
	]

	let totalFindings = 0
	let autoFixesAvailable = 0

	for (const [dim, result] of allScorers) {
		if (!config.enabledDimensions.includes(dim)) continue
		const hasAutoFix = result.findings.some((f) => f.autoFix !== undefined)
		if (hasAutoFix) autoFixesAvailable++
		totalFindings += result.findings.length

		dimensions[dim] = {
			value: result.score,
			weight: weights[dim] ?? DEFAULT_DIMENSION_WEIGHTS[dim],
			findings: result.findings,
			autoFixAvailable: hasAutoFix,
		}
	}

	const overall = computeWeightedScore(dimensions, weights)

	return {
		overall,
		dimensions,
		timestamp: Date.now(),
		fileId: filePath,
		totalFindings,
		autoFixesAvailable,
	}
}

/**
 * Score an entire module by aggregating file scores.
 * @param files - Map of file path -> source code
 * @param moduleName - Name of the module
 * @param config - Governance configuration
 */
export function scoreModule(
	files: Map<string, string>,
	moduleName: string,
	config: GovernanceConfig,
): GovernanceScore {
	const fileScores: GovernanceScore[] = []

	for (const [filePath, source] of Array.from(files.entries())) {
		fileScores.push(scoreFile(source, filePath, config))
	}

	if (fileScores.length === 0) {
		return {
			overall: 1,
			dimensions: {} as Record<GovernanceDimension, DimensionScore>,
			timestamp: Date.now(),
			moduleName,
			totalFindings: 0,
			autoFixesAvailable: 0,
		}
	}

	// Aggregate: average scores per dimension
	const aggDimensions = {} as Record<GovernanceDimension, DimensionScore>
	const dimNames = Object.keys(fileScores[0].dimensions) as GovernanceDimension[]

	for (const dim of dimNames) {
		const scores = fileScores.map((s) => s.dimensions[dim]).filter(Boolean)
		if (scores.length === 0) continue

		const avgValue = scores.reduce((a, s) => a + s.value, 0) / scores.length
		const allFindings = scores.flatMap((s) => s.findings)
		const hasAutoFix = scores.some((s) => s.autoFixAvailable)

		aggDimensions[dim] = {
			value: clamp(avgValue, 0, 1),
			weight: scores[0].weight,
			findings: allFindings,
			autoFixAvailable: hasAutoFix,
		}
	}

	const overall = computeWeightedScore(aggDimensions, config.dimensionWeights)
	const totalFindings = fileScores.reduce((a, s) => a + s.totalFindings, 0)
	const autoFixesAvailable = fileScores.reduce((a, s) => a + s.autoFixesAvailable, 0)

	return {
		overall,
		dimensions: aggDimensions,
		timestamp: Date.now(),
		moduleName,
		totalFindings,
		autoFixesAvailable,
	}
}

/**
 * Detect regressions by comparing current and previous scores.
 * @returns Array of dimension names that regressed below threshold
 */
export function detectRegressions(
	current: GovernanceScore,
	previous: GovernanceScore,
): string[] {
	const regressions: string[] = []

	for (const dim of Object.keys(current.dimensions) as GovernanceDimension[]) {
		const curr = current.dimensions[dim]?.value ?? 1
		const prev = previous.dimensions[dim]?.value ?? 1
		if (curr < prev - 0.1) {
			regressions.push(dim)
		}
	}

	// Also check overall regression
	if (current.overall < previous.overall - 0.05) {
		regressions.push('overall')
	}

	return regressions
}
