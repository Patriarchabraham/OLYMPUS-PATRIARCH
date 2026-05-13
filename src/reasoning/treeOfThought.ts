import { randomUUID } from 'crypto'
import type { ReasoningChain, ReasoningStep, TreeOfThoughtPath, GenerateFn } from './types.js'

const BRANCH_GENERATION_PROMPT = `Generate {count} different approaches to solve this problem.
For each approach, describe the key reasoning steps.
Format as a JSON array of objects, each with "approach" (string) and "steps" (string array).

Problem: `

const EVALUATION_PROMPT = `Evaluate the quality of this reasoning path on a scale of 0.0 to 1.0.
Consider: logical coherence, completeness, feasibility, and likelihood of reaching a correct solution.
Respond with ONLY a single number between 0.0 and 1.0.

Path:
`

const EXPANSION_PROMPT = `Given this promising reasoning path:
"""
{path}
"""

And the original problem:
"""
{query}
"""

Expand on this path with the next 2-3 deeper reasoning steps. Format as a JSON array of strings.`

const DEFAULT_MAX_BRANCHES = 4
const PRUNE_THRESHOLD = 0.4

function defaultGenerateFn(_prompt: string): Promise<string> {
  return Promise.resolve(JSON.stringify([
    {
      approach: 'Direct analytical approach: break the problem into sub-problems and solve each systematically',
      steps: ['Identify core requirements', 'Decompose into sub-problems', 'Solve each sub-problem', 'Combine solutions'],
    },
    {
      approach: 'Pattern-matching approach: find similar solved problems and adapt their solutions',
      steps: ['Search for analogous problems', 'Identify transferable patterns', 'Adapt solution to current context', 'Validate adapted solution'],
    },
    {
      approach: 'Bottom-up approach: start with concrete examples and generalize',
      steps: ['Generate concrete test cases', 'Observe patterns in examples', 'Formulate general rule', 'Verify against edge cases'],
    },
  ]))
}

function parseEvaluation(raw: string): number {
  const match = raw.match(/(\d+\.?\d*)/)
  if (match) {
    return Math.max(0, Math.min(1, parseFloat(match[1]!)))
  }
  return 0.5
}

function parseBranches(raw: string): Array<{ approach: string; steps: string[] }> {
  try {
    const jsonMatch = raw.match(/\[[\s\S]*\]/)
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]) as Array<{ approach?: string; steps?: string[] }>
      return parsed
        .filter(b => b.approach && Array.isArray(b.steps))
        .map(b => ({ approach: b.approach!, steps: b.steps! }))
    }
  } catch { /* fall through */ }
  return [{
    approach: 'Default analytical approach',
    steps: ['Analyze the problem', 'Generate solution', 'Verify result'],
  }]
}

function parseExpansion(raw: string): string[] {
  try {
    const jsonMatch = raw.match(/\[[\s\S]*\]/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as string[]
    }
  } catch { /* fall through */ }
  return ['Continue reasoning deeper into the problem space']
}

export async function runTreeOfThought(
  query: string,
  context?: string,
  maxBranches?: number,
  generateFn?: GenerateFn,
): Promise<ReasoningChain> {
  const generate = generateFn ?? defaultGenerateFn
  const branches = maxBranches ?? DEFAULT_MAX_BRANCHES
  const startTime = Date.now()

  const fullQuery = context ? `Context: ${context}\n\n${query}` : query

  // Phase 1: Generate initial branches
  const branchPrompt = BRANCH_GENERATION_PROMPT.replace('{count}', String(branches)) + fullQuery
  const rawBranches = await generate(branchPrompt)
  const parsedBranches = parseBranches(rawBranches)

  // Phase 2: Evaluate each branch
  const paths: TreeOfThoughtPath[] = []
  for (const branch of parsedBranches) {
    const evalPrompt = EVALUATION_PROMPT + branch.approach + '\nSteps:\n' + branch.steps.join('\n')
    const evalRaw = await generate(evalPrompt)
    const evaluation = parseEvaluation(evalRaw)

    paths.push({
      id: randomUUID(),
      thoughts: [branch.approach, ...branch.steps],
      evaluation,
      explored: false,
      pruned: evaluation < PRUNE_THRESHOLD,
    })
  }

  // Phase 3: Prune low-quality paths
  const promisingPaths = paths.filter(p => !p.pruned)

  // Phase 4: Expand the best path
  let bestPath: TreeOfThoughtPath
  if (promisingPaths.length > 0) {
    bestPath = promisingPaths.reduce((a, b) => a.evaluation > b.evaluation ? a : b)
  } else {
    bestPath = paths[0] ?? {
      id: randomUUID(),
      thoughts: ['Fallback: analyze the problem directly'],
      evaluation: 0.5,
      explored: false,
      pruned: false,
    }
  }

  // Expand best path
  const expandPrompt = EXPANSION_PROMPT
    .replace('{path}', bestPath.thoughts.join('\n'))
    .replace('{query}', fullQuery)
  const expansionRaw = await generate(expandPrompt)
  const expandedSteps = parseExpansion(expansionRaw)
  bestPath.thoughts.push(...expandedSteps)
  bestPath.explored = true

  // Phase 5: Build reasoning chain from the best path
  const stepTypes: ReasoningStep['type'][] = ['analysis', 'decomposition', 'hypothesis', 'verification', 'synthesis']
  const steps: ReasoningStep[] = bestPath.thoughts.map((thought, i) => ({
    id: randomUUID(),
    type: stepTypes[Math.min(i, stepTypes.length - 1)]!,
    content: thought,
    confidence: bestPath.evaluation * (1 - i * 0.05), // Slight confidence decay per step
  }))

  // Add metadata about explored alternatives
  const prunedCount = paths.filter(p => p.pruned).length
  const exploredCount = paths.filter(p => p.explored).length

  return {
    id: randomUUID(),
    strategy: 'tot',
    query,
    steps,
    conclusion: steps[steps.length - 1]?.content ?? 'Tree-of-thought exploration complete.',
    confidence: bestPath.evaluation,
    durationMs: Date.now() - startTime,
    timestamp: Date.now(),
    metadata: {
      totalPaths: paths.length,
      prunedPaths: prunedCount,
      exploredPaths: exploredCount,
      bestPathEvaluation: bestPath.evaluation,
      alternativeApproaches: paths.filter(p => !p.pruned && p.id !== bestPath.id).map(p => ({
        approach: p.thoughts[0],
        evaluation: p.evaluation,
      })),
    },
  }
}
