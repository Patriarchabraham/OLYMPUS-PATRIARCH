/**
 * iOS device control stub — not yet implemented.
 * TODO: Implement via libimobiledevice / dev tools protocol.
 */
import type { DeviceInfo, DeviceCommandResult, AndroidAppInfo } from './types.js'

export async function discoverDevices(): Promise<DeviceInfo[]> { return [] }
export async function executeCommand(_deviceId: string, _cmd: string): Promise<string> {
  throw new Error('iOS device control not yet supported')
}
export async function takeScreenshot(_deviceId: string): Promise<Buffer> {
  throw new Error('iOS device control not yet supported')
}
export async function listApps(_deviceId: string): Promise<AndroidAppInfo[]> { return [] }
export async function pushFile(_deviceId: string, _local: string, _remote: string): Promise<void> {
  throw new Error('iOS device control not yet supported')
}
export async function pullFile(_deviceId: string, _remote: string, _local: string): Promise<void> {
  throw new Error('iOS device control not yet supported')
}
export async function getDeviceInfo(_deviceId: string): Promise<DeviceInfo> {
  throw new Error('iOS device control not yet supported')
}
