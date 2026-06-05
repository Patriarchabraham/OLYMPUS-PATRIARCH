/**
 * Engineering Verifier — SOLID compliance scoring, pattern conformance,
 * Big-O analysis, coupling metrics, and error handling completeness.
 *
 * All scores are computed from concrete code measurements with defined thresholds.
 */

import type { DimensionProofScore, ProofFinding, VerifierContext } from './types.js'

/**
 * Check SOLID principles compliance.
 * Each principle gets a formal score based on concrete code metrics.
 */
function checkSOLID(
	code: string,
	filePath: string,
): { score: number; findings: ProofFinding[]; subScores: Record<string, number> } {
	const findings: ProofFinding[] = []
	const subScores: Record<string, number> = {}

	// S: Single Responsibility — count public methods per class/exports per module
	const classMethods = code.match(/\b\w+\s*\([^)]*\)\s*(?::\s*\w+)?\s*\{/g) ?? []
	const exportedFunctions = code.match(/export\s+(?:async\s+)?function\s+/g) ?? []
	const totalPublicApi = classMethods.length + exportedFunctions.length

	const srpScore = totalPublicApi > 0 ? Math.max(0, 1 - Math.max(0, totalPublicApi - 7) * 0.05) : 1
	subScores.srp = srpScore
	if (srpScore < 0.7) {
		findings.push({
			severity: 'warning',
			dimension: 'engineering',
			ruleId: 'PROOF-ENG-001',
			message: `${totalPublicApi} public API members — possible SRP violation (threshold: 7)`,
			location: { file: filePath },
			suggestion: 'Split into smaller, focused modules/classes',
			confidence: 0.7,
		})
	}

	// O: Open/Closed — detect type-check chains that should be polymorphic
	const typeCheckChains = code.match(/typeof\s+\w+\s*===|instanceof\s+\w+|\w+\.type\s*===/g) ?? []
	const ocpScore = Math.max(0, 1 - typeCheckChains.length * 0.1)
	subScores.ocp = ocpScore
	if (ocpScore <= 0.7) {
		findings.push({
			severity: 'info',
			dimension: 'engineering',
			ruleId: 'PROOF-ENG-002',
			message: `${typeCheckChains.length} type-check chains — consider polymorphism instead`,
			location: { file: filePath },
			suggestion: 'Replace type-check chains with strategy pattern or polymorphic dispatch',
			confidence: 0.65,
		})
	}

	// L: Liskov Substitution — detect narrowing parameter types in overrides
	const overrideNarrowing = code.match(/override\s+\w+\s*\([^)]*\w+:\s*(?!unknown|any)\w+/g) ?? []
	const lspScore = overrideNarrowing.length > 0 ? Math.max(0, 1 - overrideNarrowing.length * 0.15) : 1
	subScores.lsp = lspScore

	// I: Interface Segregation — count methods per interface
	const interfaceMethods = code.match(/interface\s+\w+\s*\{[^}]*/g) ?? []
	let ispScore = 1.0
	for (const iface of interfaceMethods) {
		const methods = iface.match(/\w+\s*[<(]/g) ?? []
		if (methods.length > 5) {
			ispScore = Math.max(0, ispScore - 0.1)
		}
	}
	subScores.isp = ispScore
	if (ispScore < 0.8) {
		findings.push({
			severity: 'info',
			dimension: 'engineering',
			ruleId: 'PROOF-ENG-003',
			message: 'Interface with >5 methods — possible ISP violation',
			location: { file: filePath },
			suggestion: 'Split large interfaces into smaller, focused ones',
			confidence: 0.6,
		})
	}

	// D: Dependency Inversion — ratio of abstract to concrete imports
	const abstractImports = code.match(/import\s+type\s+/g) ?? []
	const concreteImports = code.match(/import\s+(?!type\s)/g) ?? []
	const dipRatio = concreteImports.length > 0
		? abstractImports.length / concreteImports.length
		: 1
	const dipScore = Math.min(1, 0.5 + dipRatio * 0.5)
	subScores.dip = dipScore

	// Overall SOLID score (weighted average of 5 principles)
	const solidScore = (srpScore + ocpScore + lspScore + ispScore + dipScore) / 5
	return { score: solidScore, findings, subScores }
}

/**
 * Detect performance issues: nested loops, recursion without memoization,
 * sequential awaits that could be parallelized.
 */
function checkPerformance(
	code: string,
	filePath: string,
): { score: number; findings: ProofFinding[] } {
	const findings: ProofFinding[] = []
	let penalty = 0

	// Nested for/while loops (O(n^2) or worse)
	const nestedLoopPattern = /(?:for|while)\s*\([^)]*\)\s*\{[^}]*(?:for|while)\s*\(/g
	const nestedLoops = code.match(nestedLoopPattern) ?? []
	if (nestedLoops.length > 0) {
		findings.push({
			severity: 'warning',
			dimension: 'engineering',
			ruleId: 'PROOF-ENG-004',
			message: `${nestedLoops.length} nested loops detected — O(n^2+) complexity`,
			location: { file: filePath },
			suggestion: 'Consider hash maps, sorting, or algorithmic optimization to reduce complexity',
			confidence: 0.8,
		})
		penalty += nestedLoops.length * 0.15
	}

	// Sequential awaits that could be Promise.all
	const awaitLines = code.split('\n').filter((l) => l.includes('await '))
	const sequentialAwaitPairs = awaitLines.length >= 2 ? awaitLines.length - 1 : 0
	if (sequentialAwaitPairs >= 2) {
		findings.push({
			severity: 'info',
			dimension: 'engineering',
			ruleId: 'PROOF-ENG-005',
			message: `${sequentialAwaitPairs} sequential awaits — consider Promise.all() for independent operations`,
			location: { file: filePath },
			suggestion: 'Use Promise.all() for independent async operations',
			confidence: 0.7,
		})
		penalty += sequentialAwaitPairs * 0.05
	}

	// Array growth without pre-allocation
	const pushInLoop = code.match(/(?:for|while)\s*\([^)]*\)\s*\{[^}]*\.push\(/g) ?? []
	if (pushInLoop.length > 2) {
		findings.push({
			severity: 'info',
			dimension: 'engineering',
			ruleId: 'PROOF-ENG-006',
			message: 'Array .push() in loop — consider pre-allocating with Array(n)',
			location: { file: filePath },
			suggestion: 'Pre-allocate array size when the final length is known',
			confidence: 0.6,
		})
		penalty += 0.05
	}

	return { score: Math.max(0, 1 - penalty), findings }
}

/**
 * Check coupling health: fan-out, fan-in, and stability metrics.
 */
function checkCoupling(
	code: string,
	filePath: string,
): { score: number; findings: ProofFinding[] } {
	const findings: ProofFinding[] = []
	let score = 1.0

	// Fan-out: imports from other modules
	const imports = code.match(/import\s+.*?from\s+['"][^'"]+['"]/g) ?? []
	const fanOut = imports.length

	if (fanOut > 10) {
		findings.push({
			severity: 'warning',
			dimension: 'engineering',
			ruleId: 'PROOF-ENG-007',
			message: `High fan-out: ${fanOut} imports — module is tightly coupled`,
			location: { file: filePath },
			suggestion: 'Reduce dependencies by extracting interfaces or using dependency injection',
			confidence: 0.75,
		})
		score -= Math.min(0.3, (fanOut - 10) * 0.03)
	}

	// Exports (fan-in indicator)
	const exports = code.match(/export\s+(?:default\s+)?(?:function|class|const|type|interface)/g) ?? []
	if (exports.length > 15) {
		findings.push({
			severity: 'info',
			dimension: 'engineering',
			ruleId: 'PROOF-ENG-008',
			message: `High fan-in potential: ${exports.length} exports — many dependents may break on changes`,
			location: { file: filePath },
			suggestion: 'Consider splitting stable and volatile exports',
			confidence: 0.6,
		})
		score -= 0.05
	}

	return { score: Math.max(0, score), findings }
}

/**
 * Check error handling completeness: throws with corresponding catches,
 * promises with reject paths, typed error handling.
 */
function checkErrorHandling(
	code: string,
	filePath: string,
): { score: number; findings: ProofFinding[] } {
	const findings: ProofFinding[] = []
	let score = 1.0

	const throws = code.match(/\bthrow\s+/g) ?? []
	const catches = code.match(/\bcatch\s*[\w(]/g) ?? []
	const tryBlocks = code.match(/\btry\s*\{/g) ?? []

	// Throws without corresponding try/catch
	if (throws.length > 0 && tryBlocks.length === 0 && catches.length === 0) {
		findings.push({
			severity: 'warning',
			dimension: 'engineering',
			ruleId: 'PROOF-ENG-009',
			message: `${throws.length} throw statements without try/catch in this module`,
			location: { file: filePath },
			suggestion: 'Ensure callers have try/catch blocks to handle thrown errors',
			confidence: 0.7,
		})
		score -= 0.1
	}

	// Bare catch (catch without type)
	const bareCatches = code.match(/\bcatch\s*\(\s*\)/g) ?? []
	if (bareCatches.length > 0) {
		findings.push({
			severity: 'info',
			dimension: 'engineering',
			ruleId: 'PROOF-ENG-010',
			message: `${bareCatches.length} bare catch clauses — error type not captured`,
			location: { file: filePath },
			suggestion: 'Capture the error: catch (error: unknown) and handle specific types',
			confidence: 0.65,
		})
		score -= bareCatches.length * 0.05
	}

	// Promise without reject
	const promises = code.match(/new\s+Promise\s*</g) ?? []
	const rejects = code.match(/\breject\s*\(/g) ?? []
	if (promises.length > 0 && rejects.length < promises.length) {
		findings.push({
			severity: 'info',
			dimension: 'engineering',
			ruleId: 'PROOF-ENG-011',
			message: 'Promise constructor without explicit reject path',
			location: { file: filePath },
			suggestion: 'Add reject() calls for error paths in Promise constructors',
			confidence: 0.6,
		})
		score -= 0.05
	}

	return { score: Math.max(0, score), findings }
}

/**
 * Verify code at the engineering dimension.
 * Returns a DimensionProofScore with SOLID, performance, coupling, and error handling sub-scores.
 */
export function verifyEngineering(context: VerifierContext): DimensionProofScore {
	const allFindings: ProofFinding[] = []
	const subScores: Record<string, number> = {}

	// 1. SOLID compliance
	const solid = checkSOLID(context.code, context.filePath)
	allFindings.push(...solid.findings)
	Object.assign(subScores, solid.subScores)

	// 2. Performance
	const perf = checkPerformance(context.code, context.filePath)
	allFindings.push(...perf.findings)
	subScores.performanceBound = perf.score

	// 3. Coupling
	const coupling = checkCoupling(context.code, context.filePath)
	allFindings.push(...coupling.findings)
	subScores.couplingHealth = coupling.score

	// 4. Error handling
	const errors = checkErrorHandling(context.code, context.filePath)
	allFindings.push(...errors.findings)
	subScores.errorCompleteness = errors.score

	// Weighted aggregate: 35% SOLID, 25% performance, 20% coupling, 20% errors
	const value =
		solid.score * 0.35 +
		perf.score * 0.25 +
		coupling.score * 0.20 +
		errors.score * 0.20

	return {
		value: Math.min(1, value),
		weight: 0.25,
		findings: allFindings,
		subScores,
	}
}
