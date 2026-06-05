/**
 * Message type definitions for the Olympuz conversation system.
 *
 * These types form a discriminated union based on the `type` field.
 * Each message variant carries specific payload fields. The constructors
 * in `src/utils/messages.ts` and `src/utils/attachments.ts` are the
 * authoritative sources for the exact shape of each variant.
 *
 * See issue #473 for the typecheck-foundation effort.
 */

import type { UUID } from 'crypto'
import type {
  BetaContentBlock,
  BetaMessage,
  BetaToolUseBlock,
} from '@anthropic-ai/sdk/resources/beta/messages/messages.mjs'
import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/messages.mjs'
import type { APIError } from '@anthropic-ai/sdk'
import type { Attachment } from '../utils/attachments.js'
import type { Progress } from '../Tool.js'
import type { PermissionMode } from './permissions.js'

// ─── Supporting types ────────────────────────────────────────────

export type SystemMessageLevel = 'info' | 'warning' | 'error' | 'suggestion'

export type MessageOrigin = 'human' | 'auto' | 'tool' | 'system' | 'hook' | { kind: string; server?: string }

export type PartialCompactDirection = 'forward' | 'backward' | 'from' | 'up_to'

export interface StopHookInfo {
  hookName: string
  command?: string
  promptText?: string
  durationMs?: number
  success?: boolean
}

export interface RequestStartEvent {
  type: 'request_start'
  model: string
}

export interface StreamEvent {
  type: 'message_start' | 'message_delta' | 'message_stop' | 'stream_event' | 'content_block_start' | 'content_block_delta' | 'content_block_stop'
  message?: unknown
  usage?: unknown
  delta?: { stop_reason?: string | null; type?: string; text?: string; partial_json?: string; thinking?: string } & Record<string, unknown>
  content_block?: Record<string, unknown> & { type: string }
  index?: number
  event?: unknown
  ttftMs?: number
}

export interface CompactMetadata {
  trigger: 'manual' | 'auto'
  preTokens: number
  userContext?: string
  messagesSummarized?: number
  preCompactDiscoveredTools?: string[]
  preservedSegment?: {
    headUuid?: string
    tailUuid?: string
    anchorUuid?: string
  }
}

export interface MicrocompactMetadata {
  trigger: 'auto'
  preTokens: number
  tokensSaved: number
  compactedToolIds: string[]
  clearedAttachmentUUIDs: string[]
}

export interface SummarizeMetadata {
  messagesSummarized: number
  userContext?: string
  direction?: PartialCompactDirection
}

// ─── Core message variants (discriminated on `type`) ─────────────

/**
 * Assistant message from the API. Wraps the Anthropic BetaMessage
 * with Olympuz-specific metadata.
 */
export interface AssistantMessage {
  type: 'assistant'
  uuid: UUID
  timestamp: string
  message: BetaMessage & {
    content: BetaContentBlock[]
    context_management: unknown | null
  }
  requestId: string | undefined
  apiError?: unknown
  error?: unknown
  errorDetails?: string
  isApiErrorMessage?: boolean
  isVirtual?: true
  isMeta?: boolean
  advisorModel?: string
}

/**
 * User message sent to the API. Content can be a string or an array
 * of content blocks (text, images, tool_result).
 */
export interface UserMessage {
  type: 'user'
  uuid: UUID
  timestamp: string
  message: {
    role: 'user'
    content: string | ContentBlockParam[]
  }
  isMeta?: true
  isVisibleInTranscriptOnly?: true
  isVirtual?: true
  isCompactSummary?: true
  summarizeMetadata?: SummarizeMetadata
  toolUseResult?: unknown
  mcpMeta?: {
    _meta?: Record<string, unknown>
    structuredContent?: Record<string, unknown>
  }
  imagePasteIds?: number[]
  sourceToolAssistantUUID?: UUID
  permissionMode?: PermissionMode
  origin?: MessageOrigin
}

/**
 * Attachment message carrying file references, hook results, and other
 * non-conversational payloads. HookResultMessage is an alias for this type
 * since session hooks produce attachment messages.
 */
export interface AttachmentMessage<T extends Attachment = Attachment> {
  type: 'attachment'
  uuid: UUID
  timestamp: string
  attachment: T
}

/**
 * HookResultMessage is the same shape as AttachmentMessage — session start
 * hooks produce attachment messages that get pushed into the message stream.
 */
export type HookResultMessage = AttachmentMessage

/**
 * Progress message for streaming tool/hook progress updates.
 */
export interface ProgressMessage<P extends Progress = Progress> {
  type: 'progress'
  uuid: UUID
  timestamp: string
  toolUseID: string
  parentToolUseID: string
  data: P
}

