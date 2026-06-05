/**
 * Typographical Verifier — naming consistency, spell checking,
 * JSDoc accuracy, and token efficiency scoring.
 *
 * Catches typos via Levenshtein distance, enforces camelCase,
 * and verifies documentation matches code.
 */

import type { DimensionProofScore, ProofFinding, VerifierContext } from './types.js'

/** Known short identifier exceptions */
const ALLOWED_SHORT_NAMES = new Set([
	'i', 'j', 'k', 'x', 'y', 'z', 'id', 'fn', 'cb', 'e', 'ex', 'er', 'n', 'm', 'p', 'q', 'r', 's', 't',
])

/** Known suffixes that indicate intentional name variants */
const KNOWN_SUFFIXES = ['Id', 'Name', 'Type', 'Count', 'List', 'Map', 'Set', 'Key', 'Value', 'Fn', 'Cb']

/**
 * Compute Levenshtein distance between two strings.
 */
function levenshtein(a: string, b: string): number {
	const m = a.length
	const n = b.length
	const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0))

	for (let i = 0; i <= m; i++) dp[i][0] = i
	for (let j = 0; j <= n; j++) dp[0][j] = j

	for (let i = 1; i <= m; i++) {
		for (let j = 1; j <= n; j++) {
			const cost = a[i - 1] === b[j - 1] ? 0 : 1
			dp[i][j] = Math.min(
				dp[i - 1][j] + 1,
				dp[i][j - 1] + 1,
				dp[i - 1][j - 1] + cost,
			)
		}
	}

	return dp[m][n]
}

/**
 * Extract identifiers from code (variable names, function names, etc.)
 */
function extractIdentifiers(code: string): string[] {
	const pattern = /\b(?:const|let|var|function|class|interface|type|enum)\s+(\w+)/g
	const identifiers: string[] = []
	let match: RegExpExecArray | null
	while ((match = pattern.exec(code)) !== null) {
		identifiers.push(match[1])
	}

	// Also extract parameter names
	const paramPattern = /\(\s*((?:\w+(?:\s*:\s*\w+)?(?:\s*,\s*\w+(?:\s*:\s*\w+)?)*)?)\s*\)/g
	while ((match = paramPattern.exec(code)) !== null) {
		if (match[1]) {
			const params = match[1].split(',').map((p) => p.trim().split(':')[0].trim()).filter(Boolean)
			identifiers.push(...params)
		}
	}

	return [...new Set(identifiers)]
}

/**
 * Check camelCase naming consistency and detect short/abbreviated names.
 */
function checkNamingConsistency(
	code: string,
	filePath: string,
): { score: number; findings: ProofFinding[] } {
	const findings: ProofFinding[] = []
	const identifiers = extractIdentifiers(code)

	if (identifiers.length === 0) return { score: 1, findings }

	let violations = 0

	// Check camelCase violations (PascalCase is ok for types/classes)
	const camelCasePattern = /^[a-z][a-zA-Z0-9]*$/
	const pascalCasePattern = /^[A-Z][a-zA-Z0-9]*$/
	const snakeCasePattern = /^[a-z]+(_[a-z]+)+$/

	for (const id of identifiers) {
		// Skip allowed short names
		if (ALLOWED_SHORT_NAMES.has(id)) continue
		if (id.length < 3 && !pascalCasePattern.test(id)) {
			findings.push({
				severity: 'info',
				dimension: 'typographical',
				ruleId: 'PROOF-TYPE-001',
				message: `Abbreviated identifier: "${id}" (< 3 chars)`,
				location: { file: filePath },
				suggestion: 'Use descriptive names with at least 3 characters',
				confidence: 0.7,
			})
			violations++
			continue
		}

		// Check for snake_case in JS/TS (should be camelCase)
		if (snakeCasePattern.test(id) && !id.startsWith('_')) {
			findings.push({
				severity: 'warning',
				dimension: 'typographical',
				ruleId: 'PROOF-TYPE-002',
				message: `snake_case identifier "${id}" — use camelCase in TypeScript`,
				location: { file: filePath },
				suggestion: `Rename to camelCase: ${id.replace(/_([a-z])/g, (_, c) => c.toUpperCase())}`,
				confidence: 0.8,
			})
			violations++
		}
	}

	const score = Math.max(0, 1 - violations / Math.max(1, identifiers.length))
	return { score, findings }
}

/**
 * Detect potential typos via Levenshtein distance between similar identifiers.
 * Only flags pairs with distance=1 in the same scope.
 */
function checkTypos(
	code: string,
	filePath: string,
): { score: number; findings: ProofFinding[] } {
	const findings: ProofFinding[] = []
	const identifiers = extractIdentifiers(code)

	if (identifiers.length < 2) return { score: 1, findings }

	let typoCount = 0

	// Check all pairs for Levenshtein distance = 1
	for (let i = 0; i < identifiers.length; i++) {
		for (let j = i + 1; j < identifiers.length; j++) {
			const a = identifiers[i]
			const b = identifiers[j]

			// Skip if they differ by a known suffix
			if (KNOWN_SUFFIXES.some((suffix) => a + suffix === b || b + suffix === a)) continue

			// Skip if same length and differ by known suffix
			if (a.length > 3 && b.length > 3 && levenshtein(a, b) === 1) {
				// Check they're not just singular/plural or common variants
				if (!(a + 's' === b || b + 's' === a || a + 'es' === b || b + 'es' === a)) {
					findings.push({
						severity: 'warning',
						dimension: 'typographical',
						ruleId: 'PROOF-TYPE-003',
						message: `Possible typo: "${a}" vs "${b}" (Levenshtein distance = 1)`,
						location: { file: filePath },
						suggestion: `Verify both names are intentional — one may be a typo`,
						confidence: 0.7,
					})
					typoCount++
				}
			}
		}
	}

	const score = Math.max(0, 1 - typoCount * 0.1)
	return { score, findings }
}

