import { randomUUID } from 'crypto'
import type { AgentRole, SwarmAgentInfo, SwarmConfig, SwarmTaskResult } from './types.js'
import { DEFAULT_SWARM_CONFIG } from './types.js'
import { getRoleDefinition } from './roles.js'
import {
  SwarmOrchestrator,
  getSwarmOrchestrator,
} from './orchestrator.js'

export interface SpawnOptions {
  roles?: AgentRole[]
  config?: Partial<SwarmConfig>
  agentIdPrefix?: string
}

/**
 * Initialize a new swarm with agents for the specified roles.
 * Returns the swarm ID.
 */
export function initializeSwarm(options: SpawnOptions = {}): string {
  const orchestrator = getSwarmOrchestrator()
  const config: SwarmConfig = {
    ...DEFAULT_SWARM_CONFIG,
    ...options.config,
  }

  if (options.roles) {
    config.roles = options.roles
  }

  const swarmId = orchestrator.createSwarm(config)
  spawnAgents(swarmId, config.roles, options.agentIdPrefix)

  return swarmId
}

/**
 * Spawn agents for specific roles in a swarm.
 */
export function spawnAgents(
  swarmId: string,
  roles: AgentRole[],
  idPrefix = 'agent',
): SwarmAgentInfo[] {
  const orchestrator = getSwarmOrchestrator()
  const spawned: SwarmAgentInfo[] = []

  for (const role of roles) {
    const roleDef = getRoleDefinition(role)
    const agentInfo: SwarmAgentInfo = {
      id: `${idPrefix}-${role}-${randomUUID().slice(0, 8)}`,
      role,
      capabilities: roleDef.capabilities,
      status: 'idle',
    }

    orchestrator.registerAgent(swarmId, agentInfo)
    spawned.push(agentInfo)
  }

  return spawned
}

/**
 * Collect all results from a swarm.
 */
export function collectResults(swarmId: string): SwarmTaskResult[] {
  const orchestrator = getSwarmOrchestrator()
  const state = orchestrator.getSwarmStatus(swarmId)
  const results: SwarmTaskResult[] = []

  for (const task of state.tasks.values()) {
    if (task.result) {
      results.push(task.result)
    }
  }

  return results
}

/**
 * Terminate a swarm and clean up all resources.
 */
export function terminateSwarm(swarmId: string): void {
  const orchestrator = getSwarmOrchestrator()
  orchestrator.terminateSwarm(swarmId)
}

/**
 * Perform a health check on all agents in a swarm.
 */
export function healthCheck(
  swarmId: string,
): {
  healthy: boolean
  agents: Array<{
    id: string
    role: AgentRole
    status: string
    responsive: boolean
  }>
} {
  const orchestrator = getSwarmOrchestrator()
  const state = orchestrator.getSwarmStatus(swarmId)

  const agentReports = [...state.agents.values()].map(agent => ({
    id: agent.id,
    role: agent.role,
    status: agent.status,
    responsive: agent.status !== 'error',
  }))

  return {
    healthy: agentReports.every(a => a.responsive),
    agents: agentReports,
  }
}

/**
 * Execute a complete swarm workflow: initialize → submit → execute → collect → terminate.
 */
export async function executeSwarmWorkflow(
  taskDescriptions: string[],
  executor: (
    task: import('./types.js').SwarmTask,
    agent: SwarmAgentInfo,
  ) => Promise<SwarmTaskResult>,
  options: SpawnOptions = {},
): Promise<{
  swarmId: string
  results: SwarmTaskResult[]
  success: boolean
}> {
  const swarmId = initializeSwarm(options)
  const orchestrator = getSwarmOrchestrator()

  // Submit all tasks
  const allTaskIds: string[] = []
  for (const desc of taskDescriptions) {
    const taskIds = orchestrator.submitTask(swarmId, desc)
    allTaskIds.push(...taskIds)
  }

  // Execute
  const resultMap = await orchestrator.executeSwarmParallel(swarmId, executor)

  // Collect results
  const results = [...resultMap.values()]
  const success = results.every(r => r.success)

  return { swarmId, results, success }
}
