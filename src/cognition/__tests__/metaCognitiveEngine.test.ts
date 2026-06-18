import { describe, expect, it } from 'vitest'
import { cognize } from '../metaCognitiveEngine.js'
import { renderProvenance } from '../provenance.js'
import type { CognitionDeps } from '../metaCognitiveEngine.js'
import type { ReasoningChain } from '../../reasoning/types.js'
import type { CortexAnalysis, CrossModelResult } from '../../cortex/types.js'

const QUERY = 'analyze why the auth flow fails under load'

function mockChain(conclusion = 'The auth failure is caused by a connection-pool exhaustion under load.'): ReasoningChain {
	return {
		id: 'c1',
		strategy: 'cot',
		query: QUERY,
		steps: [{ id: 's1', type: 'synthesis', content: conclusion, confidence: 0.8 }],
		conclusion,
		confidence: 0.8,
		durationMs: 1,
		timestamp: 0,
	}
}

const mockAnalyze = async (): Promise<CortexAnalysis> =>
	({
		id: 'a1',
		originalQuery: QUERY,
		subQueries: [],
		reasoningPasses: [],
		crossModelResults: [],
		synthesizedKnowledge: { insights: [], gaps: [], contradictions: [] } as never,
		metaInsights: [
			{ type: 'query_complexity', description: 'high complexity', action: 'use ToT', priority: 'high', confidence: 0.7 },
		],
		finalConfidence: 0.7,
		augmentedContext: '',
		durationMs: 1,
		timestamp: 0,
	}) as CortexAnalysis

const mockVerify = async (): Promise<CrossModelResult> =>
	({
		modelName: 'cross-model-verify',
		provider: 'mock',
		response: 'agreed',
		confidence: 0.8,
		agreementWithPrimary: 0.8,
		uniqueInsights: [],
		contradictions: [],
		durationMs: 1,
	}) as CrossModelResult

/** generateFn that returns a valid intent JSON for any prompt. */
const mockGenerateFn = async (): Promise<string> =>
	'{"explicit":"q","implicit":"wants a rigorous root-cause","meta":"debugging production","predictive":"a fix","constraints":["urgency detected"]}'

describe('MetaCognitiveEngine.cognize', () => {
	it('degrades honestly without a model (reasoning skipped)', async () => {
		const deps: CognitionDeps = { analyze: mockAnalyze, verify: mockVerify }
		const r = await cognize(QUERY, deps)
		expect(r.provenance.modelAvailable).toBe(false)
		expect(r.conclusion).toBe('') // no reasoning without a model
		expect(r.intent.explicit).toBe(QUERY) // heuristic intent
		expect(r.confidence.measured).toBeGreaterThanOrEqual(0)
		expect(r.confidence.measured).toBeLessThanOrEqual(1)
	})

	it('runs the full loop with a model and reports measured provenance', async () => {
		const deps: CognitionDeps = {
			generateFn: mockGenerateFn,
			analyze: mockAnalyze,
			reason: async () => mockChain(),
			verify: mockVerify,
		}
		const r = await cognize(QUERY, deps)
		expect(r.provenance.modelAvailable).toBe(true)
		expect(r.conclusion).toContain('connection-pool')
		expect(r.intent.implicit).toBe('wants a rigorous root-cause') // model-backed intent
		expect(r.intent.constraints).toContain('urgency detected')
		// measured confidence is a transparent aggregate, not a constant
		expect(r.confidence.measured).toBeGreaterThan(0)
		expect(r.confidence.measured).toBeLessThanOrEqual(1)
		expect(r.confidence.cortex).toBe(0.7)
		expect(r.confidence.verification).toBe(0.8)
		// strategies recorded honestly
		expect(r.provenance.strategiesTried.length).toBeGreaterThan(0)
		expect(r.provenance.metaInsightsCount).toBe(1)
	})

	it('converges when a re-reasoning pass changes < epsilon (same conclusion)', async () => {
		const deps: CognitionDeps = {
			generateFn: mockGenerateFn,
			analyze: mockAnalyze,
			reason: async () => mockChain('stable conclusion text'), // identical each pass
			verify: mockVerify,
		}
		const r = await cognize(QUERY, deps)
		// Same conclusion twice => similarity 1.0 >= epsilon => converged
		expect(r.provenance.converged).toBe(true)
		expect(r.provenance.convergencePasses).toBeLessThanOrEqual(2)
	})
})

describe('renderProvenance', () => {
	it('prints measured components and provenance (no magic number)', async () => {
		const deps: CognitionDeps = {
			generateFn: mockGenerateFn,
			analyze: mockAnalyze,
			reason: async () => mockChain(),
			verify: mockVerify,
		}
		const r = await cognize(QUERY, deps)
		const out = renderProvenance(r)
		expect(out).toContain('Overall:')
		expect(out).toContain('cortex')
		expect(out).toContain('reasoning quality')
		expect(out).toContain('cross-model agreement')
		expect(out).toContain('strategies tried')
		expect(out).toContain('measured, not asserted')
		expect(out).not.toContain('0.997')
	})
})
