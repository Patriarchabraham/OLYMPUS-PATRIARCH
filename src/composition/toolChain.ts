import { randomUUID } from 'crypto'
import type { ToolStep, ToolPipeline, PipelineExecution, StepResult } from './types.js'

export type ToolExecutor = (
  toolName: string,
  parameters: Record<string, unknown>,
) => Promise<unknown>

const DEFAULT_TIMEOUT_MS = 60_000

export function createPipeline(
  name: string,
  steps: ToolStep[],
  options?: { description?: string; tags?: string[] },
): ToolPipeline {
  return {
    id: randomUUID(),
    name,
    description: options?.description ?? '',
    steps,
    tags: options?.tags ?? [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    executionCount: 0,
    successRate: 1,
  }
}

export function validatePipeline(pipeline: ToolPipeline): {
  valid: boolean
  errors: string[]
} {
  const errors: string[] = []

  if (!pipeline.name || pipeline.name.trim().length === 0) {
    errors.push('Pipeline name is required')
  }

  if (pipeline.steps.length === 0) {
    errors.push('Pipeline must have at least one step')
  }

  const outputRefs = new Set<string>()
  for (let i = 0; i < pipeline.steps.length; i++) {
    const step = pipeline.steps[i]

    if (!step.toolName) {
      errors.push(`Step ${i}: toolName is required`)
      continue
    }

    if (step.outputRef) {
      if (outputRefs.has(step.outputRef)) {
        errors.push(
          `Step ${i}: outputRef "${step.outputRef}" is already used by a previous step`,
        )
      }
      outputRefs.add(step.outputRef)
    }

    if (step.inputRefs) {
      for (const [paramName, ref] of Object.entries(step.inputRefs)) {
        if (!outputRefs.has(ref)) {
          errors.push(
            `Step ${i}: inputRefs.${paramName} references "${ref}" which has not been defined by a prior step`,
          )
        }
      }
    }
  }

  return { valid: errors.length === 0, errors }
}

export function resolveStepInputs(
  step: ToolStep,
  previousResults: Map<string, StepResult>,
): Record<string, unknown> {
  const resolved = { ...step.parameters }

  if (step.inputRefs) {
    for (const [paramName, ref] of Object.entries(step.inputRefs)) {
      const result = previousResults.get(ref)
      if (result && result.success) {
        resolved[paramName] = result.output
      }
    }
  }

  return resolved
}

export function evaluateCondition(
  condition: string,
  context: Record<string, unknown>,
): boolean {
  try {
    const keys = Object.keys(context)
    const values = Object.values(context)
    const fn = new Function(...keys, `"use strict"; return (${condition})`)
    return !!fn(...values)
  } catch {
    return false
  }
}

export async function executePipeline(
  pipeline: ToolPipeline,
  executor: ToolExecutor,
  initialContext?: Record<string, unknown>,
): Promise<PipelineExecution> {
  const execution: PipelineExecution = {
    id: randomUUID(),
    pipelineId: pipeline.id,
    status: 'running',
    currentStepIndex: 0,
    results: new Map(),
    startedAt: Date.now(),
  }

  const context: Record<string, unknown> = { ...initialContext }

  for (let i = 0; i < pipeline.steps.length; i++) {
    const step = pipeline.steps[i]
    execution.currentStepIndex = i

    // Evaluate condition
    if (step.condition && !evaluateCondition(step.condition, context)) {
      const skipResult: StepResult = {
        stepIndex: i,
        toolName: step.toolName,
        success: true,
        output: null,
        durationMs: 0,
      }
      if (step.outputRef) {
        execution.results.set(step.outputRef, skipResult)
        context[step.outputRef] = null
      }
      continue
    }

    const params = resolveStepInputs(step, execution.results)
    const maxRetries = step.retryCount ?? 0
    const timeoutMs = step.timeout ?? DEFAULT_TIMEOUT_MS
    let lastError: string | undefined

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const start = Date.now()
      try {
        const output = await withTimeout(
          executor(step.toolName, params),
          timeoutMs,
        )
        const durationMs = Date.now() - start

        const result: StepResult = {
          stepIndex: i,
          toolName: step.toolName,
          success: true,
          output,
          durationMs,
        }
        if (step.outputRef) {
          execution.results.set(step.outputRef, result)
          context[step.outputRef] = output
        } else {
          execution.results.set(`step_${i}`, result)
        }

        lastError = undefined
        break
      } catch (err) {
        const durationMs = Date.now() - start
        lastError = err instanceof Error ? err.message : String(err)

        if (attempt < maxRetries) {
          const backoff = Math.min(1000 * Math.pow(2, attempt), 10_000)
          await sleep(backoff)
          continue
        }

        const result: StepResult = {
          stepIndex: i,
          toolName: step.toolName,
          success: false,
          output: null,
          durationMs,
          error: lastError,
        }
        execution.results.set(`step_${i}`, result)
      }
    }

    if (lastError) {
      execution.status = 'failed'
      execution.error = `Step ${i} (${step.toolName}) failed: ${lastError}`
      execution.completedAt = Date.now()
      return execution
    }
  }

  execution.status = 'completed'
  execution.completedAt = Date.now()
  return execution
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Timed out after ${ms}ms`)),
      ms,
    )
    promise.then(
      (v) => {
        clearTimeout(timer)
        resolve(v)
      },
      (e) => {
        clearTimeout(timer)
        reject(e)
      },
    )
  })
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

export function serializeExecution(
  execution: PipelineExecution,
): Record<string, unknown> {
  const resultsObj: Record<string, unknown> = {}
  for (const [key, value] of execution.results) {
    resultsObj[key] = value
  }
  return {
    ...execution,
    results: resultsObj,
  }
}