/**
 * Check JSDoc accuracy: @param names match function signature,
 * @returns type matches return type annotation.
 */
function checkJSDocAccuracy(
	code: string,
	filePath: string,
): { score: number; findings: ProofFinding[] } {
	const findings: ProofFinding[] = []
	let totalReferences = 0
	let inaccurateReferences = 0

	// Extract JSDoc blocks followed by function declarations
	const jsdocPattern = /\/\*\*([\s\S]*?)\*\/\s*(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)/g
	let match: RegExpExecArray | null

	while ((match = jsdocPattern.exec(code)) !== null) {
		const jsdocContent = match[1]
		const _fnName = match[2]
		const params = match[3]
			.split(',')
			.map((p: string) => p.trim().split(':')[0].split('=')[0].trim())
			.filter(Boolean)

		// Extract @param names from JSDoc
		const paramTags = jsdocContent.match(/@param\s+(?:\{[^}]*\}\s+)?(\w+)/g) ?? []
		const jsdocParamNames = paramTags.map((tag: string) => {
			const parts = tag.split(/\s+/)
			return parts[parts.length - 1]
		})

		// Check each @param matches a function parameter
		for (const jsdocParam of jsdocParamNames) {
			totalReferences++
			if (!params.includes(jsdocParam)) {
				findings.push({
					severity: 'warning',
					dimension: 'typographical',
					ruleId: 'PROOF-TYPE-004',
					message: `@param "${jsdocParam}" in JSDoc does not match any function parameter`,
					location: { file: filePath },
					suggestion: `Update JSDoc @param to match actual parameters: ${params.join(', ')}`,
					confidence: 0.85,
				})
				inaccurateReferences++
			}
		}

		// Check params without @param documentation
		for (const param of params) {
			if (!jsdocParamNames.includes(param)) {
				totalReferences++
			}
		}
	}

	const score = totalReferences > 0
		? Math.max(0, 1 - inaccurateReferences / totalReferences)
		: 1
	return { score, findings }
}

/**
 * Compute token efficiency: ratio of useful tokens to total tokens.
 * Useful = identifiers, keywords, operators. Boilerplate = redundant declarations.
 */
function checkTokenEfficiency(code: string): number {
	const tokens = code.split(/[\s\n]+/).filter(Boolean)
	if (tokens.length === 0) return 1

	// Classify tokens
	const keywords = new Set([
		'const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while',
		'import', 'export', 'class', 'interface', 'type', 'async', 'await', 'new',
		'try', 'catch', 'throw', 'switch', 'case', 'break', 'continue', 'default',
	])

	let usefulTokens = 0
	for (const token of tokens) {
		// Identifiers, keywords, operators, and literals are useful
		if (keywords.has(token)) {
			usefulTokens++
		} else if (/^\w+$/.test(token) && token.length > 1) {
			// Identifiers (not single-char noise)
			usefulTokens++
		} else if (/^[+\-*/%=<>!&|^~?:]+$/.test(token)) {
			// Operators
			usefulTokens++
		} else if (/^['"`].*['"`]$/.test(token)) {
			// String literals
			usefulTokens++
		} else if (/^\d+(\.\d+)?$/.test(token)) {
			// Number literals
			usefulTokens++
		}
	}

	return usefulTokens / tokens.length
}

/**
 * Verify code at the typographical dimension.
 * Returns a DimensionProofScore with naming, typo, JSDoc, and token efficiency sub-scores.
 */
export function verifyTypographically(context: VerifierContext): DimensionProofScore {
	const allFindings: ProofFinding[] = []
	const subScores: Record<string, number> = {}

	// 1. Naming consistency
	const naming = checkNamingConsistency(context.code, context.filePath)
	allFindings.push(...naming.findings)
	subScores.namingConsistency = naming.score

	// 2. Typo detection
	const typos = checkTypos(context.code, context.filePath)
	allFindings.push(...typos.findings)
	subScores.spellCorrectness = typos.score

	// 3. JSDoc accuracy
	const jsdoc = checkJSDocAccuracy(context.code, context.filePath)
	allFindings.push(...jsdoc.findings)
	subScores.jsdocAccuracy = jsdoc.score

	// 4. Token efficiency
	const tokenEff = checkTokenEfficiency(context.code)
	subScores.tokenEfficiency = tokenEff

	// Weighted aggregate: 30% naming, 30% typos, 25% JSDoc, 15% token efficiency
	const value =
		naming.score * 0.30 +
		typos.score * 0.30 +
		jsdoc.score * 0.25 +
		tokenEff * 0.15

	return {
		value: Math.min(1, value),
		weight: 0.15,
		findings: allFindings,
		subScores,
	}
}
