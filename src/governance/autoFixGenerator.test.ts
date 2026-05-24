import { describe, expect, it } from 'vitest'
import { applyAutoFix, formatFixAsDiff, generateAutoFixes } from './autoFixGenerator.js'
import type { AutoFixSuggestion, GovernanceFinding } from './types.js'

describe('generateAutoFixes', () => {
	it('generates fix for any→unknown', () => {
		const findings: GovernanceFinding[] = [
			{
				severity: 'error',
				dimension: 'types',
				message: 'any',
				ruleId: 'GOV-TYP-001',
				location: { file: 'test.ts', line: 1 },
			},
		]
		const source = 'const x: any = 1'
		const fixes = generateAutoFixes(findings, source, 'test.ts')
		const anyFix = fixes.find((f) => f.ruleId === 'GOV-TYP-001')
		expect(anyFix).toBeDefined()
		expect(anyFix!.fixed).toContain('unknown')
	})

	it('generates fix for == → ===', () => {
		const source = 'if (x == 1) {}'
		const fixes = generateAutoFixes([], source, 'test.ts')
		expect(fixes.some((f) => f.ruleId === 'GOV-FIX-001')).toBe(true)
	})
})

describe('formatFixAsDiff', () => {
	it('produces diff output', () => {
		const diff = formatFixAsDiff('hello\nworld', 'hello\nchanged')
		expect(diff).toContain('--- original')
		expect(diff).toContain('+++ fixed')
		expect(diff).toContain('- world')
		expect(diff).toContain('+ changed')
	})
})

describe('applyAutoFix', () => {
	it('applies fix correctly', () => {
		const source = 'const x: any = 1'
		const fix: AutoFixSuggestion = {
			ruleId: 'GOV-TYP-001',
			description: 'Replace any',
			original: 'const x: any = 1',
			fixed: 'const x: unknown = 1',
			confidence: 0.9,
			filePath: 'test.ts',
			line: 1,
		}
		const result = applyAutoFix(source, fix)
		expect(result).toBe('const x: unknown = 1')
	})

	it('returns null when line does not match', () => {
		const source = 'const x = 1'
		const fix: AutoFixSuggestion = {
			ruleId: 'GOV-TYP-001',
			description: 'Replace any',
			original: 'const x: any = 1',
			fixed: 'const x: unknown = 1',
			confidence: 0.9,
			filePath: 'test.ts',
			line: 1,
		}
		expect(applyAutoFix(source, fix)).toBeNull()
	})
})
