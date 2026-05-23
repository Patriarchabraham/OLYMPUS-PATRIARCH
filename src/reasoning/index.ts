import type { ReasoningStrategy, ReasoningChain, ReasoningStep, GenerateFn } from './types.js'
import { selectStrategy, resolveStrategy } from './strategySelector.js'
import { runChainOfThought } from './chainOfThought.js'
import { runTreeOfThought } from './treeOfThought.js'
import { runSelfReflection } from './selfReflection.js'
import { createGenerateFn, createTemplateOnlyGenerateFn } from './generateFnFactory.js'

export { selectStrategy, resolveStrategy } from './strategySelector.js'
export { runChainOfThought } from './chainOfThought.js'
export { runTreeOfThought } from './treeOfThought.js'
export { runSelfReflection } from './selfReflection.js'
export { createGenerateFn, createTemplateOnlyGenerateFn } from './generateFnFactory.js'
export type {
  ReasoningStrategy,
  ReasoningStep,
  ReasoningChain,
  TreeOfThoughtPath,
  ReflectionResult,
  StrategyRecommendation,
  GenerateFn,
} from './types.js'

/**
 * Run ensemble reasoning — combines multiple strategies and picks the best.
 * Runs CoT + ToT + Self-Reflection, then merges the highest-confidence results.
 */
async function runEnsemble(
  query: string,
  context?: string,
  generateFn?: GenerateFn,
): Promise<ReasoningChain> {
  const startTime = Date.now()
  const generate = generateFn ?? createTemplateOnlyGenerateFn()

  // Run all three strategies in parallel
  const [cotResult, totResult, reflectResult] = await Promise.all([
    runChainOfThought(query, context, generate).catch((): ReasoningChain => ({
      id: 'cot_fallback',
      strategy: 'cot',
      query,
      steps: [],
      conclusion: 'CoT reasoning failed',
      confidence: 0,
      durationMs: 0,
      timestamp: Date.now(),
    })),
    runTreeOfThought(query, context, undefined, generate).catch((): ReasoningChain => ({
      id: 'tot_fallback',
      strategy: 'tot',
      query,
      steps: [],
      conclusion: 'ToT reasoning failed',
      confidence: 0,
      durationMs: 0,
      timestamp: Date.now(),
    })),
    runSelfReflection(query, context, undefined, generate).catch((): ReasoningChain => ({
      id: 'reflect_fallback',
      strategy: 'reflect',
      query,
      steps: [],
      conclusion: 'Self-reflection failed',
      confidence: 0,
      durationMs: 0,
      timestamp: Date.now(),
    })),
  ])

  // Collect all results with their confidence
  const results = [
    { chain: cotResult, weight: 1.0 },
    { chain: totResult, weight: 1.2 },  // ToT slightly weighted for multi-path exploration
    { chain: reflectResult, weight: 1.1 }, // Reflection slightly weighted for self-correction
  ]

  // Sort by weighted confidence descending
  results.sort((a, b) => (b.chain.confidence * b.weight) - (a.chain.confidence * a.weight))

  const best = results[0]!.chain
  const second = results[1]!.chain

  // Merge steps: take best's steps + unique insights from others
  const mergedSteps: ReasoningStep[] = [...best.steps]

  // Add unique steps from second-best that aren't similar to existing ones
  const existingContent = new Set(best.steps.map(s => s.content.toLowerCase()))
  for (const step of second.steps) {
    const isDuplicate = step.content.toLowerCase().split(' ').slice(0, 5).every(
      word => existingContent.has(word) || Array.from(existingContent).some(ec => ec.includes(word))
    )
    if (!isDuplicate && mergedSteps.length < 15) {
      mergedSteps.push({
        ...step,
        metadata: { ...step.metadata, source: second.strategy },
      })
    }
  }

  // Calculate ensemble confidence as weighted average
  const totalWeight = results.reduce((sum, r) => sum + r.weight, 0)
  const ensembleConfidence = results.reduce(
    (sum, r) => sum + (r.chain.confidence * r.weight), 0,
  ) / totalWeight

  // Build conclusion from best, enriched with second's conclusion
  let conclusion = best.conclusion
  if (second.conclusion && second.conclusion !== best.conclusion) {
    conclusion += ` Additionally, from ${second.strategy} analysis: ${second.conclusion.slice(0, 200)}`
  }

  return {
    id: best.id,
    strategy: 'ensemble',
    query,
    steps: mergedSteps,
    conclusion,
    confidence: Math.min(0.99, ensembleConfidence * 1.05), // Slight bonus for ensemble
    durationMs: Date.now() - startTime,
    timestamp: Date.now(),
    metadata: {
      strategiesUsed: results.map(r => ({ strategy: r.chain.strategy, confidence: r.chain.confidence })),
      bestStrategy: best.strategy,
      secondStrategy: second.strategy,
    },
  }
}

