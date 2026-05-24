import { describe, expect, it } from 'vitest'
import {
	analyzeComplexity,
	analyzeErrorHandling,
	analyzeNaming,
	analyzeSecurity,
	analyzeTypeSafety,
	buildDependencyGraph,
	detectCircularDependencies,
	extractImports,
	extractModuleFromPath,
} from './staticAnalyzer.js'

describe('analyzeComplexity', () => {
	it('analyzes a simple function', () => {
		const src = `function hello() {\n  return 1\n}`
		const result = analyzeComplexity(src, 'test.ts')
		expect(result.totalLines).toBe(3)
		expect(result.cyclomatic).toBeGreaterThanOrEqual(1)
	})

	it('detects nesting', () => {
		const src = `function deep() {\n  if (true) {\n    if (true) {\n      return 1\n    }\n  }\n}`
		const result = analyzeComplexity(src, 'test.ts')
		expect(result.maxNestingDepth).toBeGreaterThanOrEqual(2)
	})

	it('counts branch points for switch', () => {
		const src = `function sw(x) {\n  switch(x) {\n    case 1: break;\n    case 2: break;\n  }\n}`
		const result = analyzeComplexity(src, 'test.ts')
		expect(result.cyclomatic).toBeGreaterThanOrEqual(3)
	})
})

describe('extractImports', () => {
	it('extracts default imports', () => {
		const src = `import foo from './bar.js'`
		expect(extractImports(src, 'test.ts')).toContain('./bar.js')
	})

	it('extracts named imports', () => {
		const src = `import { a, b } from './mod.js'`
		expect(extractImports(src, 'test.ts')).toContain('./mod.js')
	})

	it('extracts type imports', () => {
		const src = `import type { Foo } from './types.js'`
		expect(extractImports(src, 'test.ts')).toContain('./types.js')
	})

	it('extracts dynamic imports', () => {
		const src = `const mod = import('./dynamic.js')`
		expect(extractImports(src, 'test.ts')).toContain('./dynamic.js')
	})
})

describe('analyzeTypeSafety', () => {
	it('counts any usage', () => {
		const src = `const x: any = 1\nconst y: any = 2`
		const result = analyzeTypeSafety(src)
		expect(result.anyCount).toBe(2)
	})

	it('counts as casts', () => {
		const src = `const x = value as String`
		const result = analyzeTypeSafety(src)
		expect(result.castCount).toBe(1)
	})
})

describe('analyzeErrorHandling', () => {
	it('detects bare catch', () => {
		const src = `try { x() } catch { y() }`
		const result = analyzeErrorHandling(src)
		expect(result.bareCatchCount).toBe(1)
	})

	it('detects untyped catch', () => {
		const src = `try { x() } catch (e) { y() }`
		const result = analyzeErrorHandling(src)
		expect(result.untypedCatchCount).toBe(1)
	})

	it('detects empty catch', () => {
		const src = `try { x() } catch (e) {}`
		const result = analyzeErrorHandling(src)
		expect(result.emptyCatchCount).toBe(1)
	})
})

describe('analyzeNaming', () => {
	it('detects lowercase class name', () => {
		const src = `class myclass {}`
		const findings = analyzeNaming(src)
		expect(findings.some((f) => f.ruleId === 'GOV-NAM-001')).toBe(true)
	})

	it('accepts PascalCase class names', () => {
		const src = `class MyClass {}`
		const findings = analyzeNaming(src)
		expect(findings.some((f) => f.ruleId === 'GOV-NAM-001')).toBe(false)
	})
})

describe('analyzeSecurity', () => {
	it('detects eval()', () => {
		const src = `const result = eval('1+1')`
		const findings = analyzeSecurity(src)
		expect(findings.some((f) => f.ruleId === 'GOV-SEC-001')).toBe(true)
	})

	it('detects innerHTML', () => {
		const src = `el.innerHTML = '<b>test</b>'`
		const findings = analyzeSecurity(src)
		expect(findings.some((f) => f.ruleId === 'GOV-SEC-002')).toBe(true)
	})

	it('ignores commented eval', () => {
		const src = `// const result = eval('1+1')`
		const findings = analyzeSecurity(src)
		expect(findings.some((f) => f.ruleId === 'GOV-SEC-001')).toBe(false)
	})
})

describe('extractModuleFromPath', () => {
	it('extracts from src path', () => {
		expect(extractModuleFromPath('src/reasoning/chainOfThought.ts')).toBe('reasoning')
	})

	it('extracts from deep path', () => {
		expect(extractModuleFromPath('src/services/superAgent/orchestrator.ts')).toBe('services')
	})

	it('returns unknown for no src', () => {
		expect(extractModuleFromPath('foo.ts')).toBe('unknown')
	})
})

describe('detectCircularDependencies', () => {
	it('detects a simple cycle', () => {
		const graph = new Map([
			['a', ['b']],
			['b', ['a']],
		])
		const cycles = detectCircularDependencies(graph)
		expect(cycles.length).toBeGreaterThanOrEqual(1)
	})

	it('returns empty for no cycle', () => {
		const graph = new Map([
			['a', ['b']],
			['b', ['c']],
			['c', []],
		])
		const cycles = detectCircularDependencies(graph)
		expect(cycles).toEqual([])
	})
})

describe('buildDependencyGraph', () => {
	it('builds graph from 2 files', () => {
		const sources = new Map([
			['src/a.ts', `import { b } from './b.js'`],
			['src/b.ts', `export function b() {}`],
		])
		const result = buildDependencyGraph(sources)
		expect(result.importGraph.size).toBe(2)
	})
})
