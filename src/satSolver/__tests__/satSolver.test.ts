import { describe, it, expect } from 'vitest'
import { solveDPLL, parseToCNF, checkPathFeasibility, extractPathConstraints } from '../dpll.js'
import type { CNFFormula, PathConstraint } from '../types.js'

describe('SAT Solver — DPLL', () => {
	describe('solveDPLL', () => {
		it('solves a simple satisfiable formula', () => {
			// (x1) ∧ (x2) — both must be true
			const formula: CNFFormula = [[1], [2]]
			const result = solveDPLL(formula)
			expect(result.satisfiable).toBe(true)
			expect(result.model?.get(1)).toBe(true)
			expect(result.model?.get(2)).toBe(true)
		})

		it('detects unsatisfiable formula', () => {
			// (x1) ∧ (-x1) — contradiction
			const formula: CNFFormula = [[1], [-1]]
			const result = solveDPLL(formula)
			expect(result.satisfiable).toBe(false)
			expect(result.model).toBeNull()
		})

		it('solves a formula with unit propagation', () => {
			// (x1 ∨ x2) ∧ (x1 ∨ -x2) ∧ (-x1) → should force x1=false, then both x2 and -x2 needed
			// Actually: -x1 is unit clause. After propagating x1=false:
			//   clause (x2) from (false ∨ x2) and (-x2) from (false ∨ -x2) → contradiction? No.
			//   After x1=false: (x2) ∧ (-x2) → contradiction. UNSAT.
			const formula: CNFFormula = [[1, 2], [1, -2], [-1]]
			const result = solveDPLL(formula)
			expect(result.satisfiable).toBe(false)
		})

		it('solves (x1 ∨ x2) ∧ (-x1 ∨ x3) ∧ (-x2 ∨ -x3)', () => {
			const formula: CNFFormula = [[1, 2], [-1, 3], [-2, -3]]
			const result = solveDPLL(formula)

			expect(result.satisfiable).toBe(true)
			if (result.model) {
				// Verify all clauses satisfied
				for (const clause of formula) {
					const satisfied = clause.some((lit) => {
						const v = Math.abs(lit)
						const val = result.model!.get(v)
						return lit > 0 ? val === true : val === false
					})
					expect(satisfied).toBe(true)
				}
			}
		})

		it('handles empty formula (trivially satisfiable)', () => {
			const result = solveDPLL([])
			expect(result.satisfiable).toBe(true)
		})

		it('handles single tautology clause', () => {
			// (x1 ∨ -x1) — always true
			const formula: CNFFormula = [[1, -1]]
			const result = solveDPLL(formula)
			expect(result.satisfiable).toBe(true)
		})

		it('tracks statistics', () => {
			const formula: CNFFormula = [[1, 2], [-1, 3], [-2, -3]]
			const result = solveDPLL(formula)
			expect(result.decisions).toBeGreaterThan(0)
			expect(result.durationMs).toBeGreaterThanOrEqual(0)
		})

		it('respects maxRecursiveCalls limit', () => {
			// Large unsatisfiable formula that would take many recursive calls
			const formula: CNFFormula = []
			for (let i = 1; i <= 20; i++) {
				formula.push([i])
				formula.push([-i])
			}
			const result = solveDPLL(formula, { maxRecursiveCalls: 5, enablePureLiteral: true, enableClauseLearning: false })
			// Should terminate (either SAT or UNSAT) without infinite loop
			expect(result.durationMs).toBeLessThan(1000)
		})

		it('solves pure literal elimination case', () => {
			// x1 appears only positive: (x1 ∨ x2) ∧ (x1 ∨ -x2)
			// Pure literal x1 should be set to true
			const formula: CNFFormula = [[1, 2], [1, -2]]
			const result = solveDPLL(formula, { maxRecursiveCalls: 1000, enablePureLiteral: true, enableClauseLearning: false })
			expect(result.satisfiable).toBe(true)
			expect(result.model?.get(1)).toBe(true)
		})

		it('solves a 3-SAT problem', () => {
			// Classic 3-SAT: (x1∨x2∨x3) ∧ (-x1∨x2∨x3) ∧ (x1∨-x2∨x3) ∧ (x1∨x2∨-x3) ∧ (-x1∨-x2∨x3) ∧ (-x1∨x2∨-x3) ∧ (x1∨-x2∨-x3) ∧ (-x1∨-x2∨-x3)
			// This is UNSAT — all 8 combinations of 3 vars are excluded
			const formula: CNFFormula = [
				[1, 2, 3], [-1, 2, 3], [1, -2, 3], [1, 2, -3],
				[-1, -2, 3], [-1, 2, -3], [1, -2, -3], [-1, -2, -3],
			]
			const result = solveDPLL(formula)
			expect(result.satisfiable).toBe(false)
		})
	})

	describe('parseToCNF', () => {
		it('parses a simple conjunction', () => {
			const cnf = parseToCNF('a && b')
			expect(cnf.length).toBeGreaterThanOrEqual(2)
		})

		it('parses a simple disjunction', () => {
			const cnf = parseToCNF('a || b')
			expect(cnf.length).toBeGreaterThanOrEqual(1)
		})

		it('parses negation', () => {
			const cnf = parseToCNF('!a')
			expect(cnf.length).toBeGreaterThanOrEqual(1)
		})

		it('parses complex expression', () => {
			const cnf = parseToCNF('(a || b) && (!a || c)')
			expect(cnf.length).toBeGreaterThanOrEqual(2)
		})

		it('returns empty for empty string', () => {
			const cnf = parseToCNF('')
			expect(cnf).toEqual([])
		})
	})

	describe('checkPathFeasibility', () => {
		it('detects feasible path', () => {
			const constraints: PathConstraint[] = [
				{ filePath: 'test.ts', lineNumber: 1, clause: [1], description: 'x is true' },
				{ filePath: 'test.ts', lineNumber: 2, clause: [2], description: 'y is true' },
			]
			const result = checkPathFeasibility(constraints)
			expect(result.feasible).toBe(true)
			expect(result.reason).toBeNull()
		})

		it('detects infeasible path', () => {
			const constraints: PathConstraint[] = [
				{ filePath: 'test.ts', lineNumber: 1, clause: [1], description: 'x is true' },
				{ filePath: 'test.ts', lineNumber: 2, clause: [-1], description: 'x is false' },
			]
			const result = checkPathFeasibility(constraints)
			expect(result.feasible).toBe(false)
			expect(result.reason).toContain('infeasible')
		})
	})

	describe('extractPathConstraints', () => {
		it('extracts constraints from if statements', () => {
			const code = `
let isValid = true
if (isValid) {
	console.log('valid')
}
`
			const constraints = extractPathConstraints(code, 'test.ts')
			expect(constraints.length).toBeGreaterThanOrEqual(1)
			expect(constraints[0].filePath).toBe('test.ts')
		})

		it('handles negated conditions', () => {
			const code = `if (!isError) { handle() }`
			const constraints = extractPathConstraints(code, 'test.ts')
			expect(constraints.length).toBeGreaterThanOrEqual(1)
			expect(constraints[0].clause[0]).toBeLessThan(0) // negated
		})

		it('returns empty for code without conditions', () => {
			const code = `const x = 5\nconsole.log(x)`
			const constraints = extractPathConstraints(code, 'test.ts')
			expect(constraints).toEqual([])
		})
	})
})
