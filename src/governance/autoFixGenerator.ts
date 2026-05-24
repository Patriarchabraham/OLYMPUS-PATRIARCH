/**
 * AutoFixGenerator — Template-based auto-fix suggestion generator.
 *
 * Generates actionable code fix suggestions without LLM dependency.
 * Uses pattern matching to detect and fix common code quality issues.
 */

import type { AutoFixSuggestion, GovernanceFinding } from './types.js'

// ============================================================
// Auto-Fix Patterns
// ============================================================

interface FixPattern {
	ruleId: string
	description: string
	pattern: RegExp
	replacement: (match: string, line: string) => string
	confidence: number
}

const FIX_PATTERNS: FixPattern[] = [
	{
		ruleId: 'GOV-TYP-001',
		description: 'Replace `any` with `unknown`',
		pattern: /:\s*any\b/,
		replacement: () => ': unknown',
		confidence: 0.9,
	},
	{
		ruleId: 'GOV-ERR-001',
		description: 'Add typed error variable to bare catch',
		pattern: /catch\s*\{/,
		replacement: () => 'catch (error: unknown) {',
		confidence: 0.95,
	},
	{
		ruleId: 'GOV-ERR-002',
		description: 'Type catch variable as unknown',
		pattern: /catch\s*\(\s*(e|err|error|exception)\s*\)/i,
		replacement: (m) => m.replace(/catch\s*\(\s*(e|err|error|exception)\s*\)/i, 'catch ($1: unknown)'),
		confidence: 0.9,
	},
]

// ============================================================
// Public API
// ============================================================

/**
 * Generate auto-fix suggestions for governance findings.
 * @param findings - The findings to generate fixes for
 * @param source - The source code
 * @param filePath - File path for the suggestions
 * @returns Array of auto-fix suggestions
 */
export function generateAutoFixes(
	findings: GovernanceFinding[],
	source: string,
	filePath: string,
): AutoFixSuggestion[] {
	const fixes: AutoFixSuggestion[] = []
	const lines = source.split('\n')

	// Process each finding that has a matching fix pattern
	for (const finding of findings) {
		const pattern = FIX_PATTERNS.find((p) => p.ruleId === finding.ruleId)
		if (!pattern) continue

		// Find the line number
		const startLine = finding.location?.line ?? 1
		const lineIdx = startLine - 1

		if (lineIdx >= 0 && lineIdx < lines.length) {
			const line = lines[lineIdx]
			if (pattern.pattern.test(line)) {
				const fixedLine = line.replace(pattern.pattern, (match) =>
					pattern.replacement(match, line))
				fixes.push({
					ruleId: finding.ruleId,
					description: pattern.description,
					original: line,
					fixed: fixedLine,
					confidence: pattern.confidence,
					filePath,
					line: startLine,
				})
			}
		}
	}

	// Also scan for fixable patterns not tied to specific findings
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i]

		// Replace == with === (skip !== and ===)
		if (/(?<!=|!)==(?!==)/.test(line) && !line.trim().startsWith('//')) {
			fixes.push({
				ruleId: 'GOV-FIX-001',
				description: 'Replace == with ===',
				original: line,
				fixed: line.replace(/(?<!=|!)==(?!===)/g, '==='),
				confidence: 0.95,
				filePath,
				line: i + 1,
			})
		}

		// Replace != with !== (skip !==)
		if (/(?<!=)!=((?!=))/.test(line) && !line.trim().startsWith('//')) {
			fixes.push({
				ruleId: 'GOV-FIX-002',
				description: 'Replace != with !==',
				original: line,
				fixed: line.replace(/(?<!=)!={1}(?!=)/g, '!=='),
				confidence: 0.95,
				filePath,
				line: i + 1,
			})
		}

		// Add return type to arrow functions without one
		const arrowMatch = line.match(/(const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\(([^)]*)\)\s*=>\s*\{/)
		if (arrowMatch && !line.includes(': ') && !line.trim().startsWith('//')) {
			const [, decl, name, params] = arrowMatch
			if (decl && name && params !== undefined) {
				const hasReturnType = /:\s*\w+\s*\)/.test(line)
				if (!hasReturnType) {
					fixes.push({
						ruleId: 'GOV-FIX-003',
						description: `Add explicit return type to arrow function "${name}"`,
						original: line,
						fixed: line.replace(
							/(const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\(([^)]*)\)\s*=>/,
							`$1 $2 = $3(${params}) : void =>`,
						),
						confidence: 0.4, // Low confidence — can't infer actual type
						filePath,
						line: i + 1,
					})
				}
			}
		}

		// Replace eval() with comment
		if (/\beval\s*\(/.test(line) && !line.trim().startsWith('//')) {
			fixes.push({
				ruleId: 'GOV-SEC-001',
				description: 'Remove eval() usage — replace with safer alternative',
				original: line,
				fixed: line.replace(/\beval\s*\([^)]*\)/, '/* FIXME: replace eval with safe alternative */ undefined'),
				confidence: 0.3,
				filePath,
				line: i + 1,
			})
		}
	}

	return fixes
}

/**
 * Format the difference between original and fixed code as unified diff.
 * @param original - Original source code
 * @param fixed - Fixed source code
 * @returns Unified diff string
 */
export function formatFixAsDiff(
	original: string,
	fixed: string,
): string {
	const origLines = original.split('\n')
	const fixedLines = fixed.split('\n')
	const diff: string[] = ['--- original', '+++ fixed']

	// Simple line-by-line diff
	const maxLen = Math.max(origLines.length, fixedLines.length)
	for (let i = 0; i < maxLen; i++) {
		const origLine = origLines[i]
		const fixedLine = fixedLines[i]

		if (origLine === undefined && fixedLine !== undefined) {
			diff.push(`+ ${fixedLine}`)
		} else if (origLine !== undefined && fixedLine === undefined) {
			diff.push(`- ${origLine}`)
		} else if (origLine !== fixedLine) {
			diff.push(`- ${origLine}`)
			diff.push(`+ ${fixedLine}`)
		}
	}

	return diff.join('\n')
}

/**
 * Apply a single auto-fix to source code.
 * Returns the modified source or null if the fix cannot be applied.
 * @param source - Original source code
 * @param fix - The auto-fix to apply
 * @returns Modified source code, or null if fix doesn't match
 */
export function applyAutoFix(
	source: string,
	fix: AutoFixSuggestion,
): string | null {
	if (fix.line === undefined) return null

	const lines = source.split('\n')
	const lineIdx = fix.line - 1

	if (lineIdx < 0 || lineIdx >= lines.length) return null

	const currentLine = lines[lineIdx]
	if (currentLine === fix.original) {
		lines[lineIdx] = fix.fixed
		return lines.join('\n')
	}

	return null
}
