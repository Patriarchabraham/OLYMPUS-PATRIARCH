// Stub — snipCompact not included in source snapshot
import type { Message } from '../../types/message.js'

export interface SnipCompactResult {
  messages: Message[]
  tokensFreed: number
  boundaryMessage: Message | null
}

export function snipCompact(): null {
  return null
}

export function snipCompactIfNeeded(messages: Message[]): SnipCompactResult {
  return { messages, tokensFreed: 0, boundaryMessage: null }
}

export function isSnipRuntimeEnabled(): boolean {
  return false
}

export const SNIP_NUDGE_TEXT = ''

export function shouldNudgeForSnips(_messages: Message[]): boolean {
  return false
}
