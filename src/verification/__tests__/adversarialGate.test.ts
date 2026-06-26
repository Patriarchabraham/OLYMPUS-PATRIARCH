import { describe, expect, it } from 'vitest'

import { verifyChange } from '../adversarialGate.js'

describe('adversarialGate.verifyChange', () => {
	it('skips when below threshold', async () => {
		const verdict = await verifyChange({
			changedFiles: ['a.ts'],
			lineCount: 5,
			generatorProvider: 'anthropic',
			diff: 'minor change',
			originalQuery: 'fix typo',
		})
		expect(verdict.passed).toBe(true)
		expect(verdict.confidence).toBe(1)
		expect(verdict.feedback).toBe('below verification threshold')
	})

	it('returns passed=false when static checks fail', async () => {
		// Use a deliberately broken project root to force typecheck failure.
		const verdict = await verifyChange({
			changedFiles: ['a.ts', 'b.ts', 'c.ts', 'd.ts'],
			lineCount: 100,
			generatorProvider: 'anthropic',
			diff: 'multi-file change',
			originalQuery: 'big refactor',
			projectRoot: '/nonexistent/path/that/does/not/exist',
			config: {
				enabled: true,
				thresholdFiles: 3,
				thresholdLines: 50,
				blockOnDisagreement: false,
				minConfidence: 0.5,
			},
		})
		expect(verdict.passed).toBe(false)
		expect(verdict.staticChecks.overall).toBe(false)
	}, 30000) // 30s timeout — typecheck may take a moment

	it('respects enabled=false override', async () => {
		const verdict = await verifyChange({
			changedFiles: ['a.ts', 'b.ts', 'c.ts', 'd.ts'],
			lineCount: 1000,
			generatorProvider: 'anthropic',
			diff: 'big change',
			originalQuery: 'refactor',
			config: { enabled: false },
		})
		expect(verdict.passed).toBe(true)
		expect(verdict.feedback).toBe('below verification threshold')
	})
})
