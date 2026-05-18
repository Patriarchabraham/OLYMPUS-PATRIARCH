import { randomUUID } from 'crypto'
import type { AgentRole, SwarmAgentInfo, SwarmTask, SwarmTaskResult } from './types.js'
import { getBestRoleForTask } from './roles.js'

// ── Complexity analysis ──

export type TaskComplexity = 'trivial' | 'simple' | 'moderate' | 'complex' | 'epic'

export interface ComplexityAssessment {
  level: TaskComplexity
  score: number // 0-100
  factors: string[]
  estimatedSubtasks: number
}

const COMPLEXITY_KEYWORDS: Record<TaskComplexity, string[]> = {
  trivial: ['rename', 'typo', 'format', 'lint fix', 'simple'],
  simple: ['add field', 'update text', 'change value', 'fix import', 'single file'],
  moderate: ['refactor function', 'add endpoint', 'update component', 'fix bug in'],
  complex: ['refactor module', 'add feature', 'implement', 'integrate', 'migrate'],
  epic: ['redesign', 'rewrite', 'full migration', 'new architecture', 'from scratch'],
}

export function analyzeTaskComplexity(description: string): ComplexityAssessment {
  const lower = description.toLowerCase()
  let score = 20 // baseline
  const factors: string[] = []

  // Keyword-based scoring
  for (const [level, keywords] of Object.entries(COMPLEXITY_KEYWORDS)) {
    for (const kw of keywords) {
      if (lower.includes(kw)) {
        const levelScores: Record<string, number> = {
          trivial: -15,
          simple: -5,
          moderate: 10,
          complex: 25,
          epic: 40,
        }
        score += levelScores[level] ?? 0
        factors.push(`keyword:${kw}`)
      }
    }
  }

  // Length heuristic — longer descriptions tend to be more complex
  if (description.length > 500) {
    score += 15
    factors.push('long_description')
  } else if (description.length > 200) {
    score += 5
    factors.push('medium_description')
  }

  // Multi-step indicators
  const multiStepIndicators = [
    'and then',
    'after that',
    'also',
    'as well as',
    'including',
    'multiple',
    'several',
    'all the',
    'each',
  ]
  for (const indicator of multiStepIndicators) {
    if (lower.includes(indicator)) {
      score += 8
      factors.push(`multi_step:${indicator}`)
    }
  }

  // Scope indicators
  if (lower.includes('entire') || lower.includes('whole') || lower.includes('all files')) {
    score += 15
    factors.push('wide_scope')
  }

  // Clamp to 0-100
  score = Math.max(0, Math.min(100, score))

  const level = scoreToLevel(score)
  const estimatedSubtasks = estimateSubtaskCount(score)

  return { level, score, factors, estimatedSubtasks }
}

function scoreToLevel(score: number): TaskComplexity {
  if (score <= 10) return 'trivial'
  if (score <= 25) return 'simple'
  if (score <= 50) return 'moderate'
  if (score <= 75) return 'complex'
  return 'epic'
}

function estimateSubtaskCount(complexityScore: number): number {
  if (complexityScore <= 10) return 1
  if (complexityScore <= 25) return 1
  if (complexityScore <= 50) return 2
  if (complexityScore <= 75) return 4
  return 6
}

// ── Task assignment ──

export interface AgentPerformance {
  agentId: string
  role: AgentRole
  tasksCompleted: number
  tasksFailed: number
  avgDurationMs: number
  roleMatchScore: number // 0-1 how well this agent matches the task's required role
}

export function assignTask(
  task: SwarmTask,
  availableAgents: SwarmAgentInfo[],
  performanceHistory?: AgentPerformance[],
): SwarmAgentInfo | null {
  if (availableAgents.length === 0) return null

  // Score each agent
  const scored = availableAgents
    .filter(a => a.status === 'idle')
    .map(agent => {
      let score = 0

      // Role match (most important)
      if (agent.role === task.assignedRole) {
        score += 50
      } else if (agent.role === 'general') {
        score += 20
      }

      // Capability overlap
      score += agent.capabilities.length * 2

      // Performance history
      const perf = performanceHistory?.find(p => p.agentId === agent.id)
      if (perf) {
        score += perf.tasksCompleted * 3
        score -= perf.tasksFailed * 5
        if (perf.roleMatchScore > 0.8) score += 10
      }

      return { agent, score }
    })

  if (scored.length === 0) return null

  // Sort by score descending, pick the best
  scored.sort((a, b) => b.score - a.score)
  return scored[0]!.agent
}

// ── Task decomposition ──

