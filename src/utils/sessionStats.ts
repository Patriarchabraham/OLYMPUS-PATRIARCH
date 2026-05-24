/**
 * Session statistics tracker — tracks per-session metrics like token usage,
 * query count, duration, confidence scores, and evolution stats.
 * Displayed subtly after each interaction to give users visibility into
 * system performance without distracting from the main output.
 *
 * @module sessionStats
 */

export interface SessionStats {
	/** Number of user queries in this session */
	readonly queryCount: number
	/** Total input tokens consumed across all providers */
	readonly totalInputTokens: number
	/** Total output tokens generated across all providers */
	readonly totalOutputTokens: number
	/** Wall-clock time since session start (ms) */
	readonly sessionDurationMs: number
	/** Last query processing time (ms) */
	readonly lastQueryDurationMs: number
	/** Last confidence score from reasoning engine (0-1) */
	readonly lastConfidence: number
	/** Reasoning strategy used for last query */
	readonly lastStrategy: string
	/** Provider name used for last query */
	readonly lastProvider: string
	/** Model name used for last query */
	readonly lastModel: string
	/** Number of patterns learned by evolution engine */
	readonly patternsLearned: number
	/** Number of prompts evolved */
	readonly promptsEvolved: number
	/** Number of tools invoked in this session */
	readonly toolsInvoked: number
}

/** Mutable session stats state — updated after each interaction */
export class SessionStatsTracker {
	private queryCount = 0
	private totalInputTokens = 0
	private totalOutputTokens = 0
	private readonly startTime = Date.now()
	private lastQueryStart = 0
	private lastQueryDurationMs = 0
	private lastConfidence = 0
	private lastStrategy = "none"
	private lastProvider = "unknown"
	private lastModel = "unknown"
	private patternsLearned = 0
	private promptsEvolved = 0
	private toolsInvoked = 0

	/** Record the start of a new query */
	startQuery(): void {
		this.queryCount++
		this.lastQueryStart = Date.now()
	}

	/** Record query completion with results */
	endQuery(params: {
		inputTokens?: number
		outputTokens?: number
		confidence?: number
		strategy?: string
		provider?: string
		model?: string
	}): void {
		this.lastQueryDurationMs = this.lastQueryStart > 0
			? Date.now() - this.lastQueryStart
			: 0
		if (params.inputTokens) this.totalInputTokens += params.inputTokens
		if (params.outputTokens) this.totalOutputTokens += params.outputTokens
		if (params.confidence !== undefined) this.lastConfidence = params.confidence
		if (params.strategy) this.lastStrategy = params.strategy
		if (params.provider) this.lastProvider = params.provider
		if (params.model) this.lastModel = params.model
	}

	/** Record a tool invocation */
	recordToolUse(): void {
		this.toolsInvoked++
	}

	/** Update evolution stats from external source */
	updateEvolutionStats(patterns: number, evolved: number): void {
		this.patternsLearned = patterns
		this.promptsEvolved = evolved
	}

	/** Get current session stats snapshot */
	getStats(): SessionStats {
		return {
			queryCount: this.queryCount,
			totalInputTokens: this.totalInputTokens,
			totalOutputTokens: this.totalOutputTokens,
			sessionDurationMs: Date.now() - this.startTime,
			lastQueryDurationMs: this.lastQueryDurationMs,
			lastConfidence: this.lastConfidence,
			lastStrategy: this.lastStrategy,
			lastProvider: this.lastProvider,
			lastModel: this.lastModel,
			patternsLearned: this.patternsLearned,
			promptsEvolved: this.promptsEvolved,
			toolsInvoked: this.toolsInvoked,
		}
	}

	/** Format a subtle one-line session summary for display after each query */
	formatBriefStats(): string {
		const stats = this.getStats()
		const duration = formatDuration(stats.lastQueryDurationMs)
		const totalTokens = stats.totalInputTokens + stats.totalOutputTokens
		const confidence = stats.lastConfidence > 0
			? ` conf=${(stats.lastConfidence * 100).toFixed(0)}%`
			: ""
		return `${duration} · ${formatTokenCount(totalTokens)} tokens · ${stats.lastStrategy}${confidence}`
	}

	/** Format a detailed session status report for /status */
	formatDetailedReport(): string {
		const stats = this.getStats()
		const lines = [
			`Provider: ${stats.lastProvider}`,
			`Model: ${stats.lastModel}`,
			`Strategy: ${stats.lastStrategy}`,
			`Queries: ${stats.queryCount}`,
			`Tokens: ${formatTokenCount(stats.totalInputTokens)} in / ${formatTokenCount(stats.totalOutputTokens)} out`,
			`Session: ${formatDuration(stats.sessionDurationMs)}`,
			`Tools used: ${stats.toolsInvoked}`,
			`Patterns learned: ${stats.patternsLearned}`,
			`Prompts evolved: ${stats.promptsEvolved}`,
		]
		if (stats.lastConfidence > 0) {
			lines.push(`Last confidence: ${(stats.lastConfidence * 100).toFixed(1)}%`)
		}
		return lines.join("\n")
	}
}

/** Format milliseconds into human-readable duration */
function formatDuration(ms: number): string {
	if (ms < 1000) return `${ms}ms`
	const seconds = Math.floor(ms / 1000)
	if (seconds < 60) return `${seconds}s`
	const minutes = Math.floor(seconds / 60)
	const remainingSeconds = seconds % 60
	return `${minutes}m${remainingSeconds}s`
}

/** Format token count with K/M suffix */
function formatTokenCount(count: number): string {
	if (count < 1000) return String(count)
	if (count < 1_000_000) return `${(count / 1000).toFixed(1)}K`
	return `${(count / 1_000_000).toFixed(1)}M`
}
