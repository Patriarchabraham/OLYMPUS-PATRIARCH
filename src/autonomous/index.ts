// Autonomous execution system for Mythos Patriarch
// Provides long-running task management with checkpointing, error recovery,
// progress tracking, and goal management.

export type {
  AutonomousGoal,
  Milestone,
  Checkpoint,
  RecoveryStrategy,
  ErrorContext,
  TaskProgress,
  AutonomousConfig,
} from './types.js'

export { DEFAULT_CONFIG } from './types.js'

export {
  createCheckpoint,
  saveCheckpoint,
  loadCheckpoint,
  listCheckpoints,
  deleteCheckpoint,
  restoreFromCheckpoint,
  clearGoalCheckpoints,
} from './checkpoint.js'

export {
  analyzeError,
  attemptRecovery,
  retryWithBackoff,
  escalateToUser,
  createErrorContext,
} from './errorRecovery.js'

export {
  startTracking,
  updateProgress,
  estimateTimeRemaining,
  getProgress,
  getAllProgress,
  setStatus as setProgressStatus,
  stopTracking,
} from './progressTracker.js'

export {
  createGoal,
  decomposeGoal,
  updateGoal,
  getGoal,
  listGoals,
  prioritizeGoals,
  completeGoal,
  failGoal,
  recalculateProgress,
  clearGoals,
  setDataDir,
  loadGoals,
  persistGoals,
} from './goalManager.js'

export {
  executeGoal,
  runWithCheckpointing,
  runAutonomously,
} from './taskRunner.js'

export type { StepExecutor, TaskRunnerCallbacks } from './taskRunner.js'

import type { AutonomousConfig, AutonomousGoal, TaskProgress } from './types.js'
import { DEFAULT_CONFIG } from './types.js'
import { executeGoal, runAutonomously, runWithCheckpointing } from './taskRunner.js'
import {
  createGoal,
  decomposeGoal,
  getGoal,
  listGoals,
  prioritizeGoals,
  updateGoal,
  completeGoal,
  failGoal,
  setDataDir,
  loadGoals,
  persistGoals,
} from './goalManager.js'
import { startTracking, getProgress, stopTracking } from './progressTracker.js'
import { clearGoalCheckpoints, setCheckpointsBaseDir } from './checkpoint.js'
import type { TaskRunnerCallbacks } from './taskRunner.js'

export class AutonomousRunner {
  private config: AutonomousConfig
  private callbacks: TaskRunnerCallbacks

  constructor(config?: Partial<AutonomousConfig>, callbacks?: TaskRunnerCallbacks) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.callbacks = callbacks ?? {}

    // Wire up filesystem persistence: use .mythos/autonomous under cwd
    const cwd = process.cwd()
    setDataDir(cwd)
    setCheckpointsBaseDir(cwd)

    // Restore previously saved goals from disk
    void loadGoals()
  }

  /** Create a new goal and optionally decompose it into milestones. */
  createGoal(title: string, description: string, priority?: number): AutonomousGoal {
    const goal = createGoal(title, description, priority)
    decomposeGoal(goal)
    return goal
  }

  /** Execute a single goal autonomously. */
  async execute(goal: AutonomousGoal): Promise<void> {
    await executeGoal(goal, this.config, this.callbacks)
  }

  /** Execute multiple goals autonomously, respecting concurrency limits. */
  async executeAll(goals: AutonomousGoal[]): Promise<void> {
    await runAutonomously(goals, this.config, this.callbacks)
  }

  /** Execute a list of steps with checkpointing. */
  async runSteps(steps: (() => Promise<void>)[], goalId: string): Promise<void> {
    await runWithCheckpointing(steps, goalId, this.config, this.callbacks)
  }

  /** Get a goal by ID. */
  getGoal(id: string): AutonomousGoal | undefined {
    return getGoal(id)
  }

  /** List all goals, optionally filtered. */
  listGoals(): AutonomousGoal[] {
    return listGoals()
  }

  /** Get prioritized goal queue. */
  getPriorityQueue(): AutonomousGoal[] {
    return prioritizeGoals()
  }

  /** Get progress for a goal. */
  getProgress(goalId: string): TaskProgress {
    return getProgress(goalId)
  }

  /** Update a goal's properties. */
  updateGoal(id: string, updates: Partial<AutonomousGoal>): AutonomousGoal {
    return updateGoal(id, updates)
  }

  /** Mark a goal as completed. */
  completeGoal(id: string, result: string): AutonomousGoal {
    return completeGoal(id, result)
  }

  /** Mark a goal as failed. */
  failGoal(id: string, reason: string): AutonomousGoal {
    return failGoal(id, reason)
  }

  /** Clean up checkpoints for a goal. */
  async cleanup(goalId: string): Promise<void> {
    await clearGoalCheckpoints(goalId)
    stopTracking(goalId)
  }
}

export function createAutonomousRunner(
  config?: Partial<AutonomousConfig>,
  callbacks?: TaskRunnerCallbacks,
): AutonomousRunner {
  return new AutonomousRunner(config, callbacks)
}
