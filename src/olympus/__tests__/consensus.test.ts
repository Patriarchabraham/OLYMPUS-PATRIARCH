import { describe, it, expect } from 'vitest'
import { calculateConsensus, createVoteCollector } from '../consensus.js'
import type { AgentVote } from '../types.js'

function makeVote(overrides: Partial<AgentVote> & { agentId: string }): AgentVote {
	return {
		agentRole: 'Worker',
		decision: 'approve',
		confidence: 0.8,
		reasoning: 'Test vote reasoning',
		...overrides,
	}
}

describe('consensus', () => {
	describe('calculateConsensus', () => {
		it('returns empty result for zero votes', () => {
			const result = calculateConsensus([])
			expect(result.agreement).toBe(0)
			expect(result.finalDecision).toBe('')
		})

		it('weights manager votes higher', () => {
			const votes = [
				makeVote({ agentId: '1', decision: 'approve', agentRole: 'Worker', confidence: 0.9 }),
				makeVote({ agentId: '2', decision: 'reject', agentRole: 'Director', confidence: 0.9 }),
			]
			const result = calculateConsensus(votes)
			expect(result.finalDecision).toBe('reject')
		})

		it('uses simple majority for equal weights', () => {
			const votes = [
				makeVote({ agentId: '1', decision: 'approve' }),
				makeVote({ agentId: '2', decision: 'approve' }),
				makeVote({ agentId: '3', decision: 'reject' }),
			]
			const result = calculateConsensus(votes)
			expect(result.finalDecision).toBe('approve')
		})
	})

	describe('createVoteCollector', () => {
		it('returns null when below threshold', () => {
			const collector = createVoteCollector('consensus', 0.6)
			const result = collector.addVote(makeVote({ agentId: '1', confidence: 0.5 }))
			expect(result).toBeNull()
		})

		it('returns consensus when threshold reached', () => {
			const collector = createVoteCollector('consensus', 0.6)
			collector.addVote(makeVote({ agentId: '1', decision: 'approve', confidence: 0.9 }))
			const result = collector.addVote(makeVote({ agentId: '2', decision: 'approve', confidence: 0.9 }))
			expect(result).not.toBeNull()
			expect(result!.finalDecision).toBe('approve')
		})

		it('executive method: first executive vote wins', () => {
			const collector = createVoteCollector('executive', 0.9)
			collector.addVote(makeVote({ agentId: '1', decision: 'approve', agentRole: 'Worker' }))
			const result = collector.addVote(makeVote({ agentId: '2', decision: 'override', agentRole: 'Executive VP' }))
			expect(result).not.toBeNull()
			expect(result!.finalDecision).toBe('override')
		})
	})
})
