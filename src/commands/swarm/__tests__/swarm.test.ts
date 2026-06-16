import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock the heavy model/orchestrator chains so the test loads in isolation
// (the real crossModelVerifier/superAgent graphs are too deep for vite-node
// in this WIP tree — see the multi-agent-hardening notes).
vi.mock('../../../cortex/crossModelVerifier.js', () => ({
	verify: vi.fn(),
}))
vi.mock('../../../services/superAgent/index.js', () => ({
	getSuperAgentOrchestrator: vi.fn(),
}))

import { verify as crossVerify } from '../../../cortex/crossModelVerifier.js'
import type { SwarmTaskResult } from '../../../swarm/types.js'
import { renderVerification } from '../swarm.js'

type VerifyResult = Awaited<ReturnType<typeof crossVerify>>
const asResult = (o: Partial<VerifyResult>): VerifyResult => o as unknown as VerifyResult

function makeResults(output: string): SwarmTaskResult[] {
	return [{ taskId: 't1', success: true, output }]
}

describe('renderVerification', () => {
	beforeEach(() => vi.mocked(crossVerify).mockReset())

	it('reports confidence/agreement and lists contradictions', async () => {
		vi.mocked(crossVerify).mockResolvedValue(
			asResult({
				modelName: 'cross-model-verify',
				provider: 'configured',
				response: 'r',
				confidence: 0.85,
				agreementWithPrimary: 0.72,
				uniqueInsights: [],
				contradictions: ['claim A vs claim B'],
				durationMs: 10,
			}),
		)
		const report = await renderVerification('do X', makeResults('output here'))
		expect(report).toContain('Confidence: 85%')
		expect(report).toContain('Agreement: 0.72')
		expect(report).toContain('Contradictions (1)')
		expect(report).toContain('claim A vs claim B')
	})

	it('reports none detected when there are no contradictions', async () => {
		vi.mocked(crossVerify).mockResolvedValue(
			asResult({
				modelName: 'm',
				provider: 'self',
				response: '',
				confidence: 0.5,
				agreementWithPrimary: 0.4,
				uniqueInsights: [],
				contradictions: [],
				durationMs: 1,
			}),
		)
		const report = await renderVerification('do X', makeResults('output'))
		expect(report).toContain('none detected')
	})

	it('surfaces a verification failure honestly (provider: error)', async () => {
		// verify() returns provider:'error' on a real model failure rather than
		// throwing — exercise that realistic path through the report.
		vi.mocked(crossVerify).mockResolvedValue(
			asResult({
				modelName: 'm',
				provider: 'error',
				response: '',
				confidence: 0.2,
				agreementWithPrimary: 0.1,
				uniqueInsights: [],
				contradictions: [],
				durationMs: 1,
			}),
		)
		const report = await renderVerification('do X', makeResults('output'))
		expect(report).toContain('Provider: error')
		expect(report).toContain('Confidence: 20%')
	})

	it('returns empty string when there is nothing to verify', async () => {
		expect(await renderVerification('do X', null)).toBe('')
		expect(await renderVerification('do X', [])).toBe('')
	})
})
