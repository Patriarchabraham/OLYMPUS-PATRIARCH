import type { StdoutMessage } from 'src/entrypoints/sdk/controlTypes.js'

/**
 * Transport interface for bidirectional streaming connections.
 * Implemented by SSETransport and WebSocketTransport.
 */

export interface Transport {
  connect(): Promise<void>
  close(): void
  setOnData(callback: (data: string) => void): void
  setOnClose(callback: (closeCode?: number) => void): void
  write(message: StdoutMessage): Promise<void>
}
