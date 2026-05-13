import type { ReasoningStrategy, ReasoningChain, GenerateFn } from './types.js'
import { selectStrategy, resolveStrategy } from './strategySelector.js'
import { runChainOfThought } from './chainOfThought.js'
import { runTreeOfThought } from './treeOfThought.js'
import { runSelfReflection } from './selfReflection.js'

export { selectStrategy, resolveStrategy } from './strategySelector.js'
export { runChainOfThought } from './chainOfThought.js'
export { runTreeOfThought } from './treeOfThought.js'
export { runSelfReflection } from './selfReflection.js'
export type {
  ReasoningStrategy,
  ReasoningStep,
  ReasoningChain,
  TreeOfThoughtPath,
  ReflectionResult,
  StrategyRecommendation,
  GenerateFn,
} from './types.js'

export async function runReasoning(
  query: string,
  strategy: ReasoningStrategy = 'auto',
  context?: string,
  generateFn?: GenerateFn,
): Promise<ReasoningChain> {
  const resolved = resolveStrategy(strategy, query)

  switch (resolved) {
    case 'cot':
      return runChainOfThought(query, context, generateFn)
    case 'tot':
      return runTreeOfThought(query, context, undefined, generateFn)
    case 'reflect':
      return runSelfReflection(query, context, undefined, generateFn)
    default:
      return runChainOfThought(query, context, generateFn)
  }
}
