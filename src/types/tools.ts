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
  type: 'bash' | 'bash_progress'
  command?: string
  stdout?: string
  stderr?: string
  exitCode?: number | null
}

export interface AgentToolProgress extends ToolProgressData {
  type: 'agent' | 'agent_progress'
  agentId?: string
  status?: string
  message?: any
  prompt?: string
}

export interface MCPProgress extends ToolProgressData {
  type: 'mcp' | 'mcp_progress'
  serverName?: string
  toolName?: string
  status?: string
  progress?: number
  total?: number
  progressMessage?: string
  elapsedTimeMs?: number
}

export interface SkillToolProgress extends ToolProgressData {
  type: 'skill' | 'skill_progress'
  skillName?: string
  message?: any
  prompt?: string
  agentId?: string
}

export interface WebSearchProgress extends ToolProgressData {
  type: 'web_search' | 'query_update' | 'search_results_received'
  query?: string
  results?: any[]
  resultCount?: number
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

export interface PowerShellProgress extends ToolProgressData {
  type: 'bash' | 'bash_progress' | 'powershell_progress'
  command?: string
  stdout?: string
  stderr?: string
  exitCode?: number | null
}
export type ShellProgress = BashProgress | PowerShellProgress
