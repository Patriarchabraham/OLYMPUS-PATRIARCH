/**
 * Quantum Loop Store — process-memory carry-forward for quantum reasoning.
 *
 * The quantum pipeline (`QuantumEngine`) historically ran as a fire-and-forget
 * *turn-end* advisory: it analyzed the turn, and on low confidence warned the
 * user. On high confidence it was silent — meaning every successful multi-
 * dimensional analysis was computed and then **thrown away**, never feeding the
 * next turn. That breaks the reasoning loop: insights don't accumulate.
 *
 * This module closes that loop. After each non-degraded quantum analysis we
 * record a compact summary (the driving query, the dominant approach, the
 * dimensions covered, and the confidence). The next turn can ask for the
 * accumulated context via `getLoopContext()` and weave it into its system
 * message, so the agent carries forward *what was just analyzed* instead of
 * re-deriving it blind.
 *
 * Scope is deliberately tight:
 *  - Process-memory only (no disk) — matches `QuantumEngine.analysisHistory`.
 *    A long-running REPL session is the use case; a fresh process starts empty.
 *  - Capped window (5 entries) with a 15-minute TTL — old analyses age out so
 *    stale context doesn't pin the agent to an obsolete frame.
 *  - Compact strings — we store snippets, not full solutions, to keep the
 *    carried context cheap to inject and cheap to read in the transcript.
 */

import type { QuantumAnalysis, QuantumDimension } from './types.js'

/** Max entries retained in the carry-forward window. */
const MAX_LOOP_ENTRIES = 5

/** Entries older than this (ms) are pruned on read/write. */
const LOOP_TTL_MS = 15 * 60 * 1000

/**
 * Confidence below which an analysis is a flagged blind spot (kept in the
 * carry-forward window and re-surfaced on subsequent turns). Aligned with the
 * advisory threshold the turn-end service historically used.
 */
const BLIND_SPOT_CONFIDENCE = 0.6

/** Max length of the stored solution snippet — keep carried context compact. */
const SNIPPET_MAX = 200

export interface LoopEntry {
	/** The driving query that produced this analysis (truncated). */
	query: string
	/** The dominant approach / collapsed solution (truncated snippet). */
	topSolution: string
	/** Dimensions the analysis covered (≤10). */
	dimensionsCovered: QuantumDimension[]
	/** Overall collapse confidence, 0–1. */
	confidence: number
	/** True when the collapse was low-confidence (a flagged blind spot). */
	lowConfidence: boolean
	/** When the analysis was recorded (epoch ms). */
	timestamp: number
}

/** Process-wide carry-forward history. Best-effort; reset on restart. */
const loopHistory: LoopEntry[] = []

/** Monotonic counter — bumped on every successful record. Lets a caller tell
 * whether the store changed since its last read (avoids re-injecting identical
 * context every turn). */
let loopVersion = 0

function nowMs(): number {
	return Date.now()
}

function truncate(value: string | undefined | null, max: number): string {
	if (!value) return ''
	const clean = value.trim().replace(/\s+/g, ' ')
	return clean.length > max ? `${clean.slice(0, max)}...` : clean
}

/** Drop entries older than the TTL. */
function pruneStale(): void {
	const cutoff = nowMs() - LOOP_TTL_MS
	while (loopHistory.length > 0 && loopHistory[0]!.timestamp < cutoff) {
		loopHistory.shift()
	}
}

/**
 * Record a quantum analysis into the carry-forward window.
 *
 * Only meaningful analyses are stored: a non-degraded run with at least one
 * reasoning state. When `collapseResult` exists we store the collapsed solution
 * (the measured outcome); otherwise we fall back to the highest-confidence
 * state (the dominant candidate that didn't clear the collapse threshold).
 *
 * Returns `true` when an entry was actually stored, so callers can gate
 * re-injection on "did the store change this turn?".
 */
export function recordCollapse(analysis: QuantumAnalysis): boolean {
	// Degraded / empty analyses carry nothing forward.
	if (analysis.degraded || analysis.states.length === 0) return false

	const collapsed = analysis.collapseResult?.collapsedState
	const top = collapsed ?? [...analysis.states].sort((a, b) => b.confidence - a.confidence)[0]
	if (!top) return false

	const entry: LoopEntry = {
		query: truncate(analysis.query, SNIPPET_MAX),
		topSolution: truncate(top.solution, SNIPPET_MAX),
		dimensionsCovered: analysis.dimensionsCovered.slice(0, 10),
		confidence: analysis.confidence,
		lowConfidence: analysis.confidence < BLIND_SPOT_CONFIDENCE,
		timestamp: nowMs(),
	}

	pruneStale()
	loopHistory.push(entry)
	// Trim to the window, dropping the OLDEST entries.
	if (loopHistory.length > MAX_LOOP_ENTRIES) {
		loopHistory.splice(0, loopHistory.length - MAX_LOOP_ENTRIES)
	}
	loopVersion++
	return true
}

/**
 * Render the full carry-forward window as a compact, agent-facing context
 * string (used by /status and future carry surfaces).
 *
 * Returns the most recent (up to 3) non-expired entries, newest first, each as
 * a single line. Low-confidence entries are tagged so the agent knows to treat
 * them as open questions rather than settled conclusions. Returns `null` when
 * the window is empty so callers can skip injection entirely.
 */
export function getLoopContext(): string | null {
	return renderEntries(recentEntries())
}

/**
 * Render ONLY the open blind spots — low-confidence analyses still pending in
 * the window. This is the conservative carry-forward surface: it speaks on a
 * high-confidence turn only when prior turns left unresolved questions behind,
 * so the agent doesn't silently drop a flagged blind spot after one turn.
 *
 * Returns `null` when there are no open blind spots, so callers can stay silent.
 */
export function getOpenBlindSpotsContext(): string | null {
	const openBlindSpots = recentEntries().filter((e) => e.lowConfidence)
	if (openBlindSpots.length === 0) return null
	return renderEntries(openBlindSpots)
}

/** Up to 3 newest non-expired entries, newest first. */
function recentEntries(): LoopEntry[] {
	pruneStale()
	return loopHistory.slice(-3).reverse()
}

/** Shared renderer for a slice of the window. */
function renderEntries(entries: LoopEntry[]): string | null {
	if (entries.length === 0) return null
	const lines = entries.map((entry) => {
		const confPct = (entry.confidence * 100).toFixed(0)
		const dims = entry.dimensionsCovered.slice(0, 4).join(', ')
		const flag = entry.lowConfidence ? ' [low-confidence — revisit]' : ''
		const dimsPart = dims ? ` · dims: ${dims}` : ''
		return `  • "${entry.query}" → ${entry.topSolution} (conf ${confPct}%${dimsPart})${flag}`
	})
	const noun = entries.length === 1 ? 'analysis' : 'analyses'
	return [
		`[quantum loop] carrying forward ${entries.length} recent ${noun}:`,
		...lines,
		'Weave these dimensions into the next step; revisit anything tagged low-confidence.',
	].join('\n')
}

/** Current carry-forward version. Bumped on every successful `recordCollapse`. */
export function getLoopVersion(): number {
	return loopVersion
}

/** Number of entries currently in the window (after pruning). For /status + tests. */
export function getLoopEntryCount(): number {
	pruneStale()
	return loopHistory.length
}

/** Reset the store. Intended for tests. */
export function clearQuantumLoopStore(): void {
	loopHistory.length = 0
	loopVersion = 0
}
