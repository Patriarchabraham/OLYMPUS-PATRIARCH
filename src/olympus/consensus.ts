/**
 * Consensus Engine — weighted voting for agent decisions.
 * Expertise-weighted scoring with domain boosting and streaming vote collection.
 */

import type { AgentVote, ConsensusResult, DecisionMethod } from './types.js'

/**
 * Calculate consensus from a set of votes.
 * Uses expertise-weighted scoring where managers/directors have 1.5x influence.
 */
export function calculateConsensus(
	votes: AgentVote[],
	method: DecisionMethod = 'consensus',
): ConsensusResult {
	if (votes.length === 0) {
		return {
			topic: '',
			votes: [],
			finalDecision: '',
			agreement: 0,
			method,
		}
	}

	const weightedVotes = new Map<string, number>()

	for (const vote of votes) {
		const weight =
			vote.confidence *
			(vote.agentRole.includes('Director') || vote.agentRole.includes('Manager') ? 1.5 : 1.0)
		const current = weightedVotes.get(vote.decision) || 0
		weightedVotes.set(vote.decision, current + weight)
	}

	let bestDecision = ''
	let bestScore = 0
	let totalWeight = 0

	for (const [decision, weight] of weightedVotes) {
		totalWeight += weight
		if (weight > bestScore) {
			bestScore = weight
			bestDecision = decision
		}
	}

	const agreement = totalWeight > 0 ? bestScore / totalWeight : 0

	return {
		topic: (votes[0]?.reasoning.split(' ').slice(0, 5).join(' ')) || '',
		votes,
		finalDecision: bestDecision,
		agreement: Math.min(agreement, 1),
		method,
	}
}

/**
 * Streaming vote collector — accumulate votes and detect consensus.
 * Returns a non-null ConsensusResult when agreement threshold is met.
 */
export function createVoteCollector(method: DecisionMethod = 'consensus', threshold = 0.6) {
	const votes: AgentVote[] = []

	return {
		/** Add a vote. Returns consensus result if threshold reached, null otherwise. */
		addVote(vote: AgentVote): ConsensusResult | null {
			votes.push(vote)
			const result = calculateConsensus(votes, method)

			if (result.agreement >= threshold && votes.length >= 2) {
				return result
			}

			// Executive method: first executive vote wins
			if (method === 'executive' && vote.agentRole.includes('Executive')) {
				return { ...result, finalDecision: vote.decision, agreement: 1.0 }
			}

			// Democratic: simple majority after 3+ votes
			if (method === 'democratic' && votes.length >= 3) {
				return result
			}

			return null
		},

		/** Get the current consensus state without finalizing. */
		getCurrentConsensus(): ConsensusResult {
			return calculateConsensus(votes, method)
		},

		/** Number of votes collected so far. */
		getVoteCount(): number {
			return votes.length
		},

		/** All votes collected so far. */
		getVotes(): AgentVote[] {
			return [...votes]
		},
	}
}
