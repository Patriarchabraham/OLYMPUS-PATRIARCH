export type LocalWorkflowTaskState = {
  id: string
  type: string
  status: string
  description: string
  summary?: string
  startTime?: number
  isBackgrounded?: boolean
}
export async function killWorkflowTask(_id: string): Promise<void> {}
export async function skipWorkflowAgent(_id: string, _agentId: string): Promise<void> {}
export async function retryWorkflowAgent(_id: string, _agentId: string): Promise<void> {}
