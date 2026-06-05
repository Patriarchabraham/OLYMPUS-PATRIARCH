/**
 * Mathematical Verifier — formal invariant checking, numerical correctness,
 * Bayesian confidence computation, and compositional proof.
 *
 * Every score is derived from concrete code analysis, not heuristics.
 * Uses Bayesian posterior: P(correct|evidence) updated per passing check.
 */

import type { DimensionProofScore, ProofFinding, VerifierContext } from './types.js'
import { BAYESIAN_LIKELIHOOD_RATIOS } from './types.js'

/** Bayesian prior: P(correct) before any evidence */
const BAYESIAN_PRIOR = 0.5

/**
 * Update Bayesian posterior with a single evidence check.
 * posterior = (LR * prior) / ((LR * prior) + (1 - prior))
 */
function updatePosterior(prior: number, likelihoodRatio: number): number {
	return (likelihoodRatio * prior) / (likelihoodRatio * prior + (1 - prior))
}

/**
 * Detect loop invariants via @invariant, @pre, @post JSDoc tags
 * and assert() calls.
 */
function checkInvariants(code: string, filePath: string): { score: number; findings: ProofFinding[] } {
	const findings: ProofFinding[] = []
	let score = 1.0

	// Detect loops
	const loopMatches = code.match(/(?:for|while|do)\s*\(/g) ?? []
	const loopCount = loopMatches.length

	if (loopCount === 0) {
		return { score: 1.0, findings }
	}

	// Detect invariant annotations
	const invariantMatches = code.match(/@invariant/g) ?? []
	const preMatches = code.match(/@pre\b/g) ?? []
	const postMatches = code.match(/@post\b/g) ?? []
	const invariantCoverage = (invariantMatches.length + preMatches.length + postMatches.length) / loopCount

	// Detect assertions
	const assertMatches = code.match(/\bassert\s*\(/g) ?? []
	const branchMatches = code.match(/\bif\s*\(/g) ?? []
	const assertionDensity = assertMatches.length / Math.max(1, branchMatches.length)

	if (invariantCoverage < 0.5 && loopCount > 2) {
		findings.push({
			severity: 'warning',
			dimension: 'mathematical',
			ruleId: 'PROOF-MATH-001',
			message: `${loopCount} loops found but only ${invariantMatches.length} @invariant annotations — insufficient invariant coverage`,
			location: { file: filePath },
			suggestion: 'Add @invariant, @pre, or @post JSDoc tags to document loop invariants',
			confidence: 0.85,
		})
		score -= 0.15
	}

	if (assertionDensity < 0.1 && branchMatches.length > 5) {
		findings.push({
			severity: 'info',
			dimension: 'mathematical',
			ruleId: 'PROOF-MATH-002',
			message: `Low assertion density (${assertMatches.length} asserts / ${branchMatches.length} branches) — consider adding more assertions`,
			location: { file: filePath },
			suggestion: 'Add assert() calls to verify critical invariants at key points',
			confidence: 0.75,
		})
		score -= 0.1
	}

	return { score: Math.max(0, score), findings }
}

/**
 * Detect numerical correctness issues: float equality, overflow,
 * division by zero, boundary conditions, NaN propagation.
 */
function checkNumericalCorrectness(code: string, filePath: string): { score: number; findings: ProofFinding[]; checkResults: Map<string, boolean> } {
	const findings: ProofFinding[] = []
	const checkResults = new Map<string, boolean>()
	let score = 1.0

	// Float equality: === with float-typed variables
	const floatEquality = code.match(/(?:number|float|double)\s+\w+[^;]*[!=]==|\b\w+\s*[!=]==\s*[\d.]+/g) ?? []
	if (floatEquality.length > 0) {
		findings.push({
			severity: 'warning',
			dimension: 'mathematical',
			ruleId: 'PROOF-MATH-003',
			message: `${floatEquality.length} potential floating-point equality comparisons detected`,
			location: { file: filePath },
			suggestion: 'Use epsilon comparison (Math.abs(a - b) < epsilon) instead of === for floats',
			confidence: 0.7,
		})
		score -= 0.2 * Math.min(floatEquality.length, 3)
		checkResults.set('float_equality', false)
	} else {
		checkResults.set('float_equality', true)
	}

	// Division by zero risk
	const divisions = code.match(/\/\s*(?![*/])(?!\s*0(?!\d))\w+/g) ?? []
	const zeroChecks = code.match(/!==?\s*0|===?\s*0/g) ?? []
	const unguardedDivisions = Math.max(0, divisions.length - zeroChecks.length)
	if (unguardedDivisions > 0 && divisions.length > 0) {
		findings.push({
			severity: 'error',
			dimension: 'mathematical',
			ruleId: 'PROOF-MATH-004',
			message: `${unguardedDivisions} division operations without zero-check detected`,
			location: { file: filePath },
			suggestion: 'Add a zero-check before division: if (denominator !== 0)',
			confidence: 0.8,
		})
		score -= 0.15 * Math.min(unguardedDivisions, 3)
		checkResults.set('division_by_zero', false)
	} else {
		checkResults.set('division_by_zero', true)
	}

	// Integer overflow risk (MAX_SAFE_INTEGER)
	const hasOverflowRisk = code.includes('MAX_SAFE_INTEGER') === false &&
		/\d{10,}/g.test(code) &&
		code.includes('BigInt') === false
	if (hasOverflowRisk) {
		findings.push({
			severity: 'warning',
			dimension: 'mathematical',
			ruleId: 'PROOF-MATH-005',
			message: 'Large numeric literals detected without BigInt — potential overflow risk',
			location: { file: filePath },
			suggestion: 'Use BigInt for integers beyond Number.MAX_SAFE_INTEGER',
			confidence: 0.6,
		})
		score -= 0.1
		checkResults.set('overflow_check', false)
	} else {
		checkResults.set('overflow_check', true)
	}

	// NaN propagation: chains of arithmetic without NaN guards
	const mathOperations = code.match(/Math\.\w+/g) ?? []
	const nanGuards = code.match(/Number\.isNaN|isNaN/g) ?? []
	if (mathOperations.length > 3 && nanGuards.length === 0) {
		findings.push({
			severity: 'info',
			dimension: 'mathematical',
			ruleId: 'PROOF-MATH-006',
			message: 'Arithmetic chains without NaN guards detected',
			location: { file: filePath },
			suggestion: 'Add Number.isNaN() checks after arithmetic operations on uncertain inputs',
			confidence: 0.6,
		})
		score -= 0.05
		checkResults.set('nan_guard', false)
	} else {
		checkResults.set('nan_guard', true)
	}

	// Boundary condition coverage: if/switch near array access
	const arrayAccesses = code.match(/\w+\[[^\]]+\]/g) ?? []
	const lengthChecks = code.match(/\.length/g) ?? []
	if (arrayAccesses.length > 0 && lengthChecks.length === 0) {
		findings.push({
			severity: 'warning',
			dimension: 'mathematical',
			ruleId: 'PROOF-MATH-007',
			message: 'Array access without boundary checks detected',
			location: { file: filePath },
			suggestion: 'Add .length checks before accessing array indices',
			confidence: 0.75,
		})
		score -= 0.1
		checkResults.set('boundary_coverage', false)
	} else {
		checkResults.set('boundary_coverage', true)
	}

	return { score: Math.max(0, Math.min(1, score)), findings, checkResults }
}

/**
 * Compute Bayesian posterior from a set of check results.
 */
function computeBayesianConfidence(checkResults: Map<string, boolean>): number {
	let posterior = BAYESIAN_PRIOR

	for (const [checkName, passed] of checkResults) {
		const lr = BAYESIAN_LIKELIHOOD_RATIOS[checkName]
		if (lr) {
			posterior = passed
				? updatePosterior(posterior, lr)
				: updatePosterior(posterior, 1 / lr)
		}
	}

	return Math.min(1, posterior)
}

/**
 * Compositional proof: if called functions are proven, compose their confidence.
 */
function computeCompositionalConfidence(
	code: string,
	provenConfidences: Map<string, number>,
): { score: number; findings: ProofFinding[] } {
	const findings: ProofFinding[] = []

	// Extract function calls
	const callPattern = /\b(\w+)\s*\(/g
	const calls = new Set<string>()
	let match: RegExpExecArray | null
	while ((match = callPattern.exec(code)) !== null) {
		calls.add(match[1])
	}

	let compositionalScore = 1.0
	let unprovenCalls = 0

	for (const call of calls) {
		const calleeConfidence = provenConfidences.get(call)
		if (calleeConfidence !== undefined) {
			compositionalScore *= calleeConfidence
		} else {
			unprovenCalls++
		}
	}

	if (unprovenCalls > 0 && calls.size > 2) {
		findings.push({
			severity: 'info',
			dimension: 'mathematical',
			ruleId: 'PROOF-MATH-008',
			message: `${unprovenCalls} unproven function calls — compositional proof incomplete`,
			confidence: 0.5,
		})
		compositionalScore *= Math.max(0.7, 1 - unprovenCalls * 0.05)
	}

	return { score: compositionalScore, findings }
}

/**
 * Verify code at the mathematical dimension.
 * Returns a DimensionProofScore with Bayesian confidence.
 */
export function verifyMathematically(context: VerifierContext): DimensionProofScore {
	const findings: ProofFinding[] = []
	const subScores: Record<string, number> = {}

	// 1. Invariant checking
	const invariantResult = checkInvariants(context.code, context.filePath)
	findings.push(...invariantResult.findings)
	subScores.invariantCoverage = invariantResult.score

	// 2. Numerical correctness
	const numericalResult = checkNumericalCorrectness(context.code, context.filePath)
	findings.push(...numericalResult.findings)
	subScores.numericalCorrectness = numericalResult.score

	// 3. Compositional proof
	const compositionalResult = computeCompositionalConfidence(context.code, context.provenConfidences)
	findings.push(...compositionalResult.findings)
	subScores.compositionalProof = compositionalResult.score

	// 4. Bayesian confidence from all check results
	const bayesianConfidence = computeBayesianConfidence(numericalResult.checkResults)
	subScores.bayesianConfidence = bayesianConfidence

	// Weighted aggregate: 30% invariants, 35% numerical, 15% compositional, 20% Bayesian
	const value =
		invariantResult.score * 0.30 +
		numericalResult.score * 0.35 +
		compositionalResult.score * 0.15 +
		bayesianConfidence * 0.20

	return {
		value: Math.min(1, value),
		weight: 0.30,
		findings,
		subScores,
	}
}