// ─── System message subtypes (discriminated on `subtype`) ────────

/**
 * Base fields shared by all system message variants.
 */
interface SystemMessageBase {
  type: 'system'
  uuid: UUID
  timestamp: string
  isMeta?: boolean
}

export interface SystemInformationalMessage extends SystemMessageBase {
  subtype: 'informational'
  content: string
  level: SystemMessageLevel
  toolUseID?: string
  preventContinuation?: boolean
}

export interface SystemAPIErrorMessage extends SystemMessageBase {
  subtype: 'api_error'
  level: 'error'
  error: APIError
  cause?: Error
  retryInMs: number
  retryAttempt: number
  maxRetries: number
}

export interface SystemCompactBoundaryMessage extends SystemMessageBase {
  subtype: 'compact_boundary'
  content: string
  level: SystemMessageLevel
  compactMetadata: CompactMetadata
  logicalParentUuid?: UUID
}

export interface SystemMicrocompactBoundaryMessage extends SystemMessageBase {
  subtype: 'microcompact_boundary'
  content: string
  level: SystemMessageLevel
  microcompactMetadata: MicrocompactMetadata
}

export interface SystemLocalCommandMessage extends SystemMessageBase {
  subtype: 'local_command'
  content: string
  level: SystemMessageLevel
}

export interface SystemPermissionRetryMessage extends SystemMessageBase {
  subtype: 'permission_retry'
  content: string
  commands: string[]
  level: SystemMessageLevel
}

export interface SystemBridgeStatusMessage extends SystemMessageBase {
  subtype: 'bridge_status'
  content: string
  url: string
  upgradeNudge?: string
}

export interface SystemScheduledTaskFireMessage extends SystemMessageBase {
  subtype: 'scheduled_task_fire'
  content: string
}

export interface SystemStopHookSummaryMessage extends SystemMessageBase {
  subtype: 'stop_hook_summary'
  hookCount: number
  hookInfos: StopHookInfo[]
  hookErrors: string[]
  preventedContinuation: boolean
  stopReason: string | undefined
  hasOutput: boolean
  level: SystemMessageLevel
  toolUseID?: string
  hookLabel?: string
  totalDurationMs?: number
}

export interface SystemTurnDurationMessage extends SystemMessageBase {
  subtype: 'turn_duration'
  durationMs: number
  budgetTokens?: number
  budgetLimit?: number
  budgetNudges?: number
  messageCount?: number
}

export interface SystemAwaySummaryMessage extends SystemMessageBase {
  subtype: 'away_summary'
  content: string
}

export interface SystemMemorySavedMessage extends SystemMessageBase {
  subtype: 'memory_saved'
  writtenPaths: string[]
  teamCount?: number
}

export interface SystemAgentsKilledMessage extends SystemMessageBase {
  subtype: 'agents_killed'
}

export interface SystemApiMetricsMessage extends SystemMessageBase {
  subtype: 'api_metrics'
  ttftMs: number
  otps: number
  isP50?: boolean
  hookDurationMs?: number
  turnDurationMs?: number
  toolDurationMs?: number
  classifierDurationMs?: number
  toolCount?: number
  hookCount?: number
  classifierCount?: number
  configWriteCount?: number
}

export interface SystemThinkingMessage extends SystemMessageBase {
  subtype: 'thinking'
  content: string
  level: SystemMessageLevel
}

export interface SystemFileSnapshotMessage extends SystemMessageBase {
  subtype: 'file_snapshot'
  content: string
  level: SystemMessageLevel
  snapshotFiles: Array<{
    key: string
    path: string
    content: string
  }>
}

/**
 * Union of all system message subtypes.
 */
export type SystemMessage =
  | SystemInformationalMessage
  | SystemAPIErrorMessage
  | SystemCompactBoundaryMessage
  | SystemMicrocompactBoundaryMessage
  | SystemLocalCommandMessage
  | SystemPermissionRetryMessage
  | SystemBridgeStatusMessage
  | SystemScheduledTaskFireMessage
  | SystemStopHookSummaryMessage
  | SystemTurnDurationMessage
  | SystemAwaySummaryMessage
  | SystemMemorySavedMessage
  | SystemAgentsKilledMessage
  | SystemApiMetricsMessage
  | SystemThinkingMessage
  | SystemFileSnapshotMessage

// ─── Control/internal message variants ───────────────────────────

export interface TombstoneMessage {
  type: 'tombstone'
  uuid: UUID
  timestamp: string
  message: UUID
}

export interface ToolUseSummaryMessage {
  type: 'tool_use_summary'
  uuid: UUID
  timestamp: string
  summary: string
  precedingToolUseIds: string[]
}

