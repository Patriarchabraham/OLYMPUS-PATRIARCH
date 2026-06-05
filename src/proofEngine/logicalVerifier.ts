/**
 * Logical Verifier — propositional logic consistency, predicate checking,
 * dead code detection, type soundness, and conditional completeness.
 *
 * Analyzes control flow to detect contradictions, unreachable code,
 * non-exhaustive branches, and unsound type operations.
 */

import type { DimensionProofScore, ProofFinding, VerifierContext } from './types.js'

/**
 * Detect contradictions in conditional chains.
 * Flags: tautologies (always true), contradictions (impossible conditions).
 */
function checkPropositionalConsistency(
	code: string,
	filePath: string,
): { score: number; findings: ProofFinding[] } {
	const findings: ProofFinding[] = []
	let issues = 0
	let totalConditions = 0

	// Detect contradictory conditions in if/else if chains
	const ifElseChains = code.match(/if\s*\([^)]+\)(?:\s*\{[^}]*\}\s*else\s*if\s*\([^)]+\))*/g) ?? []
	for (const chain of ifElseChains) {
		totalConditions += (chain.match(/if\s*\(/g) ?? []).length
	}

	// Detect tautologies: if (true), if (!!x), if (x === x)
	const tautologies = code.match(/if\s*\(\s*(?:true|!?\s*\w+\s*===?\s*\w+)\s*\)/g) ?? []
	if (tautologies.length > 0) {
		findings.push({
			severity: 'warning',
			dimension: 'logical',
			ruleId: 'PROOF-LOGIC-001',
			message: `${tautologies.length} tautological conditions detected (always true)`,
			location: { file: filePath },
			suggestion: 'Remove or simplify always-true conditions',
			confidence: 0.8,
		})
		issues += tautologies.length
	}

	// Detect contradictions: if (false), if (x !== x)
	const contradictions = code.match(/if\s*\(\s*(?:false|!\s*true|!\s*1)\s*\)/g) ?? []
	if (contradictions.length > 0) {
		findings.push({
			severity: 'error',
			dimension: 'logical',
			ruleId: 'PROOF-LOGIC-002',
			message: `${contradictions.length} contradictory conditions detected (always false)`,
			location: { file: filePath },
			suggestion: 'Remove unreachable dead code branches',
			confidence: 0.9,
		})
		issues += contradictions.length
	}

	// Detect duplicate conditions in the same if/else chain
	const duplicatePatterns = code.match(/if\s*\(([^)]+)\)[^]*?else\s*if\s*\(\1\)/g) ?? []
	if (duplicatePatterns.length > 0) {
		findings.push({
			severity: 'error',
			dimension: 'logical',
			ruleId: 'PROOF-LOGIC-003',
			message: `${duplicatePatterns.length} duplicate conditions in if/else chains`,
			location: { file: filePath },
			suggestion: 'Consolidate or fix duplicate conditions',
			confidence: 0.85,
		})
		issues += duplicatePatterns.length
	}

	totalConditions = Math.max(1, totalConditions + tautologies.length + contradictions.length)
	const score = Math.max(0, 1 - issues / totalConditions)
	return { score, findings }
}

/**
 * Detect dead code after return/throw/break/continue statements.
 */
