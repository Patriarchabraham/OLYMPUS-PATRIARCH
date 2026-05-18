export type SSHSessionManager = {
  connect: () => Promise<void>
  disconnect: () => Promise<void>
  sendMessage: (msg: string) => Promise<void>
  sendInterrupt: () => Promise<void>
  respondToPermissionRequest: (id: string, response: any) => Promise<void>
}
