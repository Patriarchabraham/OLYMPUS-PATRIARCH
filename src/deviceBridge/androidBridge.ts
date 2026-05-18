/**
 * Android device control via ADB.
 */
import { execFile } from 'child_process'
import { promisify } from 'util'
import type { DeviceInfo, DeviceCommandResult, AndroidAppInfo } from './types.js'

const execFileAsync = promisify(execFile)

function adbArgs(deviceId: string, ...rest: string[]): string[] {
  return ['-s', deviceId, ...rest]
}

/** Discover connected Android devices. */
export async function discoverDevices(): Promise<DeviceInfo[]> {
  try {
    const { stdout } = await execFileAsync('adb', ['devices'], { timeout: 10000 })
    const devices: DeviceInfo[] = []
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
    return devices
  } catch { return [] }
}

/** Execute a shell command on the device. */
export async function executeCommand(deviceId: string, cmd: string): Promise<string> {
  const { stdout } = await execFileAsync('adb', adbArgs(deviceId, 'shell', cmd), { timeout: 30000, maxBuffer: 10 * 1024 * 1024 })
  return stdout
}

/** Take a screenshot from the device. */
export async function takeScreenshot(deviceId: string): Promise<Buffer> {
  const { stdout } = await execFileAsync('adb', adbArgs(deviceId, 'shell', 'screencap', '-p'), { timeout: 15000, encoding: 'buffer' })
  return stdout
}

/** List installed third-party apps. */
export async function listApps(deviceId: string): Promise<AndroidAppInfo[]> {
  const stdout = await executeCommand(deviceId, 'pm list packages -3')
  return stdout.split('\n').filter(l => l.startsWith('package:')).map(l => ({
    packageName: l.replace('package:', '').trim(),
    appName: l.replace('package:', '').trim(),
    version: '',
    isSystem: false,
  }))
}

/** Push a file to the device. */
export async function pushFile(deviceId: string, local: string, remote: string): Promise<void> {
  await execFileAsync('adb', adbArgs(deviceId, 'push', local, remote), { timeout: 60000 })
}

/** Pull a file from the device. */
export async function pullFile(deviceId: string, remote: string, local: string): Promise<void> {
  await execFileAsync('adb', adbArgs(deviceId, 'pull', remote, local), { timeout: 60000 })
}

/** Get detailed device info via getprop. */
export async function getDeviceInfo(deviceId: string): Promise<DeviceInfo> {
  try {
    const [model, version, sdk, manufacturer] = await Promise.all([
      executeCommand(deviceId, 'getprop ro.product.model'),
      executeCommand(deviceId, 'getprop ro.build.version.release'),
      executeCommand(deviceId, 'getprop ro.build.version.sdk'),
      executeCommand(deviceId, 'getprop ro.product.manufacturer'),
    ])
    return {
      id: `adb_${deviceId}`,
      name: `${manufacturer.trim()} ${model.trim()}`,
      type: 'android',
      platform: 'android',
      osVersion: `Android ${version.trim()} (SDK ${sdk.trim()})`,
      connectionStatus: 'connected',
      connectionProtocol: 'usb',
      capabilities: ['screen-capture', 'shell-execute', 'file-access', 'app-control', 'screenshot', 'install-app'],
      lastSeen: Date.now(),
      metadata: { adbId: deviceId, model: model.trim(), sdk: sdk.trim() },
    }
  } catch {
    return {
      id: `adb_${deviceId}`, name: `Android ${deviceId}`, type: 'android',
      platform: 'android', osVersion: '', connectionStatus: 'error',
      capabilities: [], lastSeen: Date.now(), metadata: { adbId: deviceId },
    }
  }
}
