/**
 * Device state collector — collects current state from devices.
 */
import { getDeviceRegistry } from './deviceRegistry.js'
import { execute } from './deviceCommandExecutor.js'
import type { DeviceCommand } from './types.js'

/** Collect state from a single device. */
export async function collectState(deviceId: string): Promise<Record<string, unknown>> {
  const registry = getDeviceRegistry()
  const device = registry.getDevice(deviceId)
  if (!device) return { error: 'Device not found' }

  if (device.type === 'local-pc') {
    return collectLocalState()
  }

  // For remote/android devices, collect basic state
  const state: Record<string, unknown> = {
    id: device.id,
    name: device.name,
    type: device.type,
    lastSeen: device.lastSeen,
  }

  if (device.connectionStatus === 'connected') {
    try {
      const result = await execute({
        deviceId,
        command: device.type === 'android' ? 'echo ok' : 'echo ok',
        args: [],
        timeout: 5000,
        captureOutput: true,
      })
      state.reachable = result.exitCode === 0
    } catch {
      state.reachable = false
    }
  }

  return state
}

/** Collect state from all registered devices. */
export async function collectFromAll(): Promise<Map<string, Record<string, unknown>>> {
  const registry = getDeviceRegistry()
  const results = new Map<string, Record<string, unknown>>()

  const entries = await Promise.allSettled(
    registry.getAllDevices().map(async (d) => {
      const state = await collectState(d.id)
      return { id: d.id, state } as const
    })
  )

  for (const r of entries) {
    if (r.status === 'fulfilled') {
      results.set(r.value.id, r.value.state)
    }
  }

  return results
}

async function collectLocalState(): Promise<Record<string, unknown>> {
  const os = require('os')
  return {
    hostname: os.hostname(),
    platform: os.platform(),
    arch: os.arch(),
    uptime: os.uptime(),
    totalMemory: os.totalmem(),
    freeMemory: os.freemem(),
    cpuCount: os.cpus().length,
    loadAvg: os.loadavg?.() ?? [0, 0, 0],
    timestamp: Date.now(),
  }
}
