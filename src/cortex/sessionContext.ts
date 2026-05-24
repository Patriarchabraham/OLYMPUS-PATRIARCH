/**
 * SessionContext — Temporal reasoning context that carries forward
 * insights, gaps, and topics between reasoning chains within a session.
 *
 * Fills Gap 9: No temporal reasoning or state persistence in Reasoning.
 */

import type { ReasoningChain, ReasoningStep } from '../reasoning/types.js'
import { cosineSimilarity, termFrequencies, tokenize } from '../utils/nlp.js'

// ============================================================
// Types
// ============================================================

/** Session-level context that persists across reasoning chains */
export interface SessionContext {
	/** Unique session identifier */
	sessionId: string
	/** All reasoning chains in this session */
	chains: ReasoningChain[]
	/** Topic -> relevance score based on frequency and recency */
	keyTopics: Map<string, number>
	/** Unresolved gaps from previous chains */
	unresolvedGaps: string[]
	/** Entity -> resolved description (learned during session) */
	learnedEntities: Map<string, string>
	/** Contradictions found across chains */
	contradictionLog: string[]
	/** When this session was created */
	createdAt: number
	/** When this session was last updated */
	lastUpdatedAt: number
}

/** Configuration for session context management */
export interface SessionContextConfig {
	/** Maximum chains to retain in memory (default 50) */
	maxChains: number
	/** Maximum topics to track (default 100) */
	maxTopics: number
	/** Maximum gaps to carry forward (default 20) */
	maxGaps: number
	/** Time decay half-life in ms for topic relevance (default 300000 = 5 min) */
	topicDecayHalfLife: number
	/** Whether to detect contradictions between chains */
	detectContradictions: boolean
}

const DEFAULT_SESSION_CONFIG: SessionContextConfig = {
	maxChains: 50,
	maxTopics: 100,
	maxGaps: 20,
	topicDecayHalfLife: 300_000,
	detectContradictions: true,
}

// ============================================================
// SessionContextManager
// ============================================================

/**
 * Manages session-level reasoning context, enabling temporal
 * carry-forward of insights between reasoning chains.
 */
export class SessionContextManager {
	private sessions = new Map<string, SessionContext>()
	private config: SessionContextConfig

	constructor(config?: Partial<SessionContextConfig>) {
		this.config = { ...DEFAULT_SESSION_CONFIG, ...config }
	}

