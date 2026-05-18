import { randomUUID } from 'crypto'
import type {
  ToolStep,
  CompositeOperation,
} from './types.js'
import { BUILTIN_OPERATIONS } from './types.js'
import { createPipeline } from './toolChain.js'

export function createCompositeOperation(
  op: Omit<CompositeOperation, 'pipeline'> & { steps?: ToolStep[] },
): CompositeOperation {
  const steps = op.steps ?? expandOperationTemplate(op.category)
  const pipeline = createPipeline(op.name, steps, {
    description: op.description,
    tags: [op.category],
  })

  return {
    name: op.name,
    description: op.description,
    category: op.category,
    pipeline,
    requiredTools: op.requiredTools ?? [],
    estimatedComplexity: op.estimatedComplexity ?? 'medium',
  }
}

export function getBuiltinOperations(): CompositeOperation[] {
  return Object.entries(BUILTIN_OPERATIONS).map(([key, def]) =>
    createCompositeOperation({
      name: def.name ?? key,
      description: def.description ?? '',
      category: def.category ?? 'custom',
      requiredTools: def.requiredTools ?? [],
      estimatedComplexity: def.estimatedComplexity ?? 'medium',
    }),
  )
}

export function matchOperation(query: string): CompositeOperation | null {
  const lower = query.toLowerCase()
  const operations = getBuiltinOperations()

  const keywordMap: Record<string, string[]> = {
    'refactor-module': ['refactor', 'restructure', 'reorganize', 'rewrite module'],
    'add-feature': ['add feature', 'implement feature', 'new feature', 'create feature'],
    'fix-bug': ['fix bug', 'debug', 'fix error', 'resolve issue', 'patch'],
    'analyze-codebase': ['analyze', 'review codebase', 'audit', 'assess', 'inspect'],
  }

  let bestMatch: string | null = null
  let bestScore = 0

  for (const [opKey, keywords] of Object.entries(keywordMap)) {
    let score = 0
    for (const keyword of keywords) {
      if (lower.includes(keyword)) {
        score += keyword.length
      }
    }
    if (score > bestScore) {
      bestScore = score
      bestMatch = opKey
    }
  }

  if (bestMatch && bestScore > 0) {
    return operations.find(
      (op) => op.name === BUILTIN_OPERATIONS[bestMatch!]?.name,
    ) ?? null
  }

  return null
}

export function expandOperation(op: CompositeOperation): ToolStep[] {
  return op.pipeline.steps.length > 0
    ? op.pipeline.steps
    : expandOperationTemplate(op.category)
}

export function customizeOperation(
  op: CompositeOperation,
  overrides: Partial<CompositeOperation>,
): CompositeOperation {
  return {
    ...op,
    ...overrides,
    pipeline: overrides.pipeline ?? op.pipeline,
    requiredTools: overrides.requiredTools ?? op.requiredTools,
    estimatedComplexity: overrides.estimatedComplexity ?? op.estimatedComplexity,
  }
}

function expandOperationTemplate(
  category: CompositeOperation['category'],
): ToolStep[] {
  const templates: Record<string, ToolStep[]> = {
    refactor: [
      { toolName: 'FileReadTool', parameters: {}, outputRef: 'sourceCode' },
      { toolName: 'GrepTool', parameters: {}, outputRef: 'references', inputRefs: { query: 'sourceCode' } },
      { toolName: 'EnterPlanModeTool', parameters: {}, outputRef: 'plan', inputRefs: { context: 'sourceCode' } },
      { toolName: 'FileEditTool', parameters: {}, outputRef: 'editResult', inputRefs: { plan: 'plan' } },
      { toolName: 'BashTool', parameters: { command: 'npm test' }, outputRef: 'testResult' },
    ],
    feature: [
      { toolName: 'EnterPlanModeTool', parameters: {}, outputRef: 'plan' },
      { toolName: 'FileWriteTool', parameters: {}, outputRef: 'newFile', inputRefs: { plan: 'plan' } },
      { toolName: 'FileEditTool', parameters: {}, outputRef: 'edits', inputRefs: { plan: 'plan' } },
      { toolName: 'BashTool', parameters: { command: 'npm test' }, outputRef: 'testResult' },
    ],
    bugfix: [
      { toolName: 'GrepTool', parameters: {}, outputRef: 'relatedCode' },
      { toolName: 'FileReadTool', parameters: {}, outputRef: 'bugContext', inputRefs: { results: 'relatedCode' } },
      { toolName: 'FileEditTool', parameters: {}, outputRef: 'fix', inputRefs: { context: 'bugContext' } },
      { toolName: 'BashTool', parameters: { command: 'npm test' }, outputRef: 'testResult' },
    ],
    analysis: [
      { toolName: 'GlobTool', parameters: {}, outputRef: 'fileList' },
      { toolName: 'GrepTool', parameters: {}, outputRef: 'patterns', inputRefs: { paths: 'fileList' } },
      { toolName: 'FileReadTool', parameters: {}, outputRef: 'samples', inputRefs: { paths: 'fileList' } },
    ],
    testing: [
      { toolName: 'GlobTool', parameters: { pattern: '**/*.test.*' }, outputRef: 'testFiles' },
      { toolName: 'BashTool', parameters: { command: 'npm test' }, outputRef: 'testResults' },
    ],
    deployment: [
      { toolName: 'BashTool', parameters: { command: 'npm run build' }, outputRef: 'buildResult' },
      { toolName: 'BashTool', parameters: { command: 'npm run lint' }, outputRef: 'lintResult' },
      { toolName: 'BashTool', parameters: { command: 'npm test' }, outputRef: 'testResult' },
    ],
    custom: [],
  }

  return templates[category] ?? []
}
