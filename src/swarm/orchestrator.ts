import { randomUUID } from 'crypto'
import type {
  SwarmAgentInfo,
  SwarmConfig,
  SwarmState,
  SwarmTask,
  SwarmTaskResult,
} from './types.js'
import { DEFAULT_SWARM_CONFIG } from './types.js'
import { SwarmMessageBus } from './communication.js'
import {
  assignTask,
  analyzeTaskComplexity,
  createTask,
  decomposeTask,
  findReadyTasks,
  topologicalSort,
} from './taskDistribution.js'

export class SwarmOrchestrator {
  private swarms: Map<string, SwarmState> = new Map()
  private buses: Map<string, SwarmMessageBus> = new Map()
  private executionControllers: Map<string, AbortController> = new Map()

  /**
   * Create a new swarm with the given configuration.
   */
  createSwarm(config: Partial<SwarmConfig> = {}): string {
    const fullConfig: SwarmConfig = { ...DEFAULT_SWARM_CONFIG, ...config }
    const swarmId = randomUUID()

    const state: SwarmState = {
      id: swarmId,
      config: fullConfig,
      tasks: new Map(),
      agents: new Map(),
      messages: [],
      status: 'initializing',
      createdAt: Date.now(),
    }

    this.swarms.set(swarmId, state)
    this.buses.set(swarmId, new SwarmMessageBus())
    state.status = 'active'

    return swarmId
  }

  /**
   * Submit a task to the swarm. Auto-detects complexity and decomposes if needed.
   */
  submitTask(swarmId: string, description: string, priority = 5): string[] {
    const state = this.getSwarm(swarmId)
    const complexity = analyzeTaskComplexity(description)

    if (complexity.estimatedSubtasks <= 1) {
      const task = createTask(description, priority)
      state.tasks.set(task.id, task)
      return [task.id]
    }

    // Decompose complex tasks
    const { subtasks } = decomposeTask(description)
    const taskIds: string[] = []
    const createdTasks: SwarmTask[] = []

    for (const subtask of subtasks) {
      const task: SwarmTask = {
        ...subtask,
        id: randomUUID(),
        priority,
        createdAt: Date.now(),
      }
      createdTasks.push(task)
      state.tasks.set(task.id, task)
      taskIds.push(task.id)
    }

    // Resolve dependencies (indices → IDs)
    for (let i = 0; i < createdTasks.length; i++) {
      if (i > 0) {
        createdTasks[i]!.dependencies.push(createdTasks[i - 1]!.id)
      }
    }

    return taskIds
  }

  /**
   * Submit a pre-built task to the swarm.
   */
  submitRawTask(swarmId: string, task: SwarmTask): void {
    const state = this.getSwarm(swarmId)
    state.tasks.set(task.id, task)
  }

  /**
   * Execute all tasks in the swarm, respecting dependencies.
   * Returns a map of taskId → result.
   */
  async executeSwarm(
    swarmId: string,
    executor: (task: SwarmTask, agent: SwarmAgentInfo) => Promise<SwarmTaskResult>,
  ): Promise<Map<string, SwarmTaskResult>> {
    const state = this.getSwarm(swarmId)
    const controller = new AbortController()
    this.executionControllers.set(swarmId, controller)

    const results = new Map<string, SwarmTaskResult>()
    const ordered = topologicalSort([...state.tasks.values()])

    state.status = 'active'

    for (const taskId of ordered) {
      if (controller.signal.aborted) break

      const task = state.tasks.get(taskId)
      if (!task || task.status === 'completed') continue

      // Wait for dependencies
      const depsComplete = task.dependencies.every(depId => {
        const depResult = results.get(depId)
        return depResult?.success === true
      })

      if (!depsComplete) {
        task.status = 'failed'
        continue
      }

      // Find an agent
      const idleAgents = [...state.agents.values()].filter(a => a.status === 'idle')
      const agent = assignTask(task, idleAgents)

      if (!agent) {
        task.status = 'blocked'
        continue
      }

      // Execute
      task.status = 'in_progress'
      task.startedAt = Date.now()
      task.assignedAgentId = agent.id
      agent.status = 'busy'
      agent.currentTaskId = task.id

      try {
        const result = await executor(task, agent)
        task.status = result.success ? 'completed' : 'failed'
        task.result = result
        task.completedAt = Date.now()
        results.set(task.id, result)
      } catch (err) {
        task.status = 'failed'
        task.result = {
          taskId: task.id,
          success: false,
          output: err instanceof Error ? err.message : String(err),
        }
        task.completedAt = Date.now()
        results.set(task.id, task.result)
      } finally {
        agent.status = 'idle'
        agent.currentTaskId = undefined
      }
    }

    // Determine final swarm status
    const allTasks = [...state.tasks.values()]
    const allComplete = allTasks.every(
      t => t.status === 'completed' || t.status === 'failed',
    )
    const anyFailed = allTasks.some(t => t.status === 'failed')

    if (allComplete) {
      state.status = anyFailed ? 'failed' : 'completed'
    }

    return results
  }

