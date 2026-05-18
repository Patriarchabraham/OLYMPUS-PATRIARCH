// Stub file — minimal type exports to satisfy importers

export type QueueOperation = string

export type QueueOperationMessage = {
  type: 'queue-operation'
  operation: QueueOperation
  timestamp: string
  sessionId: string
  content?: string
}
