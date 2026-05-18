/**
 * Windows-specific native calls via PowerShell.
 * Provides typed wrappers for common WMI/CIM queries using the NativeCallBridge.
 */

import { getNativeCallBridge } from '../nativeCallBridge.js'
import type {
  CPUInfo,
  MemoryInfo,
  GPUInfo,
  DiskInfo,
  NetworkInfo,
  ProcessInfo,
  PeripheralInfo,
  ServiceInfo,
  PortInfo,
  SoftwareInfo,
} from '../../deviceBridge/types.js'

export async function getCPUInfo(): Promise<CPUInfo> {
  const bridge = getNativeCallBridge()
  const response = await bridge.call({
    api: 'get_cpu_info',
    params: {},
    cacheKey: 'cpu_info',
    cacheTtlMs: 60000,
    priority: 'normal',
  })

  if (!response.success || !response.data) {
    return getFallbackCPUInfo()
  }

  const data = response.data as Record<string, unknown> | Record<string, unknown>[]
  const item = Array.isArray(data) ? data[0] : data

  return {
    model: String(item?.Name ?? 'Unknown'),
    manufacturer: String(item?.Manufacturer ?? 'Unknown'),
    cores: Number(item?.NumberOfCores ?? 0),
    logicalProcessors: Number(item?.NumberOfLogicalProcessors ?? 0),
    clockSpeedMhz: Number(item?.CurrentClockSpeed ?? 0),
    maxClockSpeedMhz: Number(item?.MaxClockSpeed ?? 0),
    cacheL1KB: 0, // Not directly available via WMI
    cacheL2KB: Number(item?.L2CacheSize ?? 0),
    cacheL3KB: Number(item?.L3CacheSize ?? 0),
    usagePercent: Number(item?.LoadPercentage ?? 0),
  }
}

export async function getMemoryInfo(): Promise<MemoryInfo> {
  const bridge = getNativeCallBridge()
  const response = await bridge.call({
    api: 'get_memory_info',
    params: {},
    cacheKey: 'memory_info',
    cacheTtlMs: 15000,
    priority: 'normal',
  })

  if (!response.success || !response.data) {
    return getFallbackMemoryInfo()
  }

  const data = response.data as Record<string, unknown>
  const totalKB = Number(data?.TotalVisibleMemorySize ?? 0)
  const freeKB = Number(data?.FreePhysicalMemory ?? 0)

  return {
    totalBytes: totalKB * 1024,
    availableBytes: freeKB * 1024,
    usedBytes: (totalKB - freeKB) * 1024,
    swapTotalBytes: 0,
    swapUsedBytes: 0,
    usagePercent: totalKB > 0 ? ((totalKB - freeKB) / totalKB) * 100 : 0,
  }
}

export async function getGPUInfo(): Promise<GPUInfo[]> {
  const bridge = getNativeCallBridge()
  const response = await bridge.call({
    api: 'get_gpu_info',
    params: {},
    cacheKey: 'gpu_info',
    cacheTtlMs: 60000,
    priority: 'normal',
  })

  if (!response.success || !response.data) return []

  const data = response.data as Record<string, unknown>[]
  const items = Array.isArray(data) ? data : [data]

  return items.map((item) => ({
    name: String(item?.Name ?? 'Unknown GPU'),
    driver: 'Unknown',
    driverVersion: String(item?.DriverVersion ?? 'Unknown'),
    vramBytes: Number(item?.AdapterRAM ?? 0),
    usagePercent: 0,
  }))
}

export async function getDiskInfo(): Promise<DiskInfo[]> {
  const bridge = getNativeCallBridge()
  const response = await bridge.call({
    api: 'get_disk_info',
    params: {},
    cacheKey: 'disk_info',
    cacheTtlMs: 30000,
    priority: 'normal',
  })

  if (!response.success || !response.data) return []

  const data = response.data as Record<string, unknown>[]
  const items = Array.isArray(data) ? data : [data]

  return items.map((item) => ({
    name: String(item?.VolumeName ?? 'Unknown'),
    mountPoint: String(item?.DeviceID ?? ''),
    filesystem: String(item?.FileSystem ?? 'Unknown'),
    totalBytes: Number(item?.Size ?? 0),
    usedBytes: Number(item?.Size ?? 0) - Number(item?.FreeSpace ?? 0),
    availableBytes: Number(item?.FreeSpace ?? 0),
    type: 'unknown' as const,
  }))
}

