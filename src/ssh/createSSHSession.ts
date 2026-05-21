export type SSHSession = {
  proc: any
  remoteCwd: string
  createManager: (opts?: any) => any
  getStderrTail: () => string
  proxy: any
}
export class SSHSessionError extends Error {
  constructor(message: string) { super(message); this.name = 'SSHSessionError' }
}
export async function createSSHSession(_opts: Record<string, unknown>, _progressOpts?: Record<string, unknown>): Promise<SSHSession> {
  return { proc: null, remoteCwd: '', createManager: (_opts?: any) => ({}), getStderrTail: () => '', proxy: null }
}
export function createLocalSSHSession(_opts: Record<string, unknown>): SSHSession {
  return { proc: null, remoteCwd: '', createManager: (_opts?: any) => ({}), getStderrTail: () => '', proxy: null }
}
