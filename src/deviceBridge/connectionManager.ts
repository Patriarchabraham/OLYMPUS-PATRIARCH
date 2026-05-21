/**
 * Connection manager — routes connections to the appropriate bridge.
 */
import * as androidBridge from './androidBridge.js'
import * as remotePCBridge from './remotePCBridge.js'
import type { DeviceInfo, ConnectionProtocol, DeviceCommandResult } from './types.js'

interface ManagedConnection {
  deviceId: string
  protocol: ConnectionProtocol
  connectedAt: number
}

const managed: Map<string, ManagedConnection> = new Map()

/** Connect to a device using the appropriate protocol. */
export async function connect(deviceId: string, protocol: ConnectionProtocol, config?: Record<string, unknown>): Promise<boolean> {
  try {
    switch (protocol) {
      case 'adb':
        managed.set(deviceId, { deviceId, protocol, connectedAt: Date.now() })
        return true
      case 'ssh':
      case 'winrm': {
        const host = String(config?.host ?? deviceId.replace('remote_', '').split(':')[0])
        const port = Number(config?.port ?? 22)
        const user = String(config?.user ?? 'root')
        await remotePCBridge.connect(host, port, user)
        managed.set(deviceId, { deviceId, protocol, connectedAt: Date.now() })
        return true
      }
      default:
        return false
    }
  } catch { return false }
}

/** Disconnect from a device. */
export function disconnect(deviceId: string): void {
  const conn = managed.get(deviceId)
  if (conn?.protocol === 'ssh' || conn?.protocol === 'winrm') {
    remotePCBridge.disconnect(deviceId)
  }
  managed.delete(deviceId)
}

/** Check if a device is connected. */
export function isConnected(deviceId: string): boolean {
  return managed.has(deviceId)
}

/** Get connection info. */
export function getConnection(deviceId: string): ManagedConnection | null {
  return managed.get(deviceId) ?? null
}

/** Execute a command on a connected device. */
export async function execute(deviceId: string, command: string): Promise<DeviceCommandResult> {
  const conn = managed.get(deviceId)
  if (!conn) return { deviceId, exitCode: -1, stdout: '', stderr: 'Not connected', durationMs: 0, timedOut: false }

  const start = Date.now()
  try {
    let stdout: string
    switch (conn.protocol) {
      case 'adb':
        stdout = await androidBridge.executeCommand(deviceId.replace('adb_', ''), command)
        return { deviceId, exitCode: 0, stdout, stderr: '', durationMs: Date.now() - start, timedOut: false }
      case 'ssh':
      case 'winrm':
        return await remotePCBridge.executeCommand(deviceId, command)
      default:
        return { deviceId, exitCode: -1, stdout: '', stderr: 'Unknown protocol', durationMs: 0, timedOut: false }
    }
  } catch (err: unknown) {
    return { deviceId, exitCode: 1, stdout: '', stderr: String(err), durationMs: Date.now() - start, timedOut: false }
  }
}
