export type SSHSession = {
  proc: any
  createManager: () => any
  getStderrTail: () => string
  proxy: any
}
export async function createSSHSession(_host: string, _opts?: any): Promise<SSHSession> {
  return { proc: null, createManager: () => ({}), getStderrTail: () => '', proxy: null }
}
