/**
 * Mutant Generator — creates code mutants via operator flipping,
 * boundary changes, statement deletion, and boolean negation.
 *
 * Each mutation is a single, small change to the source code.
 * The test suite should catch (kill) each mutant.
 */

import type { Mutant, MutantOperator } from './types.js'

/** Arithmetic operator flip pairs */
const ARITHMETIC_FLIPS: Record<string, string> = {
	'+': '-',
	'-': '+',
	'*': '/',
	'/': '*',
	'%': '*',
	'**': '*',
}

/** Comparison operator flip pairs */
const COMPARISON_FLIPS: Record<string, string> = {
	'===': '!==',
	'!==': '===',
	'==': '!=',
	'!=': '==',
	'>': '<',
	'<': '>',
	'>=': '<=',
	'<=': '>=',
}

/** Logical operator flip pairs */
const LOGICAL_FLIPS: Record<string, string> = {
	'&&': '||',
	'||': '&&',
}

/**
 * Generate all mutants for a given source file.
 */
export function generateMutants(
	source: string,
	filePath: string,
	operators?: MutantOperator[],
): Mutant[] {
	const ALL_OPERATORS: MutantOperator[] = [
		'flip_arithmetic', 'flip_comparison', 'flip_logical', 'flip_boolean',
		'negate_condition', 'remove_statement', 'change_return', 'boundary_change',
		'string_change', 'number_change',
	]
	const activeOps = operators ?? ALL_OPERATORS
	const mutants: Mutant[] = []
	const lines = source.split('\n')
	let mutantCount = 0
	const MAX_MUTANTS = 200

	for (let lineIdx = 0; lineIdx < lines.length && mutantCount < MAX_MUTANTS; lineIdx++) {
		const line = lines[lineIdx]
		const lineNum = lineIdx + 1

		// Skip empty lines, comments, imports
		const trimmed = line.trim()
		if (trimmed === '' || trimmed.startsWith('//') || trimmed.startsWith('import ') || trimmed.startsWith('export type')) {
			continue
		}

		// Arithmetic flips
		if (activeOps.includes('flip_arithmetic')) {
			for (const [op, replacement] of Object.entries(ARITHMETIC_FLIPS)) {
				if (mutantCount >= MAX_MUTANTS) break
				if (line.includes(op)) {
					const mutatedLine = line.replace(new RegExp(escapeRegex(op), 'g'), replacement)
					if (mutatedLine !== line) {
						mutants.push(createMutant(
							mutantCount++, 'flip_arithmetic', lineNum,
							line.trim(), mutatedLine.trim(),
							lines.map((l, i) => i === lineIdx ? mutatedLine : l).join('\n'),
							filePath,
						))
					}
				}
			}
		}

		// Comparison flips
		if (activeOps.includes('flip_comparison')) {
			for (const [op, replacement] of Object.entries(COMPARISON_FLIPS)) {
				if (line.includes(op)) {
					const mutatedLine = line.replace(new RegExp(escapeRegex(op), 'g'), replacement)
					if (mutatedLine !== line) {
						mutants.push(createMutant(
							mutantCount++, 'flip_comparison', lineNum,
							line.trim(), mutatedLine.trim(),
							lines.map((l, i) => i === lineIdx ? mutatedLine : l).join('\n'),
							filePath,
						))
					}
				}
			}
		}

		// Logical flips
		if (activeOps.includes('flip_logical')) {
			for (const [op, replacement] of Object.entries(LOGICAL_FLIPS)) {
				if (line.includes(op)) {
					const mutatedLine = line.replace(new RegExp(escapeRegex(op), 'g'), replacement)
					if (mutatedLine !== line) {
						mutants.push(createMutant(
							mutantCount++, 'flip_logical', lineNum,
							line.trim(), mutatedLine.trim(),
							lines.map((l, i) => i === lineIdx ? mutatedLine : l).join('\n'),
							filePath,
						))
					}
				}
			}
		}

		// Boolean flips
		if (activeOps.includes('flip_boolean')) {
			if (/\btrue\b/.test(line)) {
				const mutatedLine = line.replace(/\btrue\b/g, 'false')
				mutants.push(createMutant(
					mutantCount++, 'flip_boolean', lineNum,
					line.trim(), mutatedLine.trim(),
					lines.map((l, i) => i === lineIdx ? mutatedLine : l).join('\n'),
					filePath,
				))
			}
			if (/\bfalse\b/.test(line)) {
				const mutatedLine = line.replace(/\bfalse\b/g, 'true')
				mutants.push(createMutant(
					mutantCount++, 'flip_boolean', lineNum,
					line.trim(), mutatedLine.trim(),
					lines.map((l, i) => i === lineIdx ? mutatedLine : l).join('\n'),
					filePath,
				))
			}
		}

		// Negate condition
		if (activeOps.includes('negate_condition')) {
			const ifMatch = line.match(/^(\s*if\s*\()(.*)/)
			if (ifMatch) {
				const prefix = ifMatch[1]
				const condition = ifMatch[2].replace(/\)\s*\{?$/, '')
				const mutatedLine = line.replace(/if\s*\(/, 'if (!(').replace(/\)\s*\{?$/, ') {')
				// Only negate simple conditions (not already negated)
				if (!condition.includes('!') && !condition.includes('===')) {
					mutants.push(createMutant(
						mutantCount++, 'negate_condition', lineNum,
						line.trim(), mutatedLine.trim(),
						lines.map((l, i) => i === lineIdx ? mutatedLine : l).join('\n'),
						filePath,
					))
				}
			}
		}

		// Remove statement (replace with empty line)
		if (activeOps.includes('remove_statement')) {
			// Only remove non-structural lines (not if/else/for/while/return/throw/try/catch)
			if (!/^\s*(if|else|for|while|do|return|throw|try|catch|finally|switch|case|break|continue|function|class|import|export)\b/.test(trimmed) &&
				trimmed.length > 3) {
				const mutatedLine = line.replace(trimmed, '/* removed */')
				mutants.push(createMutant(
					mutantCount++, 'remove_statement', lineNum,
					line.trim(), '/* removed */',
					lines.map((l, i) => i === lineIdx ? mutatedLine : l).join('\n'),
					filePath,
				))
			}
		}

		// Change return value
		if (activeOps.includes('change_return')) {
			const returnMatch = line.match(/return\s+(\w+)/)
			if (returnMatch) {
				const original = returnMatch[1]
				for (const replacement of ['undefined', '0', '""', 'null', 'false']) {
					if (original !== replacement) {
						const mutatedLine = line.replace(/return\s+\w+/, `return ${replacement}`)
						mutants.push(createMutant(
							mutantCount++, 'change_return', lineNum,
							line.trim(), mutatedLine.trim(),
							lines.map((l, i) => i === lineIdx ? mutatedLine : l).join('\n'),
							filePath,
						))
					}
				}
			}
		}

		// Boundary change
		if (activeOps.includes('boundary_change')) {
			if (line.includes('>=')) {
				const mutatedLine = line.replace(/>=/g, '>')
				mutants.push(createMutant(
					mutantCount++, 'boundary_change', lineNum,
					line.trim(), mutatedLine.trim(),
					lines.map((l, i) => i === lineIdx ? mutatedLine : l).join('\n'),
					filePath,
				))
			}
			if (line.includes('<=')) {
				const mutatedLine = line.replace(/<=/g, '<')
				mutants.push(createMutant(
					mutantCount++, 'boundary_change', lineNum,
					line.trim(), mutatedLine.trim(),
					lines.map((l, i) => i === lineIdx ? mutatedLine : l).join('\n'),
					filePath,
				))
			}
		}
	}

	return mutants
}

/**
 * Compute the mutation score from a list of mutants.
 */
export function computeMutationScore(mutants: Mutant[]): import('./types.js').MutationScore {
	const byOperator: Record<string, { total: number; killed: number }> = {}

	let killed = 0
	let survived = 0
	let timedOut = 0
	let errors = 0
	let equivalent = 0

	for (const mutant of mutants) {
		if (!byOperator[mutant.operator]) {
			byOperator[mutant.operator] = { total: 0, killed: 0 }
		}
		byOperator[mutant.operator].total++

		switch (mutant.status) {
			case 'killed':
				killed++
				byOperator[mutant.operator].killed++
				break
			case 'survived':
				survived++
				break
			case 'timeout':
				timedOut++
				break
			case 'error':
				errors++
				break
			case 'equivalent':
				equivalent++
				break
		}
	}

	const denominator = mutants.length - equivalent
	const score = denominator > 0 ? killed / denominator : 0

	return {
		total: mutants.length,
		killed,
		survived,
		timedOut,
		errors,
		equivalent,
		score,
		byOperator: byOperator as Record<MutantOperator, { total: number; killed: number }>,
	}
}

/**
 * Generate suggestions based on surviving mutants.
 */
export function generateSuggestions(mutants: Mutant[]): string[] {
	const survived = mutants.filter((m) => m.status === 'survived')
	if (survived.length === 0) return ['All mutants killed — test suite is strong!']

	const suggestions: string[] = []
	const byOp: Record<string, number> = {}
	for (const m of survived) {
		byOp[m.operator] = (byOp[m.operator] || 0) + 1
	}

	for (const [op, count] of Object.entries(byOp)) {
		switch (op) {
			case 'flip_arithmetic':
				suggestions.push(`Add tests for arithmetic operations (${count} survived) — verify +/-/*/ results explicitly`)
				break
			case 'flip_comparison':
				suggestions.push(`Add tests for comparison edge cases (${count} survived) — test boundary values where === matters`)
				break
			case 'flip_logical':
				suggestions.push(`Add tests for logical conditions (${count} survived) — verify && / || branches`)
				break
			case 'flip_boolean':
				suggestions.push(`Add tests for boolean values (${count} survived) — check true/false handling`)
				break
			case 'negate_condition':
				suggestions.push(`Add tests for conditional branches (${count} survived) — cover both if and else paths`)
				break
			case 'remove_statement':
				suggestions.push(`Add tests that verify side effects (${count} survived) — removed statements had no observable effect`)
				break
			case 'change_return':
				suggestions.push(`Add tests for return values (${count} survived) — specific return values are not checked`)
				break
			case 'boundary_change':
				suggestions.push(`Add tests for boundary conditions (${count} survived) — >= vs > is not distinguished`)
				break
		}
	}

	return suggestions
}

function createMutant(
	id: number,
	operator: MutantOperator,
	lineNumber: number,
	originalCode: string,
	mutatedCode: string,
	mutatedSource: string,
	_filePath: string,
): Mutant {
	return {
		id: `mutant-${id}`,
		operator,
		lineNumber,
		originalCode,
		mutatedCode,
		mutatedSource,
		status: 'survived' as const,
		durationMs: 0,
	}
}

function escapeRegex(str: string): string {
	return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
