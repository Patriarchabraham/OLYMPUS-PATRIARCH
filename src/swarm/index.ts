// Public API for the Olympuz Coder Swarm System

export { SwarmMessageBus } from './communication.js'
export type { ConsensusOptions } from './consensus.js'
export {
	calculateConsensus,
	createVoteCollector,
	isConsensusReached,
} from './consensus.js'
export type { SpawnOptions } from './lifecycle.js'
export {
	collectResults,
	executeSwarmWorkflow,
	healthCheck,
	initializeSwarm,
	spawnAgents,
	terminateSwarm,
} from './lifecycle.js'
export type { LlmExecutorOptions } from './llmExecutor.js'
export { buildTaskPrompt, createLlmAgentExecutor, defaultLlmAgentExecutor } from './llmExecutor.js'
export {
	getSwarmOrchestrator,
	SwarmOrchestrator,
} from './orchestrator.js'
export type { RoleDefinition } from './roles.js'
export {
	getAllRoleDefinitions,
	getBestRoleForTask,
	getRoleDefinition,
} from './roles.js'
export type {
	AgentPerformance,
	ComplexityAssessment,
	DecomposedTask,
	TaskComplexity,
} from './taskDistribution.js'
export {
	analyzeTaskComplexity,
	assignTask,
	buildDependencyGraph,
	createTask,
	decomposeTask,
	findReadyTasks,
	topologicalSort,
} from './taskDistribution.js'
export type {
	AgentRole,
	MessageHandler,
	SwarmAgentInfo,
	SwarmConfig,
	SwarmConsensus,
	SwarmMessage,
	SwarmState,
	SwarmTask,
	SwarmTaskResult,
	SwarmVote,
} from './types.js'
export { DEFAULT_SWARM_CONFIG } from './types.js'
