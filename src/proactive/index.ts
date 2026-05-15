/**
 * Proactive module — stub for feature-gated lazy import.
 * The real implementation is loaded at runtime when the PROACTIVE or KAIROS
 * feature flag is enabled. This stub satisfies the TypeScript compiler.
 */

export function isProactiveActive(): boolean {
  return false
}

export function isProactivePaused(): boolean {
  return false
}

export function activateProactive(_source: string): void {}

export function deactivateProactive(): void {}
