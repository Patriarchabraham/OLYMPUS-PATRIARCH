export function startServer(_config: any, _sessionManager: any, _logger: any): { port: number; stop: (graceful: boolean) => void } {
  return { port: 0, stop: () => {} }
}
