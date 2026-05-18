/**
 * Remote PC control via SSH (Unix) / WinRM (Windows).
 */
import { execFile } from 'child_process'
import { promisify } from 'util'
import type { DeviceInfo, DeviceCommandResult } from './types.js'

const execFileAsync = promisify(execFile)

interface RemoteConnection {
  deviceId: string
  host: string
  port: number
  user: string
  protocol: 'ssh' | 'winrm'
}

const connections: Map<string, RemoteConnection> = new Map()

/** Connect to a remote PC via SSH. */
export async function connect(host: string, port: number, user: string): Promise<DeviceInfo> {
  const deviceId = `remote_${host}:${port}`
  connections.set(deviceId, { deviceId, host, port, user, protocol: 'ssh' })
  return {
    id: deviceId,
    name: host,
    type: 'remote-pc',
    platform: 'unknown',
    osVersion: '',
    ipAddress: host,
    port,
    connectionStatus: 'connected',
    connectionProtocol: 'ssh',
    capabilities: ['shell-execute', 'file-access', 'process-list', 'system-info'],
    lastSeen: Date.now(),
    metadata: { user },
  }
}

/** Execute a command on a remote PC. */
export async function executeCommand(deviceId: string, command: string): Promise<DeviceCommandResult> {
  const conn = connections.get(deviceId)
  if (!conn) return { deviceId, exitCode: -1, stdout: '', stderr: 'Not connected', durationMs: 0, timedOut: false }

  const start = Date.now()
  try {
    const { stdout, stderr } = await execFileAsync('ssh', [
      '-p', String(conn.port), '-o', 'StrictHostKeyChecking=no',
      '-o', 'ConnectTimeout=10', `${conn.user}@${conn.host}`, command,
    ], { timeout: 30000 })
    return { deviceId, exitCode: 0, stdout, stderr, durationMs: Date.now() - start, timedOut: false }
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; killed?: boolean }
    return {
      deviceId, exitCode: 1,
      stdout: e.stdout ?? '', stderr: e.stderr ?? String(err),
      durationMs: Date.now() - start, timedOut: e.killed ?? false,
    }
  }
}

/** Disconnect from a remote PC. */
export function disconnect(deviceId: string): void {
  connections.delete(deviceId)
}

/** Check if connected. */
export function isConnected(deviceId: string): boolean {
  return connections.has(deviceId)
}
