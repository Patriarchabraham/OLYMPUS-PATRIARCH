export type EffortLevel = 'low' | 'medium' | 'high' | 'max'

export type AnyZodRawShape = Record<string, any>

export type InferShape<T extends AnyZodRawShape> = {
  [K in keyof T]: any
}

export type InternalOptions = {
  abortController?: AbortController
  sessionId?: string
  [key: string]: any
}

export type InternalQuery = {
  prompt: string
  options: InternalOptions
  [key: string]: any
}

export type Options = InternalOptions
export type Query = InternalQuery
export type ListSessionsOptions = { limit?: number; offset?: number }
export type GetSessionInfoOptions = { sessionId: string }
export type GetSessionMessagesOptions = { sessionId: string; limit?: number }
export type SessionMutationOptions = { sessionId: string }
export type ForkSessionOptions = { sessionId: string; prompt?: string }
export type ForkSessionResult = { sessionId: string }
export type SessionMessage = { role: string; content: any }
export type SDKSession = { id: string; [key: string]: any }
export type SDKSessionOptions = { model?: string; [key: string]: any }
export type SdkMcpToolDefinition = { name: string; description?: string; [key: string]: any }