export interface DecomposedTask {
  subtasks: Omit<SwarmTask, 'id' | 'createdAt'>[]
  dependencies: Array<{ from: number; to: number }> // indices into subtasks
}

export function decomposeTask(description: string): DecomposedTask {
  const complexity = analyzeTaskComplexity(description)
  const inferredRole = getBestRoleForTask(description)

  if (complexity.estimatedSubtasks <= 1) {
    return {
      subtasks: [
        {
          description,
          assignedRole: inferredRole,
          priority: 5,
          status: 'pending',
          dependencies: [],
        },
      ],
      dependencies: [],
    }
  }

  // Heuristic decomposition based on complexity
  const subtaskDescriptions = generateSubtasks(description, complexity)
  const subtasks: Omit<SwarmTask, 'id' | 'createdAt'>[] = subtaskDescriptions.map(
    (desc, i) => ({
      description: desc,
      assignedRole: getBestRoleForTask(desc),
      priority: Math.max(1, 10 - i * 2),
      status: 'pending' as const,
      dependencies: [] as string[],
    }),
  )

  // Build sequential dependencies (each depends on previous)
  const dependencies: Array<{ from: number; to: number }> = []
  for (let i = 1; i < subtasks.length; i++) {
    dependencies.push({ from: i - 1, to: i })
    subtasks[i]!.dependencies = [] // resolved later with IDs
  }

  return { subtasks, dependencies }
}

function generateSubtasks(
  description: string,
  complexity: ComplexityAssessment,
): string[] {
  const role = getBestRoleForTask(description)
  const subtasks: string[] = []

  // Research phase (for complex+ tasks)
  if (complexity.score > 40) {
    subtasks.push(
      `Research and understand the current implementation related to: ${description}`,
    )
  }

  // Planning phase (for complex+ tasks)
  if (complexity.score > 60) {
    subtasks.push(
      `Design the approach for: ${description}. Consider existing patterns, dependencies, and potential risks.`,
    )
  }

  // Implementation phase
  subtasks.push(`Implement: ${description}`)

  // Testing phase (for moderate+ tasks)
  if (complexity.score > 25) {
    subtasks.push(
      `Test and verify the implementation of: ${description}. Run relevant tests and check for regressions.`,
    )
  }

  // Review phase (for complex+ tasks)
  if (complexity.score > 50) {
    subtasks.push(
      `Review the changes made for: ${description}. Check for code quality, security issues, and performance.`,
    )
  }

  return subtasks
}

// ── Dependency graph ──

export interface DependencyNode {
  taskId: string
  dependsOn: Set<string>
  dependedBy: Set<string>
}

export function buildDependencyGraph(
  tasks: SwarmTask[],
): Map<string, DependencyNode> {
  const graph = new Map<string, DependencyNode>()

  // Create nodes
  for (const task of tasks) {
    graph.set(task.id, {
      taskId: task.id,
      dependsOn: new Set(task.dependencies),
      dependedBy: new Set(),
    })
  }

  // Build reverse edges
  for (const task of tasks) {
    for (const depId of task.dependencies) {
      const depNode = graph.get(depId)
      if (depNode) {
        depNode.dependedBy.add(task.id)
      }
    }
  }

  return graph
}

/**
 * Topological sort of tasks respecting dependencies.
 * Returns task IDs in execution order.
 */
export function topologicalSort(tasks: SwarmTask[]): string[] {
  const graph = buildDependencyGraph(tasks)
  const visited = new Set<string>()
  const result: string[] = []

  function visit(taskId: string): void {
    if (visited.has(taskId)) return
    visited.add(taskId)

    const node = graph.get(taskId)
    if (node) {
      for (const dep of node.dependsOn) {
        visit(dep)
      }
    }

    result.push(taskId)
  }

  for (const task of tasks) {
    visit(task.id)
  }

  return result
}

/**
 * Find tasks that are ready to execute (all dependencies completed).
 */
export function findReadyTasks(tasks: SwarmTask[]): SwarmTask[] {
  const completedIds = new Set(
    tasks.filter(t => t.status === 'completed').map(t => t.id),
  )

  return tasks.filter(task => {
    if (task.status !== 'pending') return false
    return task.dependencies.every(depId => completedIds.has(depId))
  })
}

/**
 * Create a SwarmTask from a description with auto-detected role and complexity.
 */
export function createTask(
  description: string,
  priority = 5,
  dependencies: string[] = [],
): SwarmTask {
  return {
    id: randomUUID(),
    description,
    assignedRole: getBestRoleForTask(description),
    priority,
    status: 'pending',
    dependencies,
    createdAt: Date.now(),
  }
}
