export interface AssistantSession {
  sessionId: string
  name?: string
  createdAt?: string
  updatedAt?: string
}
export async function discoverAssistantSessions(): Promise<AssistantSession[]> { return [] }
