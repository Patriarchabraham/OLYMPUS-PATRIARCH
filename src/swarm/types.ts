import type { EventEmitter } from 'events'

export type AgentRole =
  | 'researcher'
  | 'coder'
  | 'tester'
  | 'reviewer'
  | 'architect'
  | 'dataAnalyst'
  | 'general'

export interface SwarmTask {
  id: string
  description: string
  assignedRole: AgentRole
  priority: number // 1-10
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'blocked'
  dependencies: string[] // task IDs
  result?: SwarmTaskResult
  assignedAgentId?: string
  createdAt: number
  startedAt?: number
  completedAt?: number
}

export interface SwarmTaskResult {
  taskId: string
  success: boolean
  output: string
  artifacts?: string[] // file paths created/modified
  metadata?: Record<string, unknown>
}

export interface SwarmMessage {
  id: string
  fromAgentId: string
  toAgentId: string | '*'
  type:
    | 'task_assignment'
    | 'task_result'
    | 'query'
    | 'response'
    | 'vote'
    | 'consensus'
    | 'error'
    | 'heartbeat'
  payload: unknown
  timestamp: number
}

export interface SwarmVote {
  agentId: string
  agentRole: AgentRole
  decision: string
  confidence: number
  reasoning: string
}

export interface SwarmConsensus {
  topic: string
  votes: SwarmVote[]
  finalDecision: string
  agreement: number // 0-1 percentage of agreement
  timestamp: number
}

export interface SwarmConfig {
  maxAgents: number
  roles: AgentRole[]
  consensusThreshold: number // 0-1, default 0.6
  taskTimeoutMs: number
  heartbeatIntervalMs: number
}

export interface SwarmState {
  id: string
  config: SwarmConfig
  tasks: Map<string, SwarmTask>
  agents: Map<string, SwarmAgentInfo>
  messages: SwarmMessage[]
  status: 'initializing' | 'active' | 'paused' | 'completed' | 'failed'
  createdAt: number
}

export interface SwarmAgentInfo {
  id: string
  role: AgentRole
  capabilities: string[]
  currentTaskId?: string
  status: 'idle' | 'busy' | 'error'
}

export const DEFAULT_SWARM_CONFIG: SwarmConfig = {
  maxAgents: 5,
  roles: ['coder', 'researcher', 'tester', 'reviewer', 'architect'],
  consensusThreshold: 0.6,
  taskTimeoutMs: 300_000, // 5 minutes
  heartbeatIntervalMs: 30_000, // 30 seconds
}

export type MessageHandler = (message: SwarmMessage) => void | Promise<void>
