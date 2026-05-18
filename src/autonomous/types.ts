export interface AutonomousGoal {
  id: string
  title: string
  description: string
  priority: number // 1-10
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'paused'
  milestones: Milestone[]
  progress: number // 0-100
  createdAt: number
  deadline?: number
  completedAt?: number
  metadata?: Record<string, unknown>
}

export interface Milestone {
  id: string
  title: string
  description: string
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  checkpoint?: Checkpoint
  result?: string
}

export interface Checkpoint {
  id: string
  goalId: string
  milestoneId: string
  stepIndex: number
  state: Record<string, unknown>
  filesSnapshot?: string[] // list of files modified so far
  timestamp: number
  summary: string
}

export interface RecoveryStrategy {
  type: 'retry' | 'simplify' | 'alternative_approach' | 'escalate' | 'skip'
  description: string
  maxAttempts: number
  attemptsUsed: number
}

export interface ErrorContext {
  error: Error
  step: string
  goalId: string
  milestoneId?: string
  recoveryAttempts: number
  previousStrategies: RecoveryStrategy[]
}

export interface TaskProgress {
  goalId: string
  currentStep: string
  totalSteps: number
  completedSteps: number
  estimatedTimeRemainingMs?: number
  percentComplete: number
  status: 'running' | 'paused' | 'completed' | 'failed' | 'recovering'
}

export interface AutonomousConfig {
  maxConcurrentGoals: number
  maxRecoveryAttempts: number
  checkpointIntervalMs: number
  progressReportIntervalMs: number
  autoRecovery: boolean
  requireConfirmationForDestructiveActions: boolean
}

export const DEFAULT_CONFIG: AutonomousConfig = {
  maxConcurrentGoals: 3,
  maxRecoveryAttempts: 3,
  checkpointIntervalMs: 30_000,
  progressReportIntervalMs: 5_000,
  autoRecovery: true,
  requireConfirmationForDestructiveActions: true,
}
