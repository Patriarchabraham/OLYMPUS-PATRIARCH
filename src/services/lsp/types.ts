export interface LspServerConfig {
  command: string
  args?: string[]
  cwd?: string
  env?: Record<string, string>
  fileExtensions?: string[]
  restartOnCrash?: boolean
  shutdownTimeout?: number
  maxRestarts?: number
  workspaceFolder?: string
  initializationOptions?: Record<string, unknown>
  startupTimeout?: number
}
export interface ScopedLspServerConfig extends LspServerConfig {
  name: string
  scope: string
}
export type LspServerState = 'starting' | 'running' | 'stopped' | 'stopping' | 'error'
