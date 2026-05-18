/**
 * In-memory device registry — tracks discovered devices and their states.
 */
import type { DeviceInfo, ConnectionStatus } from './types.js'

class DeviceRegistry {
  private devices: Map<string, DeviceInfo> = new Map()

  registerDevice(info: DeviceInfo): void {
    this.devices.set(info.id, { ...info })
  }

  getDevice(id: string): DeviceInfo | null {
    return this.devices.get(id) ?? null
  }

  getAllDevices(): DeviceInfo[] {
    return Array.from(this.devices.values())
  }

  removeDevice(id: string): boolean {
    return this.devices.delete(id)
  }

  updateStatus(id: string, status: ConnectionStatus): void {
    const device = this.devices.get(id)
    if (device) {
      device.connectionStatus = status
      device.lastSeen = Date.now()
    }
  }

  getConnectedDevices(): DeviceInfo[] {
    return this.getAllDevices().filter(d => d.connectionStatus === 'connected' || d.connectionStatus === 'authenticated')
  }

  getDevicesByType(type: DeviceInfo['type']): DeviceInfo[] {
    return this.getAllDevices().filter(d => d.type === type)
  }

  clear(): void {
    this.devices.clear()
  }

  get size(): number {
    return this.devices.size
  }
}

let _registry: DeviceRegistry | null = null

/** Get the singleton device registry. */
export function getDeviceRegistry(): DeviceRegistry {
  if (!_registry) _registry = new DeviceRegistry()
  return _registry
}
