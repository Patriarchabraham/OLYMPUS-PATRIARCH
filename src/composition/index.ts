// Types
export type {
  ToolStep,
  ToolPipeline,
  PipelineExecution,
  StepResult,
  CompositeOperation,
} from './types.js'
export { BUILTIN_OPERATIONS } from './types.js'

// Tool chain / pipeline execution
export {
  createPipeline,
  executePipeline,
  validatePipeline,
  resolveStepInputs,
  evaluateCondition,
  serializeExecution,
  type ToolExecutor,
} from './toolChain.js'

// Composite operations
export {
  createCompositeOperation,
  getBuiltinOperations,
  matchOperation,
  expandOperation,
  customizeOperation,
} from './compositeTool.js'

// Registry
export { ToolRegistry } from './toolRegistry.js'

// Shorthand helpers
import { createPipeline, executePipeline } from './toolChain.js'
import type { ToolStep, ToolPipeline, PipelineExecution, ToolExecutor } from './types.js'

export function compose(
  name: string,
  steps: ToolStep[],
  options?: { description?: string; tags?: string[] },
): ToolPipeline {
  return createPipeline(name, steps, options)
}

export function execute(
  pipeline: ToolPipeline,
  executor: ToolExecutor,
  context?: Record<string, unknown>,
): Promise<PipelineExecution> {
  return executePipeline(pipeline, executor, context)
}
