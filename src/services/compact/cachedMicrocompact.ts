// Stub — cachedMicrocompact not included in source snapshot (feature-gated)

export interface CachedMCState {
  registeredTools: Set<string>
  toolOrder: string[]
  deletedRefs: Set<string>
  pinnedEdits: { userMessageIndex: number; block: CacheEditsBlock }[]
}

export interface CacheEditsBlock {
  type: 'cache_edits'
  edits: Array<{ type: string; tool_use_id: string }>
}

export interface PinnedCacheEdits {
  userMessageIndex: number
  block: CacheEditsBlock
}

export function isCachedMicrocompactEnabled(): boolean {
  return false
}

export function isModelSupportedForCacheEditing(_model: string): boolean {
  return false
}

export interface CachedMCConfig {
  enabled: boolean
  triggerThreshold: number
  keepRecent: number
  gapThresholdMinutes: number
}

export function getCachedMCConfig(): CachedMCConfig | null {
  return null
}

export function createCachedMCState(): CachedMCState {
  return {
    registeredTools: new Set(),
    toolOrder: [],
    deletedRefs: new Set(),
    pinnedEdits: [],
  }
}

export function markToolsSentToAPI(_state: CachedMCState): void {}

export function resetCachedMCState(state: CachedMCState): void {
  state.registeredTools.clear()
  state.toolOrder = []
  state.deletedRefs.clear()
}

export function registerToolResult(state: CachedMCState, toolUseId: string): void {
  state.registeredTools.add(toolUseId)
  state.toolOrder.push(toolUseId)
}

export function registerToolMessage(state: CachedMCState, _toolIds: string[]): void {
  void state
}

export function getToolResultsToDelete(_state: CachedMCState): string[] {
  return []
}

export function createCacheEditsBlock(
  _state: CachedMCState,
  _toolsToDelete: string[],
): CacheEditsBlock | null {
  return null
}
