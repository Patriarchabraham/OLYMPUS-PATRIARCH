import type { AgentRole, SwarmConsensus, SwarmVote } from './types.js'
import { getRoleDefinition } from './roles.js'

export interface ConsensusOptions {
  topic: string
  options: string[]
  threshold?: number // 0-1, default from swarm config
  domain?: AgentRole // domain for expertise weighting
  timeoutMs?: number
}

/**
 * Calculate weighted consensus from collected votes.
 * Weights votes by the expertise of each agent's role in the relevant domain.
 */
export function calculateConsensus(
  votes: SwarmVote[],
  options: string[],
  domain?: AgentRole,
  threshold = 0.6,
): SwarmConsensus {
  if (votes.length === 0) {
    return {
      topic: '',
      votes: [],
      finalDecision: options[0] ?? '',
      agreement: 0,
      timestamp: Date.now(),
    }
  }

  // Determine domain for weighting — use most common voter role if not specified
  const effectiveDomain = domain ?? inferDomain(votes)

  // Tally weighted votes
  const tallies: Record<string, number> = {}
  let totalWeight = 0

  for (const option of options) {
    tallies[option] = 0
  }

  for (const vote of votes) {
    const roleDef = getRoleDefinition(vote.agentRole)
    let weight = roleDef.expertiseWeight

    // Boost weight if the voter's role matches the domain
    if (effectiveDomain && vote.agentRole === effectiveDomain) {
      weight *= 1.5
    }

    // Scale by confidence (0-1)
    weight *= Math.max(0.1, Math.min(1, vote.confidence))

    if (vote.decision in tallies) {
      tallies[vote.decision]! += weight
    }
    totalWeight += weight
  }

  // Find winning option
  let bestOption = options[0] ?? ''
  let bestScore = 0

  for (const [option, score] of Object.entries(tallies)) {
    if (score > bestScore) {
      bestScore = score
      bestOption = option
    }
  }

  const agreement = totalWeight > 0 ? bestScore / totalWeight : 0

  return {
    topic: votes[0] ? String((votes as Array<{ agentId: string }>)[0]?.agentId) : '',
    votes,
    finalDecision: bestOption,
    agreement,
    timestamp: Date.now(),
  }
}

/**
 * Check if consensus has been reached.
 */
export function isConsensusReached(consensus: SwarmConsensus, threshold = 0.6): boolean {
  return consensus.agreement >= threshold
}

/**
 * Collect votes from multiple agents (simulated — real voting happens via message bus).
 * Returns a promise that resolves when enough votes are collected or timeout occurs.
 */
export function createVoteCollector(
  options: string[],
  threshold = 0.6,
  domain?: AgentRole,
): {
  addVote: (vote: SwarmVote) => SwarmConsensus | null
  getCurrentConsensus: () => SwarmConsensus
  getVoteCount: () => number
} {
  const votes: SwarmVote[] = []

  function recalculate(): SwarmConsensus {
    return calculateConsensus(votes, options, domain, threshold)
  }

  return {
    addVote(vote: SwarmVote): SwarmConsensus | null {
      // Only accept valid options
      if (!options.includes(vote.decision)) return null

      // Prevent duplicate votes from same agent
      const existing = votes.findIndex(v => v.agentId === vote.agentId)
      if (existing >= 0) {
        votes[existing] = vote
      } else {
        votes.push(vote)
      }

      const consensus = recalculate()
      if (isConsensusReached(consensus, threshold)) {
        return consensus
      }
      return null
    },

    getCurrentConsensus(): SwarmConsensus {
      return recalculate()
    },

    getVoteCount(): number {
      return votes.length
    },
  }
}

function inferDomain(votes: SwarmVote[]): AgentRole | undefined {
  if (votes.length === 0) return undefined
  const counts: Record<string, number> = {}
  for (const v of votes) {
    counts[v.agentRole] = (counts[v.agentRole] ?? 0) + 1
  }
  let best: string | undefined
  let bestCount = 0
  for (const [role, count] of Object.entries(counts)) {
    if (count > bestCount) {
      best = role
      bestCount = count
    }
  }
  return best as AgentRole | undefined
}
