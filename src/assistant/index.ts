// Stub — assistant mode is feature-gated (KAIROS)
// These exports exist to satisfy TypeScript; the real module is loaded dynamically when the feature is enabled.

export function isAssistantMode(): boolean {
  return false
}

export function markAssistantForced(): void {}

export function isAssistantForced(): boolean {
  return false
}

export async function initializeAssistantTeam(): Promise<null> {
  return null
}

export function getAssistantSystemPromptAddendum(): string {
  return ''
}

export function getAssistantActivationPath(): string | undefined {
  return undefined
}
