/**
 * Olympuz Departments — published-action log.
 *
 * The Marketing "see everything published, then reverse what's wrong" audit
 * trail. Every published/sent/posted action is appended here as the user-facing
 * record; `/marketing review` reads it and `/marketing reverse <id>` flags an
 * entry after the channel adapter has performed the actual reversal.
 *
 * Append-only JSONL under `<CLAUDE_CONFIG_DIR>/marketing/published.jsonl`. The
 * durable cross-campaign knowledge-graph copy is the marketing curator's job
 * (mirrors Studio's separation: the curator is the only module that touches the
 * KG). This module is intentionally file-only and synchronous so the tool path
 * can record-then-return without awaiting persistence.
 */

import { randomUUID } from 'node:crypto'
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

export type PublishStatus = 'published' | 'reversed'

export interface PublishedEntry {
	id: string
	/** Channel: 'x' | 'meta' | 'linkedin' | 'tiktok' | 'youtube' | 'email' | 'profile' | ... */
	channel: string
	/** Action: 'post' | 'short' | 'email' | 'profile' | ... */
	action: string
	/** Handle / recipient / URL the action targeted. */
	target?: string
	/** The published content (storage-truncated). */
	content: string
	timestamp: number
	status: PublishStatus
	/** Whether the channel adapter can reverse this (delete/unlist/recall). */
	reversible: boolean
	/** How to reverse, for the human reviewer. */
	reversalHint?: string
}

/** Where the published log lives. Overrideable via CLAUDE_CONFIG_DIR (tests). */
export function publishedLogPath(): string {
	const base = process.env.CLAUDE_CONFIG_DIR ?? process.env.HOME ?? process.env.USERPROFILE ?? '.'
	return join(base, 'marketing', 'published.jsonl')
}

/** Append a published action to the log + return the full entry. */
export function recordPublish(
	entry: Omit<PublishedEntry, 'id' | 'timestamp' | 'status'> & { id?: string; timestamp?: number },
): PublishedEntry {
	const full: PublishedEntry = {
		id: entry.id ?? randomUUID(),
		timestamp: entry.timestamp ?? Date.now(),
		status: 'published',
		channel: entry.channel,
		action: entry.action,
		target: entry.target,
		content: entry.content,
		reversible: entry.reversible,
		reversalHint: entry.reversalHint,
	}
	const path = publishedLogPath()
	try {
		mkdirSync(dirname(path), { recursive: true })
		appendFileSync(path, `${JSON.stringify(full)}\n`, 'utf8')
	} catch {
		// best-effort file persistence; failure is non-fatal (the action already ran)
	}
	return full
}

/** Read all published entries (newest first), optionally filtered. */
export function listPublishes(filter?: {
	channel?: string
	status?: PublishStatus
}): PublishedEntry[] {
	const path = publishedLogPath()
	if (!existsSync(path)) return []
	let lines: string[] = []
	try {
		lines = readFileSync(path, 'utf8')
			.split('\n')
			.filter((l) => l.trim().length > 0)
	} catch {
		return []
	}
	const entries: PublishedEntry[] = []
	for (const line of lines) {
		try {
			entries.push(JSON.parse(line) as PublishedEntry)
		} catch {
			// skip corrupt line
		}
	}
	return entries
		.filter((e) => !filter?.channel || e.channel === filter.channel)
		.filter((e) => !filter?.status || e.status === filter.status)
		.reverse()
}

/** Look up a single entry by id. */
export function getPublish(id: string): PublishedEntry | undefined {
	return listPublishes().find((e) => e.id === id)
}

/**
 * Flag an entry as reversed in the log. The ACTUAL reversal (delete post /
 * recall email) must be performed by the channel adapter BEFORE calling this.
 * Returns the updated entry, or undefined if the id is unknown.
 */
export function markReversed(id: string): PublishedEntry | undefined {
	const chronological = listPublishes().reverse() // undo the newest-first reverse
	const idx = chronological.findIndex((e) => e.id === id)
	if (idx < 0) return undefined
	chronological[idx] = { ...chronological[idx]!, status: 'reversed' }
	const path = publishedLogPath()
	try {
		mkdirSync(dirname(path), { recursive: true })
		writeFileSync(path, `${chronological.map((e) => JSON.stringify(e)).join('\n')}\n`, 'utf8')
	} catch {
		// best-effort
	}
	return chronological[idx]
}
