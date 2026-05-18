/**
 * DeviceBridge Module — Universal Device Discovery and Control Types
 * Enables Mythos to discover, read state from, and control any connected device.
 */

export type DeviceType =
  | 'local-pc'
  | 'remote-pc'
  | 'android'
  | 'ios'
  | 'tablet'
  | 'browser'
  | 'iot'

export type ConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'authenticated'
  | 'error'

export type ConnectionProtocol = 'adb' | 'ssh' | 'winrm' | 'websocket' | 'usb' | 'bluetooth' | 'mdns'

export type DeviceCapability =
  | 'screen-capture'
  | 'input-simulation'
  | 'file-access'
  | 'process-list'
  | 'app-control'
  | 'shell-execute'
  | 'notification-read'
  | 'clipboard'
  | 'screenshot'
  | 'install-app'
  | 'system-info'
  | 'network-info'
  | 'sensor-data'
  | 'camera'
  | 'microphone'
  | 'location'
  | 'battery'
  | 'storage'

export interface DeviceInfo {
  id: string
  name: string
  type: DeviceType
  platform: string
  osVersion: string
  ipAddress?: string
  macAddress?: string
  port?: number
  connectionStatus: ConnectionStatus
  connectionProtocol?: ConnectionProtocol
  capabilities: DeviceCapability[]
  lastSeen: number
  batteryLevel?: number
  storageTotal?: number
  storageUsed?: number
  metadata: Record<string, unknown>
}

export interface LocalDeviceSnapshot {
  hostname: string
  platform: string
  osVersion: string
  arch: string
  cpu: CPUInfo
  memory: MemoryInfo
  gpu: GPUInfo[]
  disks: DiskInfo[]
  networkInterfaces: NetworkInfo[]
  runningProcesses: ProcessInfo[]
  installedSoftware: SoftwareInfo[]
  systemServices: ServiceInfo[]
  connectedPeripherals: PeripheralInfo[]
  environmentVariables: Record<string, string>
  openPorts: PortInfo[]
  uptime: number
  timestamp: number
}

export interface CPUInfo {
  model: string
  manufacturer: string
  cores: number
  logicalProcessors: number
  clockSpeedMhz: number
  maxClockSpeedMhz: number
  cacheL1KB: number
  cacheL2KB: number
  cacheL3KB: number
  usagePercent: number
  temperature?: number
}

export interface MemoryInfo {
  totalBytes: number
  availableBytes: number
  usedBytes: number
  swapTotalBytes: number
  swapUsedBytes: number
  usagePercent: number
}

export interface GPUInfo {
  name: string
  driver: string
  driverVersion: string
  vramBytes: number
  usagePercent: number
  temperature?: number
}

export interface DiskInfo {
  name: string
  mountPoint: string
  filesystem: string
  totalBytes: number
  usedBytes: number
  availableBytes: number
  type: 'ssd' | 'hdd' | 'nvme' | 'usb' | 'network' | 'unknown'
}

export interface NetworkInfo {
  name: string
  interfaceIndex: number
  macAddress: string
  ipAddress: string
  subnetMask?: string
  gateway?: string
  dnsServers: string[]
  type: 'wifi' | 'ethernet' | 'bluetooth' | 'vpn' | 'loopback' | 'unknown'
  status: 'up' | 'down'
  speedMbps?: number
}

export interface ProcessInfo {
  pid: number
  name: string
  cpuPercent: number
  memoryBytes: number
  status: string
  startTime?: number
  command?: string
  user?: string
}

export interface SoftwareInfo {
  name: string
  version: string
  publisher?: string
  installDate?: string
  installLocation?: string
  architecture?: 'x86' | 'x64' | 'ARM64'
}

export interface ServiceInfo {
  name: string
  displayName: string
  status: 'running' | 'stopped' | 'paused' | 'unknown'
  startType: 'auto' | 'manual' | 'disabled' | 'unknown'
  pid?: number
}

export interface PeripheralInfo {
  id: string
  name: string
  type: string
  manufacturer?: string
  status: 'ok' | 'error' | 'degraded' | 'unknown'
  connection: 'usb' | 'bluetooth' | 'pci' | 'internal' | 'unknown'
  driver?: string
}

export interface PortInfo {
  protocol: 'tcp' | 'udp'
  localAddress: string
  localPort: number
  remoteAddress?: string
  remotePort?: number
  state: string
  pid?: number
  processName?: string
}

export interface DeviceCommand {
  deviceId: string
  command: string
  args: string[]
  timeout: number
  captureOutput: boolean
  workingDirectory?: string
  environment?: Record<string, string>
}

export interface DeviceCommandResult {
  deviceId: string
  exitCode: number | null
  stdout: string
  stderr: string
  durationMs: number
  timedOut: boolean
}

export interface AndroidAppInfo {
  packageName: string
  appName: string
  version: string
  isSystem: boolean
  installDate?: string
  dataPath?: string
}

export interface ScanOptions {
  scanNetwork: boolean
  scanUSB: boolean
  scanBluetooth: boolean
  networkTimeout: number
  scanPorts?: number[]
}
