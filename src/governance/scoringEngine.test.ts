import { describe, expect, it } from 'vitest'
import { computeWeightedScore, detectRegressions, scoreFile } from './scoringEngine.js'
import type { DimensionScore, GovernanceDimension, GovernanceScore } from './types.js'
import { DEFAULT_DIMENSION_WEIGHTS, DEFAULT_GOVERNANCE_CONFIG } from './types.js'

function makeAllPerfect(): Record<GovernanceDimension, DimensionScore> {
	const dims: GovernanceDimension[] = [
		'security',
		'performance',
		'maintainability',
		'architecture',
		'types',
		'testing',
		'documentation',
		'accessibility',
		'errorHandling',
		'naming',
		'dependencyHealth',
		'complexity',
	]
	const result = {} as Record<GovernanceDimension, DimensionScore>
	for (const d of dims) {
		result[d] = {
			value: 1,
			weight: DEFAULT_DIMENSION_WEIGHTS[d],
			findings: [],
			autoFixAvailable: false,
		}
	}
	return result
}

describe('scoreFile', () => {
	it('scores a clean file highly', () => {
		const cleanSource = `/** Clean file */\nexport function hello(): string { return 'hello' }\n`
		const result = scoreFile(cleanSource, 'clean.ts', DEFAULT_GOVERNANCE_CONFIG)
		expect(result.overall).toBeGreaterThan(0.5)
	})

	it('penalizes files with issues', () => {
		const badSource = `const x: any = eval('1')\ntry { x() } catch {}\n`
		const result = scoreFile(badSource, 'bad.ts', DEFAULT_GOVERNANCE_CONFIG)
		expect(result.overall).toBeLessThan(0.9)
		expect(result.totalFindings).toBeGreaterThan(0)
	})
})

describe('computeWeightedScore', () => {
	it('returns 1 for all perfect scores', () => {
		const dims = makeAllPerfect()
		const result = computeWeightedScore(dims, DEFAULT_DIMENSION_WEIGHTS)
		expect(result).toBeCloseTo(1)
	})

	it('returns 0 for all zero scores', () => {
		const dims = makeAllPerfect()
		for (const key of Object.keys(dims) as GovernanceDimension[]) {
			dims[key] = { ...dims[key], value: 0 }
		}
		const result = computeWeightedScore(dims, DEFAULT_DIMENSION_WEIGHTS)
		expect(result).toBeCloseTo(0)
	})
})

describe('detectRegressions', () => {
	it('detects score drops', () => {
		const perfect = makeAllPerfect()
		const current: GovernanceScore = {
			overall: 0.5,
			dimensions: { ...perfect, security: { ...perfect.security, value: 0.3 } },
			timestamp: Date.now(),
			totalFindings: 5,
			autoFixesAvailable: 0,
		}
		const previous: GovernanceScore = {
			overall: 0.9,
			dimensions: perfect,
			timestamp: Date.now() - 1000,
			totalFindings: 0,
			autoFixesAvailable: 0,
		}
		const regressions = detectRegressions(current, previous)
		expect(regressions).toContain('security')
	})

	it('returns empty when score improved', () => {
		const dims = makeAllPerfect()
		const current: GovernanceScore = {
			overall: 1,
			dimensions: dims,
			timestamp: Date.now(),
			totalFindings: 0,
			autoFixesAvailable: 0,
		}
		const previous: GovernanceScore = {
			overall: 0.8,
			dimensions: dims,
			timestamp: Date.now() - 1000,
			totalFindings: 5,
			autoFixesAvailable: 0,
		}
		const regressions = detectRegressions(current, previous)
		expect(regressions).toEqual([])
	})
})
