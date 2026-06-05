// Public API for the Olympuz Coder Swarm System

export type {
  AgentRole,
  SwarmTask,
  SwarmTaskResult,
  SwarmMessage,
  SwarmVote,
  SwarmConsensus,
  SwarmConfig,
  SwarmState,
  SwarmAgentInfo,
  MessageHandler,
} from './types.js'

export { DEFAULT_SWARM_CONFIG } from './types.js'

export {
  getRoleDefinition,
  getAllRoleDefinitions,
  getBestRoleForTask,
} from './roles.js'
export type { RoleDefinition } from './roles.js'

export { SwarmMessageBus } from './communication.js'

export {
  calculateConsensus,
  isConsensusReached,
  createVoteCollector,
} from './consensus.js'
export type { ConsensusOptions } from './consensus.js'

export {
  analyzeTaskComplexity,
  assignTask,
  decomposeTask,
  buildDependencyGraph,
  topologicalSort,
  findReadyTasks,
  createTask,
} from './taskDistribution.js'
export type {
  TaskComplexity,
  ComplexityAssessment,
  DecomposedTask,
  AgentPerformance,
} from './taskDistribution.js'

export {
  SwarmOrchestrator,
  getSwarmOrchestrator,
} from './orchestrator.js'

export {
  initializeSwarm,
  spawnAgents,
  collectResults,
  terminateSwarm,
  healthCheck,
  executeSwarmWorkflow,
} from './lifecycle.js'
export type { SpawnOptions } from './lifecycle.js'
