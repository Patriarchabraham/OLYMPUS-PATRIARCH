import { randomUUID } from 'crypto'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { join, dirname } from 'path'
import type { AutonomousGoal, Milestone } from './types.js'

const goals = new Map<string, AutonomousGoal>()

// Persistence
let dataDir: string | null = null

export function setDataDir(dir: string): void {
  dataDir = dir
}

function getGoalsPath(): string {
  return join(dataDir ?? '.mythos/autonomous', 'goals.json')
}

export async function persistGoals(): Promise<void> {
  if (!dataDir) return
  const path = getGoalsPath()
  await mkdir(dirname(path), { recursive: true })
  const data = Array.from(goals.values())
  await writeFile(path, JSON.stringify(data, null, 2), 'utf-8')
}

export async function loadGoals(): Promise<void> {
  if (!dataDir) return
  try {
    const path = getGoalsPath()
    const content = await readFile(path, 'utf-8')
    const data = JSON.parse(content) as AutonomousGoal[]
    goals.clear()
    for (const goal of data) {
      goals.set(goal.id, goal)
    }
  } catch {
    // File doesn't exist yet — start fresh
  }
}

export function createGoal(
  title: string,
  description: string,
  priority: number = 5,
): AutonomousGoal {
  const goal: AutonomousGoal = {
    id: randomUUID(),
    title,
    description,
    priority: Math.max(1, Math.min(10, priority)),
    status: 'pending',
    milestones: [],
    progress: 0,
    createdAt: Date.now(),
  }
  goals.set(goal.id, goal)
  void persistGoals()
  return goal
}

export function decomposeGoal(goal: AutonomousGoal): Milestone[] {
  // Decompose a goal description into logical milestones.
  // This is a heuristic decomposition — the actual AI-driven decomposition
  // would be done by injecting a prompt function from outside.
  const lines = goal.description.split('\n').filter(l => l.trim())
  const milestones: Milestone[] = []

  // If the description has numbered or bulleted items, use them as milestones
  const itemPattern = /^\s*(?:\d+[.)]|[-*])\s+/
  const items = lines.filter(l => itemPattern.test(l))

  if (items.length >= 2) {
    for (const item of items) {
      const title = item.replace(itemPattern, '').trim()
      milestones.push({
        id: randomUUID(),
        title,
        description: title,
        status: 'pending',
      })
    }
  } else {
    // Default decomposition: analyze, plan, execute, verify
    const defaultPhases = [
      { title: 'Analyze requirements', description: `Understand and analyze the goal: ${goal.title}` },
      { title: 'Plan approach', description: `Design the approach for: ${goal.title}` },
      { title: 'Execute', description: `Implement the solution for: ${goal.title}` },
      { title: 'Verify results', description: `Verify and validate results for: ${goal.title}` },
    ]

    for (const phase of defaultPhases) {
      milestones.push({
        id: randomUUID(),
        title: phase.title,
        description: phase.description,
        status: 'pending',
      })
    }
  }

  // Update the goal with milestones
  const existing = goals.get(goal.id)
  if (existing) {
    existing.milestones = milestones
  }

  return milestones
}

export function updateGoal(
  goalId: string,
  updates: Partial<AutonomousGoal>,
): AutonomousGoal {
  const goal = goals.get(goalId)
  if (!goal) {
    throw new Error(`Goal not found: ${goalId}`)
  }

  // Apply allowed updates
  if (updates.title !== undefined) goal.title = updates.title
  if (updates.description !== undefined) goal.description = updates.description
  if (updates.priority !== undefined) goal.priority = Math.max(1, Math.min(10, updates.priority))
  if (updates.status !== undefined) goal.status = updates.status
  if (updates.progress !== undefined) goal.progress = Math.max(0, Math.min(100, updates.progress))
  if (updates.deadline !== undefined) goal.deadline = updates.deadline
  if (updates.metadata !== undefined) goal.metadata = updates.metadata

  void persistGoals()
  return goal
}

export function getGoal(goalId: string): AutonomousGoal | undefined {
  return goals.get(goalId)
}

export function listGoals(filter?: Partial<AutonomousGoal>): AutonomousGoal[] {
  let result = Array.from(goals.values())

  if (filter) {
    result = result.filter(goal => {
      for (const [key, value] of Object.entries(filter)) {
        if (value !== undefined && (goal as unknown as Record<string, unknown>)[key] !== value) {
          return false
        }
      }
      return true
    })
  }

  return result
}

export function prioritizeGoals(): AutonomousGoal[] {
  const all = Array.from(goals.values())
  const now = Date.now()

  return all
    .filter(g => g.status === 'pending' || g.status === 'in_progress')
    .sort((a, b) => {
      // Higher priority first (10 > 1)
      if (a.priority !== b.priority) return b.priority - a.priority

      // Earlier deadline first
      const aDeadline = a.deadline ?? Infinity
      const bDeadline = b.deadline ?? Infinity
      if (aDeadline !== bDeadline) return aDeadline - bDeadline

      // Earlier created first (FIFO within same priority)
      return a.createdAt - b.createdAt
    })
}

export function completeGoal(goalId: string, result: string): AutonomousGoal {
  const goal = goals.get(goalId)
  if (!goal) {
    throw new Error(`Goal not found: ${goalId}`)
  }

  goal.status = 'completed'
  goal.progress = 100
  goal.completedAt = Date.now()

  void persistGoals()

  // Mark all milestones as completed
  for (const milestone of goal.milestones) {
    if (milestone.status !== 'failed') {
      milestone.status = 'completed'
    }
  }

  return goal
}

export function failGoal(goalId: string, reason: string): AutonomousGoal {
  const goal = goals.get(goalId)
  if (!goal) {
    throw new Error(`Goal not found: ${goalId}`)
  }

  goal.status = 'failed'
  goal.metadata = { ...goal.metadata, failureReason: reason }

  void persistGoals()
  return goal
}

export function recalculateProgress(goalId: string): number {
  const goal = goals.get(goalId)
  if (!goal || goal.milestones.length === 0) return 0

  const completed = goal.milestones.filter(m => m.status === 'completed').length
  const progress = Math.round((completed / goal.milestones.length) * 100)

  goal.progress = progress
  return progress
}

export function clearGoals(): void {
  goals.clear()
}
