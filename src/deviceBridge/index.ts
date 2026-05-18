/**
 * DeviceBridge — Universal Device Discovery and Control.
 * Public API and singleton manager.
 */
import { scanAll } from './deviceScanner.js'
import { getDeviceRegistry } from './deviceRegistry.js'
import { getLocalDeviceSnapshot, invalidateLocalDeviceSnapshot } from './localDevice.js'
import * as connectionManager from './connectionManager.js'
import * as commandExecutor from './deviceCommandExecutor.js'
import { collectState, collectFromAll } from './deviceStateCollector.js'
import type { DeviceInfo, LocalDeviceSnapshot, ScanOptions, DeviceCommand, DeviceCommandResult } from './types.js'

export type { DeviceInfo, LocalDeviceSnapshot, ScanOptions, DeviceCommand, DeviceCommandResult } from './types.js'

/** Central manager for device discovery, connection, and control. */
export class DeviceBridgeManager {
  private initialized = false

  /** Initialize the device bridge system. */
  async init(): Promise<void> {
    if (this.initialized) return
    this.initialized = true
  }

  /** Scan for devices on the network and USB. */
  async scan(options?: Partial<ScanOptions>): Promise<DeviceInfo[]> {
    const devices = await scanAll(options)
    const registry = getDeviceRegistry()
    for (const d of devices) registry.registerDevice(d)
    return devices
  }

  /** List all known devices. */
  listDevices(): DeviceInfo[] {
    return getDeviceRegistry().getAllDevices()
  }

  /** Get a snapshot of the local machine. */
  async getLocalSnapshot(): Promise<LocalDeviceSnapshot> {
    return getLocalDeviceSnapshot()
  }

  /** Execute a command on a device. */
  async execute(deviceId: string, command: string, args: string[] = [], timeout = 30000): Promise<DeviceCommandResult> {
    return commandExecutor.execute({
      deviceId, command, args, timeout, captureOutput: true,
    })
  }

  /** Get info about a specific device. */
  getDeviceInfo(deviceId: string): DeviceInfo | null {
    return getDeviceRegistry().getDevice(deviceId)
  }

  /** Connect to a remote device. */
  async connect(deviceId: string, protocol: DeviceInfo['connectionProtocol'] & string, config?: Record<string, unknown>): Promise<boolean> {
    return connectionManager.connect(deviceId, protocol as never, config)
  }

  /** Disconnect from a device. */
  disconnect(deviceId: string): void {
    connectionManager.disconnect(deviceId)
  }

  /** Collect state from all devices. */
  async collectAllStates(): Promise<Map<string, Record<string, unknown>>> {
    return collectFromAll()
  }

  /** Refresh the local device snapshot. */
  refreshLocalSnapshot(): void {
    invalidateLocalDeviceSnapshot()
  }
}

let _manager: DeviceBridgeManager | null = null

/** Get the singleton DeviceBridgeManager. */
export function getDeviceBridgeManager(): DeviceBridgeManager {
  if (!_manager) _manager = new DeviceBridgeManager()
  return _manager
}