export async function getProcessList(): Promise<ProcessInfo[]> {
  const bridge = getNativeCallBridge()
  const response = await bridge.call({
    api: 'get_process_list',
    params: {},
    cacheKey: 'process_list',
    cacheTtlMs: 5000,
    priority: 'normal',
  })

  if (!response.success || !response.data) return []

  const data = response.data as Record<string, unknown>[]
  const items = Array.isArray(data) ? data : [data]

  return items.map((item) => ({
    pid: Number(item?.Id ?? 0),
    name: String(item?.ProcessName ?? 'Unknown'),
    cpuPercent: Number(item?.CPU ?? 0),
    memoryBytes: Number(item?.WorkingSet64 ?? 0),
    status: 'running',
    startTime: item?.StartTime ? new Date(String(item.StartTime)).getTime() : undefined,
  }))
}

export async function getNetworkInterfaces(): Promise<NetworkInfo[]> {
  const bridge = getNativeCallBridge()
  const response = await bridge.call({
    api: 'get_network_info',
    params: {},
    cacheKey: 'network_info',
    cacheTtlMs: 30000,
    priority: 'low',
  })

  if (!response.success || !response.data) return []

  const data = response.data as Record<string, unknown>[]
  const items = Array.isArray(data) ? data : [data]

  return items.map((item) => ({
    name: String(item?.Description ?? 'Unknown'),
    interfaceIndex: 0,
    macAddress: String(item?.MACAddress ?? ''),
    ipAddress: Array.isArray(item?.IPAddress) ? (item.IPAddress as string[])[0] ?? '' : String(item?.IPAddress ?? ''),
    dnsServers: Array.isArray(item?.DNSServerSearchOrder) ? item.DNSServerSearchOrder as string[] : [],
    type: 'unknown' as const,
    status: 'up' as const,
  }))
}

export async function getPeripherals(): Promise<PeripheralInfo[]> {
  const bridge = getNativeCallBridge()
  const response = await bridge.call({
    api: 'get_peripherals',
    params: {},
    cacheKey: 'peripherals',
    cacheTtlMs: 60000,
    priority: 'low',
  })

  if (!response.success || !response.data) return []

  const data = response.data as Record<string, unknown>[]
  const items = Array.isArray(data) ? data : [data]

  return items.map((item) => ({
    id: String(item?.InstanceId ?? ''),
    name: String(item?.FriendlyName ?? 'Unknown'),
    type: String(item?.Class ?? 'unknown'),
    status: String(item?.Status ?? 'unknown') === 'OK' ? 'ok' as const : 'unknown' as const,
    connection: 'unknown' as const,
  }))
}

export async function getServices(): Promise<ServiceInfo[]> {
  const bridge = getNativeCallBridge()
  const response = await bridge.call({
    api: 'get_services',
    params: {},
    cacheKey: 'services',
    cacheTtlMs: 30000,
    priority: 'low',
  })

  if (!response.success || !response.data) return []

  const data = response.data as Record<string, unknown>[]
  const items = Array.isArray(data) ? data : [data]

  return items.map((item) => ({
    name: String(item?.Name ?? ''),
    displayName: String(item?.DisplayName ?? ''),
    status: String(item?.Status ?? '').toLowerCase() === 'running' ? 'running' as const : 'stopped' as const,
    startType: String(item?.StartType ?? '').toLowerCase() === 'automatic' ? 'auto' as const : 'manual' as const,
  }))
}

export async function getInstalledSoftware(): Promise<SoftwareInfo[]> {
  const bridge = getNativeCallBridge()
  const response = await bridge.call({
    api: 'get_installed_software',
    params: {},
    cacheKey: 'installed_software',
    cacheTtlMs: 120000,
    priority: 'low',
  })

  if (!response.success || !response.data) return []

  const data = response.data as Record<string, unknown>[]
  const items = Array.isArray(data) ? data : [data]

  return items.map((item) => ({
    name: String(item?.DisplayName ?? ''),
    version: String(item?.DisplayVersion ?? ''),
    publisher: String(item?.Publisher ?? undefined),
    installDate: String(item?.InstallDate ?? undefined),
    installLocation: String(item?.InstallLocation ?? undefined),
  }))
}

// Fallbacks using Node.js built-in os module
function getFallbackCPUInfo(): CPUInfo {
  const cpus = require('os').cpus()
  return {
    model: cpus[0]?.model ?? 'Unknown',
    manufacturer: 'Unknown',
    cores: cpus.length,
    logicalProcessors: cpus.length,
    clockSpeedMhz: cpus[0]?.speed ?? 0,
    maxClockSpeedMhz: cpus[0]?.speed ?? 0,
    cacheL1KB: 0,
    cacheL2KB: 0,
    cacheL3KB: 0,
    usagePercent: 0,
  }
}

function getFallbackMemoryInfo(): MemoryInfo {
  const os = require('os')
  const total = os.totalmem()
  const free = os.freemem()
  return {
    totalBytes: total,
    availableBytes: free,
    usedBytes: total - free,
    swapTotalBytes: 0,
    swapUsedBytes: 0,
    usagePercent: total > 0 ? ((total - free) / total) * 100 : 0,
  }
}
