import type { TaskStateBase, TaskStatus, TaskType } from '../../Task.js'

export type LocalWorkflowTaskState = TaskStateBase & {
  type: 'local_workflow'
  status: TaskStatus
  summary?: string
  isBackgrounded?: boolean
  workflowName?: string
  agentCount?: number
}
export async function killWorkflowTask(_id: string): Promise<void> {}
export async function skipWorkflowAgent(_id: string, _agentId: string): Promise<void> {}
export async function retryWorkflowAgent(_id: string, _agentId: string): Promise<void> {}
