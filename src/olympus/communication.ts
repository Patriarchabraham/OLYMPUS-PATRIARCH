/**
 * Inter-Agent Communication Bus — message passing between agentic employees.
 * Company-scoped pub/sub with queued delivery for offline agents.
 */

import type { AgentMessage, MessageType } from './types.js'

type MessageHandler = (message: AgentMessage) => void | Promise<void>

/**
 * Company-scoped message bus for agent communication.
 * Supports direct messaging, broadcasting, and subscription.
 */
export class AgentMessageBus {
	private handlers: Map<string, Set<MessageHandler>> = new Map()
	private broadcastHandlers: Set<MessageHandler> = new Set()
	private messageQueue: Map<string, AgentMessage[]> = new Map()
	private messageHistory: AgentMessage[] = []
	private maxHistory: number

	constructor(maxHistory = 1000) {
		this.maxHistory = maxHistory
	}

	/**
	 * Subscribe an agent to receive messages addressed to it.
	 * Returns an unsubscribe function.
	 */
	subscribe(agentId: string, handler: MessageHandler): () => void {
		if (!this.handlers.has(agentId)) {
			this.handlers.set(agentId, new Set())
		}
		this.handlers.get(agentId)!.add(handler)

		// Deliver queued messages
		const queued = this.messageQueue.get(agentId) || []
		for (const msg of queued) {
			handler(msg)
		}
		this.messageQueue.delete(agentId)

		return () => this.handlers.get(agentId)?.delete(handler)
	}

	/**
	 * Subscribe to all broadcast messages.
	 * Returns an unsubscribe function.
	 */
	subscribeBroadcast(handler: MessageHandler): () => void {
		this.broadcastHandlers.add(handler)
		return () => this.broadcastHandlers.delete(handler)
	}

	/**
	 * Send a message to a specific agent or broadcast (toAgentId === null).
	 */
	send(message: AgentMessage): void {
		this.messageHistory.push(message)
		if (this.messageHistory.length > this.maxHistory) {
			this.messageHistory.shift()
		}

		if (message.toAgentId === null) {
			for (const handler of this.broadcastHandlers) {
				handler(message)
			}
		} else {
			const handlers = this.handlers.get(message.toAgentId)
			if (handlers && handlers.size > 0) {
				for (const handler of handlers) {
					handler(message)
				}
			} else {
				// Queue for offline agent
				if (!this.messageQueue.has(message.toAgentId)) {
					this.messageQueue.set(message.toAgentId, [])
				}
				this.messageQueue.get(message.toAgentId)!.push(message)
			}
		}
	}

	/**
	 * Create a message with auto-generated ID and timestamp.
	 */
	createMessage(
		companyId: string,
		fromAgentId: string,
		toAgentId: string | null,
		type: MessageType,
		content: string,
	): AgentMessage {
		return {
			id: `msg_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
			companyId,
			fromAgentId,
			toAgentId,
			type,
			content,
			timestamp: new Date(),
		}
	}

	/**
	 * Get recent message history.
	 */
	getHistory(limit = 50): AgentMessage[] {
		return this.messageHistory.slice(-limit)
	}

	/**
	 * Get messages for a specific agent (both direct and broadcasts).
	 */
	getMessagesForAgent(agentId: string, limit = 50): AgentMessage[] {
		return this.messageHistory
			.filter((m) => m.toAgentId === agentId || m.toAgentId === null)
			.slice(-limit)
	}

	/**
	 * Clear all state.
	 */
	clear(): void {
		this.handlers.clear()
		this.broadcastHandlers.clear()
		this.messageQueue.clear()
		this.messageHistory = []
	}
}
