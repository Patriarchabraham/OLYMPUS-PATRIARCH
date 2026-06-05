import { describe, it, expect } from 'vitest'
import { verifyEngineering } from '../engineeringVerifier.js'
import type { VerifierContext } from '../types.js'

describe('Engineering Verifier', () => {
	const makeContext = (code: string): VerifierContext => ({
		code,
		filePath: 'test.ts',
		provenConfidences: new Map(),
	})

	it('should score clean code high', () => {
		const result = verifyEngineering(makeContext(`
			import type { Config } from './types.js'

			export function processItem(item: string): string {
				return item.trim()
			}

			export function validateItems(items: string[]): boolean {
				return items.every(x => x.length > 0)
			}
		`))
		expect(result.value).toBeGreaterThan(0.5)
	})

	it('should flag SRP violations with many public methods', () => {
		const methods = Array.from({ length: 20 }, (_, i) =>
			`\tpublic method${i}() { return ${i} }`
		).join('\n')
		const result = verifyEngineering(makeContext(`
			class BigClass {
${methods}
			}
		`))
		expect(result.findings.some((f) => f.ruleId === 'PROOF-ENG-001')).toBe(true)
	})

	it('should flag nested loops (O(n^2))', () => {
		const result = verifyEngineering(makeContext(`
			for (let i = 0; i < n; i++) {
				for (let j = 0; j < n; j++) {
					process(matrix[i][j])
				}
			}
		`))
		expect(result.findings.some((f) => f.ruleId === 'PROOF-ENG-004')).toBe(true)
	})

	it('should flag sequential awaits', () => {
		const result = verifyEngineering(makeContext(`
			const a = await fetchA()
			const b = await fetchB()
			const c = await fetchC()
			const d = await fetchD()
		`))
		expect(result.findings.some((f) => f.ruleId === 'PROOF-ENG-005')).toBe(true)
	})

	it('should flag high fan-out', () => {
		const imports = Array.from({ length: 12 }, (_, i) =>
			`import { module${i} } from './module${i}.js'`
		).join('\n')
		const result = verifyEngineering(makeContext(imports))
		expect(result.findings.some((f) => f.ruleId === 'PROOF-ENG-007')).toBe(true)
	})

	it('should flag throws without try/catch', () => {
		const result = verifyEngineering(makeContext(`
			function validate(x: number): void {
				throw new Error('invalid')
			}
			function alsoValidate(y: number): void {
				throw new Error('also invalid')
			}
		`))
		expect(result.findings.some((f) => f.ruleId === 'PROOF-ENG-009')).toBe(true)
	})

	it('should flag bare catch clauses', () => {
		const result = verifyEngineering(makeContext(`
			try {
				risky()
			} catch () {
				handleError()
			}
		`))
		expect(result.findings.some((f) => f.ruleId === 'PROOF-ENG-010')).toBe(true)
	})

	it('should flag type-check chains (OCP violation)', () => {
		const result = verifyEngineering(makeContext(`
			if (typeof x === 'string') { processString(x) }
			else if (typeof x === 'number') { processNumber(x) }
			else if (typeof x === 'boolean') { processBoolean(x) }
		`))
		expect(result.findings.some((f) => f.ruleId === 'PROOF-ENG-002')).toBe(true)
	})

	it('should have all sub-scores', () => {
		const result = verifyEngineering(makeContext('const x = 1'))
		expect(result.subScores).toHaveProperty('srp')
		expect(result.subScores).toHaveProperty('ocp')
		expect(result.subScores).toHaveProperty('lsp')
		expect(result.subScores).toHaveProperty('isp')
		expect(result.subScores).toHaveProperty('dip')
		expect(result.subScores).toHaveProperty('performanceBound')
		expect(result.subScores).toHaveProperty('couplingHealth')
		expect(result.subScores).toHaveProperty('errorCompleteness')
	})
})
