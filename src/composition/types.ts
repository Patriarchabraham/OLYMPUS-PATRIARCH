export type ToolExecutor = (
  toolName: string,
  parameters: Record<string, unknown>,
) => Promise<unknown>

export interface ToolStep {
  toolName: string
  parameters: Record<string, unknown>
  outputRef?: string
  inputRefs?: Record<string, string>
  condition?: string
  retryCount?: number
  timeout?: number
}

export interface ToolPipeline {
  id: string
  name: string
  description: string
  steps: ToolStep[]
  tags: string[]
  createdAt: number
  updatedAt: number
  executionCount: number
  successRate: number
}

export interface PipelineExecution {
  id: string
  pipelineId: string
  status: 'running' | 'completed' | 'failed' | 'paused'
  currentStepIndex: number
  results: Map<string, StepResult>
  startedAt: number
  completedAt?: number
  error?: string
}

export interface StepResult {
  stepIndex: number
  toolName: string
  success: boolean
  output: unknown
  durationMs: number
  error?: string
}

export interface CompositeOperation {
  name: string
  description: string
  category:
    | 'refactor'
    | 'feature'
    | 'bugfix'
    | 'analysis'
    | 'testing'
    | 'deployment'
    | 'custom'
  pipeline: ToolPipeline
  requiredTools: string[]
  estimatedComplexity: 'low' | 'medium' | 'high'
}

export const BUILTIN_OPERATIONS: Record<string, Partial<CompositeOperation>> = {
  'refactor-module': {
    name: 'Refactor Module',
    description:
      'Read module, analyze structure, plan refactoring, apply changes, run tests',
    category: 'refactor',
    requiredTools: [
      'FileReadTool',
      'GrepTool',
      'EnterPlanModeTool',
      'FileEditTool',
      'BashTool',
    ],
  },
  'add-feature': {
    name: 'Add Feature',
    description: 'Plan feature, create files, implement, add tests, verify',
    category: 'feature',
    requiredTools: ['FileWriteTool', 'FileEditTool', 'BashTool', 'TaskCreateTool'],
  },
  'fix-bug': {
    name: 'Fix Bug',
    description:
      'Reproduce bug, locate root cause, apply fix, verify fix, run tests',
    category: 'bugfix',
    requiredTools: ['GrepTool', 'FileReadTool', 'FileEditTool', 'BashTool'],
  },
  'analyze-codebase': {
    name: 'Analyze Codebase',
    description:
      'Explore structure, identify patterns, assess quality, generate report',
    category: 'analysis',
    requiredTools: ['GlobTool', 'GrepTool', 'FileReadTool'],
  },
}
