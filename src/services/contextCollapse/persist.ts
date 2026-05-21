// Stub — contextCollapse persist not included in source snapshot (feature-gated)
export function loadCollapsedSpans(): any[] {
  return []
}
export function saveCollapsedSpans(): void {}
export function clearPersistedSpans(): void {}
export function restoreFromEntries(_entries: any[]): any {
  return { messages: [] }
}