export interface StreamEventMessage {
  type: 'stream_event'
  uuid: UUID
  event: StreamEvent & { type: string }
  ttftMs?: number
}

interface StreamRequestStartMessage {
  type: 'stream_request_start'
  uuid: UUID
  timestamp: string
}

// ─── Normalized message types ────────────────────────────────────

/**
 * Normalized assistant message: one content block per message
 * (produced by normalizeMessages).
 */
export interface NormalizedAssistantMessage<T extends BetaContentBlock = BetaContentBlock> {
  type: 'assistant'
  uuid: UUID
  timestamp: string
  message: BetaMessage & {
    content: [T]
    context_management: unknown | null
  }
  requestId: string | undefined
  error?: unknown
  isApiErrorMessage?: boolean
  isMeta?: boolean
  isVirtual?: true
  advisorModel?: string
}

/**
 * Normalized user message: content is always an array of content blocks
 * (strings are converted to single-element arrays by normalizeMessages).
 */
export interface NormalizedUserMessage {
  type: 'user'
  uuid: UUID
  timestamp: string
  message: {
    role: 'user'
    content: ContentBlockParam[]
  }
  isMeta?: true
  isVisibleInTranscriptOnly?: true
  isVirtual?: true
  isCompactSummary?: true
  summarizeMetadata?: SummarizeMetadata
  toolUseResult?: unknown
  mcpMeta?: {
    _meta?: Record<string, unknown>
    structuredContent?: Record<string, unknown>
  }
  imagePasteIds?: number[]
  sourceToolAssistantUUID?: UUID
  permissionMode?: PermissionMode
  origin?: MessageOrigin
}

/**
 * Union of all normalized message types (output of normalizeMessages).
 */
export type NormalizedMessage =
  | NormalizedAssistantMessage
  | NormalizedUserMessage
  | AttachmentMessage
  | ProgressMessage
  | SystemMessage

// ─── Renderable message (UI-facing) ──────────────────────────────

/**
 * Messages that can be rendered in the UI. Excludes control-only types
 * like tombstone, stream_event, and stream_request_start.
 */
export type RenderableMessage =
  | NormalizedAssistantMessage
  | NormalizedUserMessage
  | AttachmentMessage
  | ProgressMessage
  | SystemMessage
  | ToolUseSummaryMessage
  | GroupedToolUseMessage
  | CollapsedReadSearchGroup

// ─── Collapsed UI group types ────────────────────────────────────

export interface CollapsedReadSearchGroup {
  type: 'collapsed_read_search'
  messages: CollapsibleMessage[]
  searchCount: number
  readCount: number
  listCount: number
  replCount: number
  memorySearchCount: number
  memoryReadCount: number
  memoryWriteCount: number
  readFilePaths: string[]
  searchArgs: string[]
  latestDisplayHint: string | undefined
  displayMessage: CollapsibleMessage
  uuid: UUID
  timestamp: string
  teamMemorySearchCount?: number
  teamMemoryReadCount?: number
  teamMemoryWriteCount?: number
  mcpCallCount?: number
  mcpServerNames?: string[]
  bashCount?: number
  gitOpBashCount?: number
  commits?: Array<{ sha: string; kind: import('../tools/shared/gitOperationTracking.js').CommitKind }>
  pushes?: Array<{ branch: string }>
  branches?: Array<{ ref: string; action: import('../tools/shared/gitOperationTracking.js').BranchAction }>
  prs?: Array<{ number: number; url?: string; action: import('../tools/shared/gitOperationTracking.js').PrAction }>
  hookTotalMs?: number
  hookCount?: number
  hookInfos?: StopHookInfo[]
  relevantMemories?: Array<{ path: string; content: string; mtimeMs: number }>
}

export interface GroupedToolUseMessage {
  type: 'grouped_tool_use'
  messages: NormalizedAssistantMessage<BetaToolUseBlock>[]
  toolName: string
  results: unknown[]
  displayMessage: NormalizedAssistantMessage<BetaToolUseBlock>
  uuid: UUID
  timestamp: string
  messageId: string
}

// ─── Master discriminated union ──────────────────────────────────

/**
 * The full Message union used throughout the conversation pipeline.
 * Every variant is discriminated on the `type` field.
 */
export type Message =
  | AssistantMessage
  | UserMessage
  | AttachmentMessage
  | ProgressMessage
  | SystemMessage
  | TombstoneMessage
  | ToolUseSummaryMessage
  | StreamEventMessage
  | StreamRequestStartMessage

/**
 * A message that can be collapsed in the UI for compact display.
 */
export type CollapsibleMessage =
  | NormalizedAssistantMessage
  | NormalizedUserMessage
  | SystemMessage
  | GroupedToolUseMessage
