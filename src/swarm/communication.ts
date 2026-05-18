import { randomUUID } from 'crypto'
import { EventEmitter } from 'events'
import type { MessageHandler, SwarmMessage } from './types.js'

export type BusEvent = 'message' | `message:${string}`

export class SwarmMessageBus {
  private emitter = new EventEmitter()
  private history: SwarmMessage[] = []
  private queues: Map<string, SwarmMessage[]> = new Map()
  private readonly maxHistorySize: number

  constructor(maxHistorySize = 10_000) {
    this.maxHistorySize = maxHistorySize
    // Avoid Node.js MaxListenersExceededWarning for swarms with many agents
    this.emitter.setMaxListeners(100)
  }

  /**
   * Send a message to a specific agent.
   * If the agent is not currently subscribed, the message is queued.
   */
  send(message: Omit<SwarmMessage, 'id' | 'timestamp'>): SwarmMessage {
    const full: SwarmMessage = {
      ...message,
      id: randomUUID(),
      timestamp: Date.now(),
    }

    this.history.push(full)
    if (this.history.length > this.maxHistorySize) {
      this.history = this.history.slice(-this.maxHistorySize)
    }

    if (message.toAgentId === '*') {
      // Broadcast — emit for every subscriber
      this.emitter.emit('message', full)
    } else {
      // Direct — if subscriber exists, emit; otherwise queue
      const hasListener = this.emitter.listenerCount(
        `message:${message.toAgentId}`,
      )
      if (hasListener > 0) {
        this.emitter.emit(`message:${message.toAgentId}`, full)
      } else {
        this.enqueue(message.toAgentId, full)
      }
    }

    return full
  }

  /**
   * Broadcast a message to all agents.
   */
  broadcast(
    fromAgentId: string,
    type: SwarmMessage['type'],
    payload: unknown,
  ): SwarmMessage {
    return this.send({ fromAgentId, toAgentId: '*', type, payload })
  }

  /**
   * Subscribe an agent to receive messages addressed to it.
   * Also drains any queued messages for the agent.
   */
  subscribe(agentId: string, handler: MessageHandler): void {
    const wrapped: MessageHandler = msg => {
      // Ignore messages the agent sent to itself
      if (msg.fromAgentId === agentId) return
      handler(msg)
    }

    this.emitter.on(`message:${agentId}`, wrapped)

    // Drain queued messages
    const queued = this.queues.get(agentId)
    if (queued && queued.length > 0) {
      for (const msg of queued) {
        wrapped(msg)
      }
      this.queues.delete(agentId)
    }
  }

  /**
   * Subscribe to all broadcast messages.
   */
  subscribeBroadcast(handler: MessageHandler): void {
    this.emitter.on('message', handler)
  }

  /**
   * Unsubscribe an agent.
   */
  unsubscribe(agentId: string): void {
    this.emitter.removeAllListeners(`message:${agentId}`)
  }

  /**
   * Remove all listeners.
   */
  destroy(): void {
    this.emitter.removeAllListeners()
    this.queues.clear()
  }

  /**
   * Get message history, optionally filtered.
   */
  getHistory(filter?: {
    fromAgentId?: string
    toAgentId?: string
    type?: SwarmMessage['type']
    since?: number
  }): SwarmMessage[] {
    if (!filter) return [...this.history]

    return this.history.filter(msg => {
      if (filter.fromAgentId && msg.fromAgentId !== filter.fromAgentId)
        return false
      if (
        filter.toAgentId &&
        msg.toAgentId !== filter.toAgentId &&
        msg.toAgentId !== '*'
      )
        return false
      if (filter.type && msg.type !== filter.type) return false
      if (filter.since && msg.timestamp < filter.since) return false
      return true
    })
  }

  private enqueue(agentId: string, message: SwarmMessage): void {
    const queue = this.queues.get(agentId)
    if (queue) {
      queue.push(message)
      // Cap per-agent queue size
      if (queue.length > 1000) {
        this.queues.set(agentId, queue.slice(-500))
      }
    } else {
      this.queues.set(agentId, [message])
    }
  }
}
