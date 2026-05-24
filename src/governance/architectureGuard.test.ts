import { describe, expect, it } from 'vitest'
import {
	enforceArchitectureRules,
	getDefaultArchitectureRules,
	validateDependencyDirection,
} from './architectureGuard.js'

describe('getDefaultArchitectureRules', () => {
	it('returns non-empty array', () => {
		const rules = getDefaultArchitectureRules()
		expect(rules.length).toBeGreaterThan(0)
	})

	it('each rule has required fields', () => {
		const rules = getDefaultArchitectureRules()
		for (const rule of rules) {
			expect(rule.sourceModule).toBeTruthy()
			expect(rule.allowedImports).toBeInstanceOf(Array)
			expect(rule.forbiddenImports).toBeInstanceOf(Array)
			expect(rule.description).toBeTruthy()
		}
	})
})

describe('enforceArchitectureRules', () => {
	it('detects violation when reasoning imports cortex', () => {
		const sources = new Map([
			['src/reasoning/index.ts', `import { something } from '../cortex/engine.js'`],
		])
		const rules = getDefaultArchitectureRules()
		const violations = enforceArchitectureRules(sources, rules)
		expect(violations.length).toBeGreaterThan(0)
	})

	it('allows valid imports', () => {
		const sources = new Map([
			['src/reasoning/index.ts', `import { something } from './chainOfThought.js'`],
		])
		const rules = getDefaultArchitectureRules()
		const violations = enforceArchitectureRules(sources, rules)
		expect(violations).toEqual([])
	})
})

describe('validateDependencyDirection', () => {
	it('rejects forbidden direction', () => {
		const rules = getDefaultArchitectureRules()
		expect(validateDependencyDirection('reasoning', 'cortex', rules)).toBe(false)
	})

	it('allows valid direction', () => {
		const rules = getDefaultArchitectureRules()
		expect(validateDependencyDirection('reasoning', 'utils', rules)).toBe(true)
	})

	it('allows when no rules apply', () => {
		const rules = getDefaultArchitectureRules()
		expect(validateDependencyDirection('nonexistent', 'anything', rules)).toBe(true)
	})
})
