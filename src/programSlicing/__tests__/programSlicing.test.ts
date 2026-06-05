import { describe, it, expect } from 'vitest'
import { buildDependencyGraph, computeSlice } from '../index.js'

const SAMPLE_CODE = `
const x = 5
const y = 10
const sum = x + y
const product = x * y
const unused = 42
if (sum > 10) {
	const result = sum * 2
	console.log(result)
}
`.trim()

describe('Program Slicing', () => {
	describe('buildDependencyGraph', () => {
		it('builds nodes from source code', () => {
			const graph = buildDependencyGraph(SAMPLE_CODE)
			expect(graph.nodes.size).toBeGreaterThan(0)
		})

		it('tracks variable definitions', () => {
			const graph = buildDependencyGraph(SAMPLE_CODE)
			expect(graph.variableDefs.has('x')).toBe(true)
			expect(graph.variableDefs.has('y')).toBe(true)
			expect(graph.variableDefs.has('sum')).toBe(true)
		})

		it('tracks variable uses', () => {
			const graph = buildDependencyGraph(SAMPLE_CODE)
			// sum uses x and y
			expect(graph.variableUses.has('x')).toBe(true)
			expect(graph.variableUses.has('y')).toBe(true)
		})

		it('creates data dependency edges', () => {
			const graph = buildDependencyGraph(SAMPLE_CODE)
			const dataEdges = graph.edges.filter((e) => e.kind === 'data')
			expect(dataEdges.length).toBeGreaterThan(0)
		})

		it('maps lines to nodes', () => {
			const graph = buildDependencyGraph(SAMPLE_CODE)
			expect(graph.lineNodes.size).toBeGreaterThan(0)
		})
	})

	describe('computeSlice', () => {
		it('computes backward slice for a variable', () => {
			const result = computeSlice(SAMPLE_CODE, {
				variableName: 'sum',
				lineNumber: 3,
				direction: 'backward',
			})

			expect(result.slicedLines.length).toBeGreaterThan(0)
			expect(result.slicedLines.length).toBeLessThan(SAMPLE_CODE.split('\n').length)
			expect(result.slicedCode).toContain('x')
			expect(result.slicedCode).toContain('y')
		})

		it('computes forward slice', () => {
			const result = computeSlice(SAMPLE_CODE, {
				variableName: 'x',
				lineNumber: 1,
				direction: 'forward',
			})

			expect(result.slicedLines.length).toBeGreaterThan(0)
			// Forward slice from x should include sum and product
			expect(result.slicedCode).toContain('sum')
		})

		it('computes reduction percentage', () => {
			const result = computeSlice(SAMPLE_CODE, {
				variableName: 'unused',
				lineNumber: 5,
				direction: 'backward',
			})

			expect(result.totalLines).toBeGreaterThan(0)
			expect(result.reductionPercent).toBeGreaterThanOrEqual(0)
			expect(result.reductionPercent).toBeLessThanOrEqual(100)
		})

		it('returns slice nodes', () => {
			const result = computeSlice(SAMPLE_CODE, {
				variableName: 'sum',
				lineNumber: 3,
				direction: 'backward',
			})

			expect(result.sliceNodes.length).toBeGreaterThan(0)
		})

		it('returns dependencies within slice', () => {
			const result = computeSlice(SAMPLE_CODE, {
				variableName: 'sum',
				lineNumber: 3,
				direction: 'backward',
			})

			expect(result.dependencies).toBeDefined()
		})

		it('handles variable not in code', () => {
			const result = computeSlice(SAMPLE_CODE, {
				variableName: 'nonexistent',
				lineNumber: 1,
				direction: 'backward',
			})

			expect(result.slicedLines.length).toBeLessThanOrEqual(1)
			expect(result.reductionPercent).toBeGreaterThanOrEqual(80)
		})
	})
})
