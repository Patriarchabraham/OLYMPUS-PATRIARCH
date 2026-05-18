import type { TaskProgress } from './types.js'

interface TrackedGoal {
  goalId: string
  totalSteps: number
  completedSteps: number
  currentStep: string
  startTime: number
  stepStartTimes: number[]
  status: TaskProgress['status']
}

const trackedGoals = new Map<string, TrackedGoal>()

export function startTracking(goalId: string, totalSteps: number): void {
  trackedGoals.set(goalId, {
    goalId,
    totalSteps,
    completedSteps: 0,
    currentStep: '',
    startTime: Date.now(),
    stepStartTimes: [Date.now()],
    status: 'running',
  })
}

export function updateProgress(goalId: string, step: string): TaskProgress {
  const tracked = trackedGoals.get(goalId)
  if (!tracked) {
    return {
      goalId,
      currentStep: step,
      totalSteps: 0,
      completedSteps: 0,
      percentComplete: 0,
      status: 'running',
    }
  }

  tracked.completedSteps++
  tracked.currentStep = step
  tracked.stepStartTimes.push(Date.now())

  const percentComplete = tracked.totalSteps > 0
    ? Math.min(100, Math.round((tracked.completedSteps / tracked.totalSteps) * 100))
    : 0

  const estimatedTimeRemainingMs = estimateTimeRemaining(goalId)

  return {
    goalId,
    currentStep: step,
    totalSteps: tracked.totalSteps,
    completedSteps: tracked.completedSteps,
    percentComplete,
    estimatedTimeRemainingMs,
    status: tracked.status,
  }
}

export function estimateTimeRemaining(goalId: string): number {
  const tracked = trackedGoals.get(goalId)
  if (!tracked || tracked.completedSteps === 0) return 0

  const elapsed = Date.now() - tracked.startTime
  const avgStepTime = elapsed / tracked.completedSteps
  const remainingSteps = tracked.totalSteps - tracked.completedSteps

  return Math.max(0, Math.round(avgStepTime * remainingSteps))
}

export function getProgress(goalId: string): TaskProgress {
  const tracked = trackedGoals.get(goalId)
  if (!tracked) {
    return {
      goalId,
      currentStep: '',
      totalSteps: 0,
      completedSteps: 0,
      percentComplete: 0,
      status: 'running',
    }
  }

  return {
    goalId,
    currentStep: tracked.currentStep,
    totalSteps: tracked.totalSteps,
    completedSteps: tracked.completedSteps,
    percentComplete: tracked.totalSteps > 0
      ? Math.min(100, Math.round((tracked.completedSteps / tracked.totalSteps) * 100))
      : 0,
    estimatedTimeRemainingMs: estimateTimeRemaining(goalId),
    status: tracked.status,
  }
}

export function getAllProgress(): TaskProgress[] {
  return Array.from(trackedGoals.keys()).map(getProgress)
}

export function setStatus(goalId: string, status: TaskProgress['status']): void {
  const tracked = trackedGoals.get(goalId)
  if (tracked) {
    tracked.status = status
  }
}

export function stopTracking(goalId: string): void {
  trackedGoals.delete(goalId)
}
