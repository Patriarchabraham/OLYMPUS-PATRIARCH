import type { ReasoningStrategy, StrategyRecommendation } from './types.js'

const EXPLORATORY_KEYWORDS = [
  'explore', 'compare', 'alternatives', 'options', 'brainstorm',
  'creative', 'ideas', 'different approaches', 'what if', 'possibilities',
  'trade-offs', 'tradeoffs', 'pros and cons', 'evaluate',
]

const VERIFICATION_KEYWORDS = [
  'verify', 'check', 'ensure', 'validate', 'confirm', 'correct',
  'accurate', 'audit', 'review', 'test', 'proof', 'guarantee',
  'security', 'safety', 'critical', 'important', 'must',
]

const DESIGN_KEYWORDS = [
  'design', 'architect', 'plan', 'system', 'structure', 'refactor',
  'redesign', 'restructure', 'migrate', 'scale', 'infrastructure',
  'complex', 'comprehensive', 'end-to-end',
]

export function selectStrategy(query: string): StrategyRecommendation {
  const lower = query.toLowerCase()
  const len = query.length

  // Check for verification keywords
  const verificationScore = VERIFICATION_KEYWORDS.filter(k => lower.includes(k)).length
  if (verificationScore >= 2 || (verificationScore >= 1 && lower.includes('critical'))) {
    return {
      strategy: 'reflect',
      reason: `Query contains ${verificationScore} verification-related terms, self-reflection will ensure accuracy`,
      estimatedComplexity: 'high',
      estimatedSteps: 6,
    }
  }

  // Check for exploratory keywords
  const exploratoryScore = EXPLORATORY_KEYWORDS.filter(k => lower.includes(k)).length
  if (exploratoryScore >= 2) {
    return {
      strategy: 'tot',
      reason: `Query explores ${exploratoryScore} alternative/comparison concepts, tree-of-thought will evaluate multiple paths`,
      estimatedComplexity: 'high',
      estimatedSteps: 8,
    }
  }

  // Check for design/architecture keywords
  const designScore = DESIGN_KEYWORDS.filter(k => lower.includes(k)).length
  if (designScore >= 2) {
    return {
      strategy: 'tot',
      reason: `Query involves architectural decisions with ${designScore} design terms, tree-of-thought explores design space`,
      estimatedComplexity: 'high',
      estimatedSteps: 10,
    }
  }

  // Complexity by length
  if (len > 500) {
    return {
      strategy: 'tot',
      reason: 'Query is extensive, tree-of-thought will explore multiple solution paths',
      estimatedComplexity: 'high',
      estimatedSteps: 8,
    }
  }

  if (len > 200) {
    return {
      strategy: 'cot',
      reason: 'Medium-complexity query, chain-of-thought will decompose into logical steps',
      estimatedComplexity: 'medium',
      estimatedSteps: 4,
    }
  }

  // Check if verification is primary intent even with single keyword
  if (verificationScore === 1) {
    return {
      strategy: 'reflect',
      reason: 'Query has verification intent, self-reflection adds a verification loop',
      estimatedComplexity: 'medium',
      estimatedSteps: 5,
    }
  }

  if (exploratoryScore === 1) {
    return {
      strategy: 'tot',
      reason: 'Query has exploratory intent, tree-of-thought provides broader coverage',
      estimatedComplexity: 'medium',
      estimatedSteps: 6,
    }
  }

  return {
    strategy: 'cot',
    reason: 'Straightforward query, chain-of-thought provides structured reasoning',
    estimatedComplexity: 'low',
    estimatedSteps: 3,
  }
}

export function resolveStrategy(
  strategy: ReasoningStrategy,
  query: string,
): Exclude<ReasoningStrategy, 'auto'> {
  if (strategy !== 'auto') return strategy
  return selectStrategy(query).strategy as Exclude<ReasoningStrategy, 'auto'>
}