/**
 * Run quantum-enhanced reasoning using the QuantumEngine.
 * Falls back to CoT if quantum module is unavailable.
 */
async function runQuantumReasoning(
  query: string,
  context?: string,
  generateFn?: GenerateFn,
): Promise<ReasoningChain> {
  const startTime = Date.now()
  const generate = generateFn ?? createTemplateOnlyGenerateFn()

  try {
    // Dynamically import to avoid hard dependency
    const { QuantumEngine } = await import('../quantum/index.js')
    const engine = new QuantumEngine()

    // Run quantum analysis pipeline
    const analysis = await engine.process(query)

    // Extract reasoning states from quantum results
    const steps: ReasoningStep[] = []

    // PERCEIVE phase — use quantum state analysis
    if (analysis.states.length > 0) {
      steps.push({
        id: `qs_perceive`,
        type: 'analysis',
        content: `Quantum analysis across ${analysis.dimensionsCovered.length} dimensions: ${analysis.dimensionsCovered.join(', ')}`,
        confidence: analysis.confidence,
        metadata: { phase: 'perceive', dimensions: analysis.dimensionsCovered },
      })
    }

    // SUPERPOSE phase — multiple solution states
    const topStates = analysis.states
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 5)

    for (const state of topStates) {
      steps.push({
        id: `qs_superpose_${state.id}`,
        type: 'hypothesis',
        content: `[${state.dimension}] ${state.solution}`,
        confidence: state.confidence,
        metadata: { phase: 'superpose', dimension: state.dimension },
      })
    }

    // ENTANGLE phase — cross-dimensional insights
    if (analysis.entanglements.length > 0) {
      const topEntanglements = analysis.entanglements
        .sort((a, b) => b.concurrence - a.concurrence)
        .slice(0, 3)

      for (const ent of topEntanglements) {
        steps.push({
          id: `qs_entangle_${ent.id}`,
          type: 'synthesis',
          content: `Entangled insight: ${ent.sharedPattern} (concurrence: ${ent.concurrence.toFixed(3)}, entropy: ${ent.entropy.toFixed(3)})`,
          confidence: Math.min(1, ent.concurrence + 0.1),
          metadata: { phase: 'entangle', concurrence: ent.concurrence },
        })
      }
    }

    // COLLAPSE phase — converged solution
    if (analysis.collapseResult) {
      const collapsed = analysis.collapseResult
      steps.push({
        id: `qs_collapse`,
        type: 'verification',
        content: `Collapsed to optimal solution via Born rule (probability: ${collapsed.bornProbability.toFixed(4)}): ${collapsed.collapsedState.solution}`,
        confidence: collapsed.confidence,
        metadata: {
          phase: 'collapse',
          bornProbability: collapsed.bornProbability,
          dimensionsEvaluated: collapsed.dimensionsEvaluated,
        },
      })
    }

    // TUNNEL phase — barrier bypass
    for (const tunnel of analysis.tunnelResults.slice(0, 2)) {
      steps.push({
        id: `qs_tunnel_${tunnel.id}`,
        type: 'hypothesis',
        content: `Quantum tunnel through barrier "${tunnel.barrier}": ${tunnel.tunnelPath}`,
        confidence: tunnel.confidence,
        metadata: { phase: 'tunnel', interferenceGain: tunnel.interferenceGain },
      })
    }

    // If quantum didn't produce enough, supplement with CoT
    if (steps.length < 3) {
      const cotChain = await runChainOfThought(query, context, generate)
      steps.push(...cotChain.steps)
    }

    // Final synthesis step
    steps.push({
      id: `qs_synthesis`,
      type: 'synthesis',
      content: 'Quantum analysis complete — evaluated across multiple dimensions simultaneously',
      confidence: analysis.confidence,
    })

    const conclusion = analysis.collapseResult?.collapsedState.solution
      ?? topStates[0]?.solution
      ?? 'Quantum analysis produced multi-dimensional insights'

    return {
      id: analysis.id,
      strategy: 'quantum',
      query,
      steps,
      conclusion,
      confidence: analysis.confidence,
      durationMs: Date.now() - startTime,
      timestamp: Date.now(),
      metadata: {
        quantumDimensions: analysis.dimensionsCovered,
        entanglementsFound: analysis.entanglements.length,
        tunnelResults: analysis.tunnelResults.length,
        bornProbability: analysis.collapseResult?.bornProbability ?? 0,
      },
    }
  } catch {
    // Quantum module unavailable — fall back to CoT with enriched context
    const enrichedContext = `[Quantum fallback] Analyzing with enhanced chain-of-thought${context ? ` | ${context}` : ''}`
    return runChainOfThought(query, enrichedContext, generate)
  }
}

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
    case 'ensemble':
      return runEnsemble(query, context, generateFn)
    case 'quantum':
      return runQuantumReasoning(query, context, generateFn)
    default:
      return runChainOfThought(query, context, generateFn)
  }
}