function checkDeadCode(
	code: string,
	filePath: string,
): { score: number; findings: ProofFinding[] } {
	const findings: ProofFinding[] = []
	const lines = code.split('\n')
	let deadLines = 0
	let totalCodeLines = 0

	const terminatingKeywords = ['return', 'throw', 'break', 'continue']

	for (let i = 0; i < lines.length; i++) {
		const trimmed = lines[i].trim()
		if (trimmed === '' || trimmed.startsWith('//') || trimmed.startsWith('/*')) continue
		totalCodeLines++

		// Check if this line is a terminating statement
		const isTerminator = terminatingKeywords.some((kw) => trimmed.startsWith(kw))
		if (!isTerminator) continue

		// Check if the next non-empty, non-comment line is before a closing brace
		for (let j = i + 1; j < lines.length; j++) {
			const nextTrimmed = lines[j].trim()
			if (nextTrimmed === '' || nextTrimmed.startsWith('//') || nextTrimmed.startsWith('/*')) continue

			// If the next line is a closing brace, it's not dead code
			if (nextTrimmed.startsWith('}') || nextTrimmed === '};') break

			// This is dead code
			deadLines++
			if (findings.length < 5) {
				findings.push({
					severity: 'warning',
					dimension: 'logical',
					ruleId: 'PROOF-LOGIC-004',
					message: `Dead code after ${trimmed.split(' ')[0]} on line ${i + 1}`,
					location: { file: filePath, line: j + 1 },
					suggestion: `Remove unreachable code after the ${trimmed.split(' ')[0]} statement`,
					confidence: 0.9,
				})
			}
			break
		}
	}

	const score = totalCodeLines > 0 ? 1 - deadLines / totalCodeLines : 1
	return { score: Math.max(0, score), findings }
}

/**
 * Check predicate logic: .every() on empty arrays, .some() with trivial predicates.
 */
function checkPredicateLogic(
	code: string,
	filePath: string,
): { score: number; findings: ProofFinding[] } {
	const findings: ProofFinding[] = []
	let issues = 0
	let totalQuantifiers = 0

	// .every() on potentially empty arrays returns true (vacuous truth)
	const everyCalls = code.match(/\.every\s*\(/g) ?? []
	totalQuantifiers += everyCalls.length

	// Flag .every() without length check
	const everyWithoutLengthCheck = everyCalls.length > 0 && !code.includes('.length')
	if (everyWithoutLengthCheck) {
		findings.push({
			severity: 'info',
			dimension: 'logical',
			ruleId: 'PROOF-LOGIC-005',
			message: '.every() used without .length check — vacuous truth on empty arrays',
			location: { file: filePath },
			suggestion: 'Check array.length > 0 before .every() if empty arrays are possible',
			confidence: 0.6,
		})
		issues++
	}

	// .some() with trivial predicates: () => true, () => 1
	const trivialSome = code.match(/\.some\s*\(\s*(?:\(\s*\)\s*=>\s*(?:true|1)|\w+\s*=>\s*true)/g) ?? []
	if (trivialSome.length > 0) {
		findings.push({
			severity: 'warning',
			dimension: 'logical',
			ruleId: 'PROOF-LOGIC-006',
			message: `${trivialSome.length} .some() calls with trivial predicates (always true)`,
			location: { file: filePath },
			suggestion: 'Replace trivial .some() predicates with meaningful conditions',
			confidence: 0.85,
		})
		issues += trivialSome.length
	}

	totalQuantifiers = Math.max(1, totalQuantifiers)
	const score = Math.max(0, 1 - issues * 0.2)
	return { score, findings }
}

/**
 * Check type-level logical soundness: unsound `as` casts, non-null assertions,
 * exhaustive switch matching.
 */
function checkTypeSoundness(
	code: string,
	filePath: string,
): { score: number; findings: ProofFinding[] } {
	const findings: ProofFinding[] = []
	let unsoundOperations = 0
	let totalTypeOperations = 1

	// Non-null assertions on potentially nullable variables
	const nonNullAssertions = code.match(/\w+!/g) ?? []
	if (nonNullAssertions.length > 3) {
		findings.push({
			severity: 'warning',
			dimension: 'logical',
			ruleId: 'PROOF-LOGIC-007',
			message: `${nonNullAssertions.length} non-null assertions (!) — potential runtime errors`,
			location: { file: filePath },
			suggestion: 'Use proper null checks instead of non-null assertions',
			confidence: 0.75,
		})
		unsoundOperations += nonNullAssertions.length
	}

	// Type assertions that narrow against inferred type
	const typeAssertions = code.match(/\)\s*as\s+(?!unknown|any)\w+/g) ?? []
	if (typeAssertions.length > 2) {
		findings.push({
			severity: 'info',
			dimension: 'logical',
			ruleId: 'PROOF-LOGIC-008',
			message: `${typeAssertions.length} type assertions (as X) — verify narrowing correctness`,
			location: { file: filePath },
			suggestion: 'Prefer type guards (typeof, instanceof) over type assertions',
			confidence: 0.65,
		})
		unsoundOperations += Math.floor(typeAssertions.length / 2)
	}

	// Non-exhaustive switch statements (no default case)
	const switchStatements = code.match(/switch\s*\([^)]+\)/g) ?? []
	const defaultCases = code.match(/\bdefault\s*:/g) ?? []
	const nonExhaustiveSwitches = Math.max(0, switchStatements.length - defaultCases.length)
	if (nonExhaustiveSwitches > 0) {
		findings.push({
			severity: 'warning',
			dimension: 'logical',
			ruleId: 'PROOF-LOGIC-009',
			message: `${nonExhaustiveSwitches} switch statements without default case`,
			location: { file: filePath },
			suggestion: 'Add a default case to handle unexpected values',
			confidence: 0.8,
		})
		unsoundOperations += nonExhaustiveSwitches
	}

	totalTypeOperations += nonNullAssertions.length + typeAssertions.length + switchStatements.length
	const score = Math.max(0, 1 - unsoundOperations * 0.1)
	return { score, findings }
}

