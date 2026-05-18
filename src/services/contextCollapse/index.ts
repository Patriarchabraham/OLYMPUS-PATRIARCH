// Stub — contextCollapse not included in source snapshot (feature-gated)
import type { Message } from '../../types/message.js'

export interface CollapseResult {
  messages: Message[]
}

export interface OverflowRecoveryResult {
  committed: number
  messages: Message[]
}

export function isContextCollapseEnabled(): boolean {
  return false
}
export function getContextCollapseState() {
  return null
}
export function projectView<T>(messages: T[]): T[] {
  return messages
}
export function getStats() {
  return {
    collapsedSpans: 0,
    collapsedMessages: 0,
    stagedSpans: 0,
    health: {
      totalSpawns: 0,
      totalErrors: 0,
      lastError: null as string | null,
      emptySpawnWarningEmitted: false,
      totalEmptySpawns: 0,
    },
  }
}
export function subscribe(): { unsubscribe: () => void } {
  return { unsubscribe: () => {} }
}
export function resetContextCollapse(): void {}
export function initContextCollapse(): void {}
export function applyCollapsesIfNeeded(
  messages: Message[],
  _toolUseContext?: unknown,
  _querySource?: unknown,
): CollapseResult {
  return { messages }
}
export function isWithheldPromptTooLong(
  _message?: unknown,
  _isPromptTooLong?: unknown,
  _querySource?: unknown,
): boolean {
  return false
}
export function recoverFromOverflow(
  messages: Message[],
  _querySource?: unknown,
): OverflowRecoveryResult {
  return { committed: 0, messages }
}
