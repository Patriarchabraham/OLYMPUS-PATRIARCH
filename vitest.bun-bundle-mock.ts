/**
 * Mock for bun:bundle feature flags during testing.
 * All flags default to false. Override per-test with setFeatureFlag().
 */

const flags: Record<string, boolean> = {}

export function feature(name: string): boolean {
  return flags[name] ?? false
}

export function setFeatureFlag(name: string, value: boolean): void {
  flags[name] = value
}

export function resetFeatureFlags(): void {
  for (const key of Object.keys(flags)) {
    delete flags[key]
  }
}