/**
 * Check conditional completeness: all if/else chains have else, all switch have default.
 */
function checkConditionalCompleteness(
	code: string,
	filePath: string,
): { score: number; findings: ProofFinding[] } {
	const findings: ProofFinding[] = []

	// Check if/else chains without final else
	const ifWithoutElse = code.match(/\bif\s*\([^)]+\)[^{]*(?:\{[^}]*\}(?:\s*else\s*if[^{]*\{[^}]*\})*)\s*$/gm) ?? []

	// Early return pattern is acceptable (no else needed if if-block returns)
	const hasEarlyReturn = code.includes('return') && code.includes('if')

	let score = 1.0
	if (ifWithoutElse.length > 0 && !hasEarlyReturn) {
		findings.push({
			severity: 'info',
			dimension: 'logical',
			ruleId: 'PROOF-LOGIC-010',
			message: 'Some if/else chains lack a final else branch',
			location: { file: filePath },
			suggestion: 'Add else branches or use early return pattern for completeness',
			confidence: 0.5,
		})
		score -= 0.05
	}

	return { score: Math.max(0, score), findings }
}

/**
 * Verify code at the logical dimension.
 * Returns a DimensionProofScore with sub-scores per check category.
 */
export function verifyLogically(context: VerifierContext): DimensionProofScore {
	const allFindings: ProofFinding[] = []
	const subScores: Record<string, number> = {}

	// 1. Propositional consistency
	const propositional = checkPropositionalConsistency(context.code, context.filePath)
	allFindings.push(...propositional.findings)
	subScores.propositionalConsistency = propositional.score

	// 2. Dead code detection
	const deadCode = checkDeadCode(context.code, context.filePath)
	allFindings.push(...deadCode.findings)
	subScores.deadCodeAbsence = deadCode.score

	// 3. Predicate logic
	const predicates = checkPredicateLogic(context.code, context.filePath)
	allFindings.push(...predicates.findings)
	subScores.predicateCorrectness = predicates.score

	// 4. Type soundness
	const typeSoundness = checkTypeSoundness(context.code, context.filePath)
	allFindings.push(...typeSoundness.findings)
	subScores.typeSoundness = typeSoundness.score

	// 5. Conditional completeness
	const completeness = checkConditionalCompleteness(context.code, context.filePath)
	allFindings.push(...completeness.findings)
	subScores.conditionalCompleteness = completeness.score

	// Weighted aggregate: 25% propositional, 25% dead code, 15% predicates, 20% type, 15% completeness
	const value =
		propositional.score * 0.25 +
		deadCode.score * 0.25 +
		predicates.score * 0.15 +
		typeSoundness.score * 0.20 +
		completeness.score * 0.15

	return {
		value: Math.min(1, value),
		weight: 0.30,
		findings: allFindings,
		subScores,
	}
}
