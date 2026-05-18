/**
 * Device discovery — network, USB, and Bluetooth scanning.
 */
import { execFile } from 'child_process'
import { promisify } from 'util'
import type { DeviceInfo, ScanOptions } from './types.js'

const execFileAsync = promisify(execFile)

/** Scan local network via arp table. */
export async function scanNetwork(): Promise<DeviceInfo[]> {
  const devices: DeviceInfo[] = []
  try {
    const { stdout } = await execFileAsync('arp', ['-a'], { timeout: 10000 })
    for (const line of stdout.split('\n')) {
      const match = line.match(/(\S+)\s+\(([0-9.]+)\)\s+at\s+([0-9a-fA-F:]+)/)
      if (match) {
        devices.push({
          id: `net_${match[2]}`,
          name: match[1],
          type: 'remote-pc',
          platform: 'unknown',
          osVersion: '',
          ipAddress: match[2],
          macAddress: match[3],
          connectionStatus: 'disconnected',
          capabilities: ['shell-execute', 'file-access'],
          lastSeen: Date.now(),
          metadata: { source: 'arp' },
        })
      }
    }
  } catch { /* arp not available or failed */ }
  return devices
}

/** Scan for USB-connected Android devices via ADB. */
export async function scanUSB(): Promise<DeviceInfo[]> {
  const devices: DeviceInfo[] = []
  try {
    const { stdout } = await execFileAsync('adb', ['devices'], { timeout: 10000 })
    for (const line of stdout.split('\n')) {
      const match = line.match(/^(\S+)\s+(device|offline|unauthorized)/)
      if (match) {
        devices.push({
          id: `adb_${match[1]}`,
          name: `Android ${match[1]}`,
          type: 'android',
          platform: 'android',
          osVersion: '',
          connectionStatus: match[2] === 'device' ? 'connected' : 'disconnected',
          connectionProtocol: 'usb',
          capabilities: ['screen-capture', 'shell-execute', 'file-access', 'app-control', 'screenshot', 'install-app'],
          lastSeen: Date.now(),
          metadata: { adbId: match[1] },
        })
      }
    }
  } catch { /* adb not found */ }
  return devices
}

/** Run all device scans with the given options. */
export async function scanAll(options?: Partial<ScanOptions>): Promise<DeviceInfo[]> {
  const opts: ScanOptions = {
    scanNetwork: options?.scanNetwork ?? true,
    scanUSB: options?.scanUSB ?? true,
    scanBluetooth: options?.scanBluetooth ?? false,
    networkTimeout: options?.networkTimeout ?? 10000,
  }

  const scans: Promise<DeviceInfo[]>[] = []
  if (opts.scanNetwork) scans.push(scanNetwork())
  if (opts.scanUSB) scans.push(scanUSB())

  const results = await Promise.allSettled(scans)
  const devices: DeviceInfo[] = []
  for (const r of results) {
    if (r.status === 'fulfilled') devices.push(...r.value)
  }
  return devices
}