  /**
   * Execute tasks in parallel where possible (respecting dependencies).
   */
  async executeSwarmParallel(
    swarmId: string,
    executor: (task: SwarmTask, agent: SwarmAgentInfo) => Promise<SwarmTaskResult>,
    maxConcurrency = 3,
  ): Promise<Map<string, SwarmTaskResult>> {
    const state = this.getSwarm(swarmId)
    const controller = new AbortController()
    this.executionControllers.set(swarmId, controller)

    const results = new Map<string, SwarmTaskResult>()
    state.status = 'active'

    while (!controller.signal.aborted) {
      const ready = findReadyTasks([...state.tasks.values()])
      if (ready.length === 0) break

      const batch = ready.slice(0, maxConcurrency)

      await Promise.all(
        batch.map(async task => {
          const idleAgents = [...state.agents.values()].filter(
            a => a.status === 'idle',
          )
          const agent = assignTask(task, idleAgents)
          if (!agent) return

          task.status = 'in_progress'
          task.startedAt = Date.now()
          task.assignedAgentId = agent.id
          agent.status = 'busy'
          agent.currentTaskId = task.id

          try {
            const result = await executor(task, agent)
            task.status = result.success ? 'completed' : 'failed'
            task.result = result
            task.completedAt = Date.now()
            results.set(task.id, result)
          } catch (err) {
            task.status = 'failed'
            task.result = {
              taskId: task.id,
              success: false,
              output: err instanceof Error ? err.message : String(err),
            }
            task.completedAt = Date.now()
            results.set(task.id, task.result)
          } finally {
            agent.status = 'idle'
            agent.currentTaskId = undefined
          }
        }),
      )
    }

    const allTasks = [...state.tasks.values()]
    state.status = allTasks.every(t => t.status === 'completed')
      ? 'completed'
      : allTasks.some(t => t.status === 'failed')
        ? 'failed'
        : 'active'

    return results
  }

  pauseSwarm(swarmId: string): void {
    const controller = this.executionControllers.get(swarmId)
    controller?.abort()
    const state = this.swarms.get(swarmId)
    if (state) state.status = 'paused'
  }

  resumeSwarm(swarmId: string): void {
    const state = this.swarms.get(swarmId)
    if (state) state.status = 'active'
  }

  terminateSwarm(swarmId: string): void {
    this.pauseSwarm(swarmId)
    const state = this.swarms.get(swarmId)
    if (state) {
      for (const agent of state.agents.values()) {
        agent.status = 'idle'
        agent.currentTaskId = undefined
      }
      state.status = 'completed'
    }
    const bus = this.buses.get(swarmId)
    bus?.destroy()
    this.buses.delete(swarmId)
    this.executionControllers.delete(swarmId)
  }

  getSwarmStatus(swarmId: string): SwarmState {
    return this.getSwarm(swarmId)
  }

  getMessageBus(swarmId: string): SwarmMessageBus | undefined {
    return this.buses.get(swarmId)
  }

  /**
   * Register an agent with the swarm.
   */
  registerAgent(swarmId: string, agentInfo: SwarmAgentInfo): void {
    const state = this.getSwarm(swarmId)
    state.agents.set(agentInfo.id, agentInfo)
  }

  /**
   * Unregister an agent from the swarm.
   */
  unregisterAgent(swarmId: string, agentId: string): void {
    const state = this.swarms.get(swarmId)
    if (state) {
      state.agents.delete(agentId)
    }
    const bus = this.buses.get(swarmId)
    bus?.unsubscribe(agentId)
  }

  /**
   * List all active swarm IDs.
   */
  listSwarms(): string[] {
    return [...this.swarms.keys()]
  }

  private getSwarm(swarmId: string): SwarmState {
    const state = this.swarms.get(swarmId)
    if (!state) {
      throw new Error(`Swarm ${swarmId} not found`)
    }
    return state
  }
}

// Singleton orchestrator instance
let _instance: SwarmOrchestrator | null = null

export function getSwarmOrchestrator(): SwarmOrchestrator {
  if (!_instance) {
    _instance = new SwarmOrchestrator()
  }
  return _instance
}