	/**
	 * Get or create a session context.
	 * @param sessionId - Optional session ID (generates one if not provided)
	 */
	getSession(sessionId?: string): SessionContext {
		const id = sessionId ?? `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
		let ctx = this.sessions.get(id)
		if (!ctx) {
			ctx = {
				sessionId: id,
				chains: [],
				keyTopics: new Map(),
				unresolvedGaps: [],
				learnedEntities: new Map(),
				contradictionLog: [],
				createdAt: Date.now(),
				lastUpdatedAt: Date.now(),
			}
			this.sessions.set(id, ctx)
		}
		return ctx
	}

	/**
	 * Update session context after a reasoning chain completes.
	 * Extracts topics, gaps, and entities from the chain.
	 */
	updateFromChain(chain: ReasoningChain, sessionId?: string): void {
		const ctx = this.getSession(sessionId)

		// Add chain (with capacity limit)
		ctx.chains.push(chain)
		if (ctx.chains.length > this.config.maxChains) {
			ctx.chains = ctx.chains.slice(-this.config.maxChains)
		}

		// Extract and update topics from all steps
		this.updateTopics(ctx, chain.steps)

		// Extract unresolved gaps
		this.extractGaps(ctx, chain)

		// Detect contradictions with previous chains
		if (this.config.detectContradictions && ctx.chains.length > 1) {
			this.detectContradictions(ctx, chain)
		}

		ctx.lastUpdatedAt = Date.now()
	}

	/**
	 * Build a carry-forward context string for the next query.
	 * This string can be injected as additional reasoning context.
	 */
	buildContextString(sessionId?: string): string {
		const ctx = this.getSession(sessionId)
		const parts: string[] = []

		if (ctx.chains.length > 0) {
			parts.push(`[Session: ${ctx.chains.length} previous reasoning chains]`)

			// Key topics
			if (ctx.keyTopics.size > 0) {
				const topTopics = Array.from(ctx.keyTopics.entries())
					.sort(([, a], [, b]) => b - a)
					.slice(0, 15)
					.map(([topic, score]) => `${topic}(${score.toFixed(2)})`)
					.join(', ')
				parts.push(`Key topics: ${topTopics}`)
			}

			// Unresolved gaps
			if (ctx.unresolvedGaps.length > 0) {
				parts.push(
					`Unresolved gaps from prior analysis:\n${ctx.unresolvedGaps.map((g) => `- ${g}`).join('\n')}`,
				)
			}

			// Recent chain summaries
			const recentChains = ctx.chains.slice(-3)
			if (recentChains.length > 0) {
				const summaries = recentChains
					.map(
						(c, i) =>
							`Chain ${ctx.chains.length - recentChains.length + i + 1}: strategy=${c.strategy}, confidence=${c.confidence.toFixed(2)}, steps=${c.steps.length}`,
					)
					.join('\n')
				parts.push(`Recent reasoning:\n${summaries}`)
			}

			// Contradictions
			if (ctx.contradictionLog.length > 0) {
				parts.push(
					`Detected contradictions:\n${ctx.contradictionLog
						.slice(-5)
						.map((c) => `- ${c}`)
						.join('\n')}`,
				)
			}
		}

		return parts.join('\n\n')
	}

	/**
	 * Detect topic drift between consecutive chains.
	 * Returns a value 0-1 where 0 = no drift, 1 = complete topic change.
	 */
	detectDrift(sessionId?: string): number {
		const ctx = this.getSession(sessionId)
		if (ctx.chains.length < 2) return 0

		const prev = ctx.chains[ctx.chains.length - 2]
		const curr = ctx.chains[ctx.chains.length - 1]

		const prevTokens = tokenize(prev.query)
		const currTokens = tokenize(curr.query)

		if (prevTokens.length === 0 || currTokens.length === 0) return 0

		const prevTF = termFrequencies(prevTokens)
		const currTF = termFrequencies(currTokens)

		return 1 - cosineSimilarity(prevTF, currTF)
	}

	/**
	 * Get all active sessions.
	 */
	getActiveSessions(): string[] {
		return Array.from(this.sessions.keys())
	}

	/**
	 * Clear a specific session.
	 */
	clearSession(sessionId: string): void {
		this.sessions.delete(sessionId)
	}

	/**
	 * Clear all sessions.
	 */
	clearAll(): void {
		this.sessions.clear()
	}

	// ─── Private Methods ──────────────────────────────────────────

	/** Update topic relevance scores with time decay */
	private updateTopics(ctx: SessionContext, steps: ReasoningStep[]): void {
		const now = Date.now()
		const decayFactor = Math.log(2) / this.config.topicDecayHalfLife

		// Apply time decay to existing topics
		for (const [topic, score] of Array.from(ctx.keyTopics.entries())) {
			const elapsed = now - ctx.lastUpdatedAt
			ctx.keyTopics.set(topic, score * Math.exp(-decayFactor * elapsed))
		}

		// Extract topics from steps
		for (const step of steps) {
			const tokens = tokenize(step.content)
			for (const token of tokens) {
				if (token.length < 3) continue
				const current = ctx.keyTopics.get(token) ?? 0
				ctx.keyTopics.set(token, current + 0.1)
			}
		}

		// Trim to max topics
		if (ctx.keyTopics.size > this.config.maxTopics) {
			const sorted = Array.from(ctx.keyTopics.entries())
				.sort(([, a], [, b]) => b - a)
				.slice(0, this.config.maxTopics)
			ctx.keyTopics = new Map(sorted)
		}
	}

	/** Extract gaps (uncertainty markers) from reasoning steps */
	private extractGaps(ctx: SessionContext, chain: ReasoningChain): void {
		const gapPatterns =
			/\b(unknown|unclear|gap|missing|however|but|limitation|uncertain|uncaptured|not covered)\b/gi

		for (const step of chain.steps) {
			const matches = step.content.match(gapPatterns)
			if (matches) {
				// Extract the sentence containing the gap
				const sentences = step.content.split(/[.!?]+/)
				for (const sentence of sentences) {
					if (gapPatterns.test(sentence)) {
						const trimmed = sentence.trim()
						if (trimmed.length > 10 && !ctx.unresolvedGaps.includes(trimmed)) {
							ctx.unresolvedGaps.push(trimmed)
						}
					}
				}
			}
		}

		// Trim to max gaps
		if (ctx.unresolvedGaps.length > this.config.maxGaps) {
			ctx.unresolvedGaps = ctx.unresolvedGaps.slice(-this.config.maxGaps)
		}
	}

	/** Detect contradictions between a new chain and previous ones */
	private detectContradictions(ctx: SessionContext, newChain: ReasoningChain): void {
		const negationPairs: [RegExp, RegExp][] = [
			[
				/\b(is|are|was|were|will)\b/,
				/\b(is not|are not|was not|were not|will not|isn't|aren't|wasn't|weren't|won't)\b/,
			],
			[
				/\b(can|should|must|does)\b/,
				/\b(cannot|can't|should not|shouldn't|must not|mustn't|does not|doesn't)\b/,
			],
		]

		const newConclusion = newChain.steps[newChain.steps.length - 1]?.content ?? ''

		for (const prevChain of ctx.chains.slice(0, -1)) {
			const prevConclusion = prevChain.steps[prevChain.steps.length - 1]?.content ?? ''

			for (const [positive, negative] of negationPairs) {
				if (positive.test(newConclusion) && negative.test(prevConclusion)) {
					ctx.contradictionLog.push(
						`Chain ${ctx.chains.length}: "${newConclusion.slice(0, 100)}" contradicts earlier: "${prevConclusion.slice(0, 100)}"`,
					)
					break
				}
				if (negative.test(newConclusion) && positive.test(prevConclusion)) {
					ctx.contradictionLog.push(
						`Chain ${ctx.chains.length}: "${newConclusion.slice(0, 100)}" contradicts earlier: "${prevConclusion.slice(0, 100)}"`,
					)
					break
				}
			}
		}

		// Keep only last 50 contradictions
		if (ctx.contradictionLog.length > 50) {
			ctx.contradictionLog = ctx.contradictionLog.slice(-50)
		}
	}
}

/** Singleton instance */
let instance: SessionContextManager | null = null

/**
 * Get the global session context manager singleton.
 */
export function getSessionContextManager(): SessionContextManager {
	if (!instance) {
		instance = new SessionContextManager()
	}
	return instance
}
