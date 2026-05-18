import type { ErrorContext, RecoveryStrategy } from './types.js'

const RECOVERY_STRATEGY_ORDER: RecoveryStrategy['type'][] = [
  'retry',
  'simplify',
  'alternative_approach',
  'escalate',
]

export function analyzeError(
  error: Error,
  context: ErrorContext,
): RecoveryStrategy {
  const attemptIndex = Math.min(
    context.recoveryAttempts,
    RECOVERY_STRATEGY_ORDER.length - 1,
  )
  const type = RECOVERY_STRATEGY_ORDER[attemptIndex] ?? 'escalate'

  const descriptions: Record<RecoveryStrategy['type'], string> = {
    retry: `Retry the same step "${context.step}" — the error may be transient.`,
    simplify: `Simplify step "${context.step}" to work around the error: ${error.message}`,
    alternative_approach: `Try an alternative approach for "${context.step}" instead of the original strategy.`,
    escalate: `Escalate "${context.step}" to the user — unable to recover automatically after ${context.recoveryAttempts} attempts.`,
    skip: `Skip step "${context.step}" and continue with remaining work.`,
  }

  return {
    type,
    description: descriptions[type],
    maxAttempts: type === 'retry' ? 3 : 1,
    attemptsUsed: 0,
  }
}

export async function attemptRecovery(
  strategy: RecoveryStrategy,
  context: ErrorContext,
  executeFn: () => Promise<void>,
): Promise<boolean> {
  if (strategy.attemptsUsed >= strategy.maxAttempts) {
    return false
  }

  try {
    await executeFn()
    return true
  } catch {
    strategy.attemptsUsed++
    return false
  }
}

export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseBackoffMs: number = 1000,
): Promise<T> {
  let lastError: Error | undefined

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))

      if (attempt < maxRetries) {
        const backoff = baseBackoffMs * Math.pow(2, attempt)
        const jitter = Math.random() * backoff * 0.1
        await new Promise(resolve => setTimeout(resolve, backoff + jitter))
      }
    }
  }

  throw lastError ?? new Error('retryWithBackoff: all retries exhausted')
}

export function escalateToUser(
  error: Error,
  context: ErrorContext,
): string {
  const previousStrategies = context.previousStrategies
    .map(s => `- ${s.type}: ${s.description} (${s.attemptsUsed}/${s.maxAttempts} attempts)`)
    .join('\n')

  return [
    `Autonomous execution requires guidance.`,
    ``,
    `Goal: ${context.goalId}`,
    context.milestoneId ? `Milestone: ${context.milestoneId}` : '',
    `Step: ${context.step}`,
    `Error: ${error.message}`,
    `Recovery attempts: ${context.recoveryAttempts}`,
    ``,
    `Strategies tried:`,
    previousStrategies || '(none)',
    ``,
    `Please provide guidance or manual intervention to continue.`,
  ].filter(Boolean).join('\n')
}

export function createErrorContext(
  error: Error,
  step: string,
  goalId: string,
  milestoneId?: string,
): ErrorContext {
  return {
    error,
    step,
    goalId,
    milestoneId,
    recoveryAttempts: 0,
    previousStrategies: [],
  }
}
