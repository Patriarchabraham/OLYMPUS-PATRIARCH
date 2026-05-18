export function getDefaultUdsSocketPath(): string { return '' }
export function getUdsMessagingSocketPath(): string | undefined { return undefined }
export async function startUdsMessaging(_socketPath: string, _opts?: { isExplicit?: boolean }): Promise<void> {}
export function setOnEnqueue(_callback: () => void): void {}
