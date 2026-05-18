/**
 * Tool type definitions for the Mythos conversation system.
 * Centralized location for tool progress types to break import cycles.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

// ─── Tool progress types ─────────────────────────────────────────

export interface ToolProgressData {
  type: string
  [key: string]: any
}

export interface BashProgress extends ToolProgressData {
  type: 'bash'
  command?: string
  stdout?: string
  stderr?: string
  exitCode?: number | null
}

export interface AgentToolProgress extends ToolProgressData {
  type: 'agent'
  agentId?: string
  status?: string
}

export interface MCPProgress extends ToolProgressData {
  type: 'mcp'
  serverName?: string
  toolName?: string
}

export interface SkillToolProgress extends ToolProgressData {
  type: 'skill'
  skillName?: string
}

export interface WebSearchProgress extends ToolProgressData {
  type: 'web_search'
  query?: string
  results?: any[]
}

export interface TaskOutputProgress extends ToolProgressData {
  type: 'task_output'
  taskId?: string
}

export interface REPLToolProgress extends ToolProgressData {
  type: 'repl'
}

export interface SdkWorkflowProgress extends ToolProgressData {
  type: 'sdk_workflow'
  taskId?: string
  step?: string
}

export type ShellProgress = BashProgress
