/**
 * Device command executor — routes commands to the correct bridge.
 */
import { getDeviceRegistry } from './deviceRegistry.js'
import { execute as connectionExecute } from './connectionManager.js'
import type { DeviceCommand, DeviceCommandResult } from './types.js'

/** Execute a command on a device, routing to the appropriate bridge. */
export async function execute(command: DeviceCommand): Promise<DeviceCommandResult> {
  const registry = getDeviceRegistry()
  const device = registry.getDevice(command.deviceId)

  if (!device) {
    return {
      deviceId: command.deviceId,
      exitCode: -1,
      stdout: '',
      stderr: `Device not found: ${command.deviceId}`,
      durationMs: 0,
      timedOut: false,
    }
  }

  // For local-pc, execute directly via shell
  if (device.type === 'local-pc') {
    return executeLocal(command)
  }

  // For remote devices, use connection manager
  return connectionExecute(command.deviceId, command.command)
}

async function executeLocal(command: DeviceCommand): Promise<DeviceCommandResult> {
  const { execFile } = require('child_process')
  const start = Date.now()
  try {
    const { stdout, stderr } = await new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
      execFile(command.command, command.args, { timeout: command.timeout ?? 30000 }, (err: Error | null, stdout: string, stderr: string) => {
        if (err) reject(err)
        else resolve({ stdout, stderr })
      })
    })
    return { deviceId: command.deviceId, exitCode: 0, stdout, stderr, durationMs: Date.now() - start, timedOut: false }
  } catch (err: unknown) {
    const e = err as { stdout?: string; stderr?: string; killed?: boolean; code?: string }
    return {
      deviceId: command.deviceId,
      exitCode: 1,
      stdout: e.stdout ?? '',
      stderr: e.stderr ?? String(err),
      durationMs: Date.now() - start,
      timedOut: e.killed ?? false,
    }
  }
}
