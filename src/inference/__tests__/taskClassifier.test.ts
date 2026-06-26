import { describe, expect, it } from 'vitest'

import { classifyTask } from '../taskClassifier.js'

describe('classifyTask', () => {
	it('classifies within 5ms budget', () => {
		const start = performance.now()
		classifyTask({ queryText: 'refactor the auth module' })
		const elapsed = performance.now() - start
		expect(elapsed).toBeLessThan(5)
	})

	it('detects trivial_fix via keyword', () => {
		const result = classifyTask({ queryText: 'fix typo in README' })
		expect(result.taskType).toBe('trivial_fix')
		expect(result.preferFast).toBe(true)
	})

	it('detects deep_refactor via keyword', () => {
		const result = classifyTask({ queryText: 'refactor the auth module' })
		expect(result.taskType).toBe('deep_refactor')
		expect(result.preferStrong).toBe(true)
	})

	it('detects debugging via keyword', () => {
		const result = classifyTask({ queryText: 'debug the crash in login flow' })
		expect(result.taskType).toBe('debugging')
		expect(result.preferStrong).toBe(true)
	})

	it('detects verification via keyword', () => {
		const result = classifyTask({ queryText: 'verify the implementation matches the spec' })
		expect(result.taskType).toBe('verification')
	})

	it('detects docstring via keyword', () => {
		const result = classifyTask({ queryText: 'add JSDoc comments to public functions' })
		expect(result.taskType).toBe('docstring')
		expect(result.preferFast).toBe(true)
	})

	it('detects architecture via keyword', () => {
		const result = classifyTask({ queryText: 'design the new caching strategy' })
		expect(result.taskType).toBe('architecture')
	})

	it('detects boilerplate via keyword', () => {
		const result = classifyTask({ queryText: 'scaffold a new test stub' })
		expect(result.taskType).toBe('boilerplate')
		expect(result.preferFast).toBe(true)
	})

	it('uses structural signal: very short query + 0 files → trivial_fix', () => {
		const result = classifyTask({ queryText: 'hi', fileCount: 0, toolUseCount: 0 })
		expect(result.taskType).toBe('trivial_fix')
	})

	it('uses structural signal: fileCount > 5 → deep_refactor', () => {
		const result = classifyTask({
			queryText: 'update something here',
			fileCount: 6,
		})
		expect(result.taskType).toBe('deep_refactor')
	})

	it('scales deep_refactor confidence with file count', () => {
		const small = classifyTask({ queryText: 'refactor it', fileCount: 1 })
		const large = classifyTask({ queryText: 'refactor it', fileCount: 10 })
		expect(large.confidence).toBeGreaterThan(small.confidence)
	})

	it('defaults to feature_impl when no signal', () => {
		const result = classifyTask({ queryText: 'add a new function to handle the request' })
		expect(result.taskType).toBe('feature_impl')
		expect(result.preferStrong).toBe(true)
	})
})
