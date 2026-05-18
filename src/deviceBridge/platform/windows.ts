/**
 * Windows-specific device introspection via NativeCallBridge + PowerShell.
 */
import { getNativeCallBridge } from '../../nativeCore/nativeCallBridge.js'
import type {
  CPUInfo,
  MemoryInfo,
  GPUInfo,
  DiskInfo,
  NetworkInfo,
  ProcessInfo,
  PeripheralInfo,
  ServiceInfo,
  SoftwareInfo,
} from '../types.js'

export async function getCPUInfo(): Promise<CPUInfo> {
  try {
    const bridge = getNativeCallBridge()
    const response = await bridge.call({
      api: 'get_cpu_info',
      params: {},
      cacheKey: 'db_cpu_info',
      cacheTtlMs: 60000,
      priority: 'normal',
    })
    if (!response.success || !response.data) return fallbackCPU()
    const d = (Array.isArray(response.data) ? response.data[0] : response.data) as Record<string, unknown>
    return {
      model: String(d.Name ?? 'Unknown'),
      manufacturer: String(d.Manufacturer ?? 'Unknown'),
      cores: Number(d.NumberOfCores ?? 0),
      logicalProcessors: Number(d.NumberOfLogicalProcessors ?? 0),
      clockSpeedMhz: Number(d.CurrentClockSpeed ?? 0),
      maxClockSpeedMhz: Number(d.MaxClockSpeed ?? 0),
      cacheL1KB: 0,
      cacheL2KB: Number(d.L2CacheSize ?? 0),
      cacheL3KB: Number(d.L3CacheSize ?? 0),
      usagePercent: Number(d.LoadPercentage ?? 0),
    }
  } catch { return fallbackCPU() }
}

export async function getMemoryInfo(): Promise<MemoryInfo> {
  try {
    const bridge = getNativeCallBridge()
    const response = await bridge.call({
      api: 'get_memory_info',
      params: {},
      cacheKey: 'db_memory_info',
      cacheTtlMs: 15000,
      priority: 'normal',
    })
    if (!response.success || !response.data) return fallbackMemory()
    const d = response.data as Record<string, unknown>
    const totalKB = Number(d.TotalVisibleMemorySize ?? 0)
    const freeKB = Number(d.FreePhysicalMemory ?? 0)
    return {
      totalBytes: totalKB * 1024,
      availableBytes: freeKB * 1024,
      usedBytes: (totalKB - freeKB) * 1024,
      swapTotalBytes: 0,
      swapUsedBytes: 0,
      usagePercent: totalKB > 0 ? ((totalKB - freeKB) / totalKB) * 100 : 0,
    }
  } catch { return fallbackMemory() }
}

export async function getGPUInfo(): Promise<GPUInfo[]> {
  try {
    const bridge = getNativeCallBridge()
    const response = await bridge.call({
      api: 'get_gpu_info',
      params: {},
      cacheKey: 'db_gpu_info',
      cacheTtlMs: 60000,
      priority: 'normal',
    })
    if (!response.success || !response.data) return []
    const items = Array.isArray(response.data) ? response.data : [response.data]
    return items.map((d: Record<string, unknown>) => ({
      name: String(d.Name ?? 'Unknown'),
      driver: '',
      driverVersion: String(d.DriverVersion ?? ''),
      vramBytes: Number(d.AdapterRAM ?? 0),
      usagePercent: 0,
    }))
  } catch { return [] }
}

export async function getDiskInfo(): Promise<DiskInfo[]> {
  try {
    const bridge = getNativeCallBridge()
    const response = await bridge.call({
      api: 'get_disk_info',
      params: {},
      cacheKey: 'db_disk_info',
      cacheTtlMs: 30000,
      priority: 'normal',
    })
    if (!response.success || !response.data) return []
    const items = Array.isArray(response.data) ? response.data : [response.data]
    return items.map((d: Record<string, unknown>) => ({
      name: String(d.VolumeName ?? ''),
      mountPoint: String(d.DeviceID ?? ''),
      filesystem: String(d.FileSystem ?? ''),
      totalBytes: Number(d.Size ?? 0),
      usedBytes: Number(d.Size ?? 0) - Number(d.FreeSpace ?? 0),
      availableBytes: Number(d.FreeSpace ?? 0),
      type: 'unknown' as const,
    }))
  } catch { return [] }
}

export async function getProcessList(): Promise<ProcessInfo[]> {
  try {
    const bridge = getNativeCallBridge()
    const response = await bridge.call({
      api: 'get_process_list',
      params: {},
      cacheKey: 'db_process_list',
      cacheTtlMs: 5000,
      priority: 'normal',
    })
    if (!response.success || !response.data) return []
    const items = Array.isArray(response.data) ? response.data : [response.data]
    return items.map((d: Record<string, unknown>) => ({
      pid: Number(d.Id ?? 0),
      name: String(d.ProcessName ?? ''),
      cpuPercent: Number(d.CPU ?? 0),
      memoryBytes: Number(d.WorkingSet64 ?? 0),
      status: 'running',
      startTime: d.StartTime ? new Date(String(d.StartTime)).getTime() : undefined,
    }))
  } catch { return [] }
}

export async function getNetworkInterfaces(): Promise<NetworkInfo[]> {
  try {
    const bridge = getNativeCallBridge()
    const response = await bridge.call({
      api: 'get_network_info',
      params: {},
      cacheKey: 'db_network_info',
      cacheTtlMs: 30000,
      priority: 'low',
    })
    if (!response.success || !response.data) return []
    const items = Array.isArray(response.data) ? response.data : [response.data]
    return items.map((d: Record<string, unknown>) => ({
      name: String(d.Description ?? ''),
      interfaceIndex: 0,
      macAddress: String(d.MACAddress ?? ''),
      ipAddress: Array.isArray(d.IPAddress) ? (d.IPAddress as string[])[0] ?? '' : String(d.IPAddress ?? ''),
      dnsServers: Array.isArray(d.DNSServerSearchOrder) ? d.DNSServerSearchOrder as string[] : [],
      type: 'unknown' as const,
      status: 'up' as const,
    }))
  } catch { return [] }
}

export async function getPeripherals(): Promise<PeripheralInfo[]> {
  try {
    const bridge = getNativeCallBridge()
    const response = await bridge.call({
      api: 'get_peripherals',
      params: {},
      cacheKey: 'db_peripherals',
      cacheTtlMs: 60000,
      priority: 'low',
    })
    if (!response.success || !response.data) return []
    const items = Array.isArray(response.data) ? response.data : [response.data]
    return items.map((d: Record<string, unknown>) => ({
      id: String(d.InstanceId ?? ''),
      name: String(d.FriendlyName ?? ''),
      type: String(d.Class ?? 'unknown'),
      status: String(d.Status ?? '') === 'OK' ? 'ok' as const : 'unknown' as const,
      connection: 'unknown' as const,
    }))
  } catch { return [] }
}

export async function getServices(): Promise<ServiceInfo[]> {
  try {
    const bridge = getNativeCallBridge()
    const response = await bridge.call({
      api: 'get_services',
      params: {},
      cacheKey: 'db_services',
      cacheTtlMs: 30000,
      priority: 'low',
    })
    if (!response.success || !response.data) return []
    const items = Array.isArray(response.data) ? response.data : [response.data]
    return items.map((d: Record<string, unknown>) => ({
      name: String(d.Name ?? ''),
      displayName: String(d.DisplayName ?? ''),
      status: String(d.Status ?? '').toLowerCase() === 'running' ? 'running' as const : 'stopped' as const,
      startType: String(d.StartType ?? '').toLowerCase() === 'automatic' ? 'auto' as const : 'manual' as const,
    }))
  } catch { return [] }
}

export async function getInstalledSoftware(): Promise<SoftwareInfo[]> {
  try {
    const bridge = getNativeCallBridge()
    const response = await bridge.call({
      api: 'get_installed_software',
      params: {},
      cacheKey: 'db_software',
      cacheTtlMs: 120000,
      priority: 'low',
    })
    if (!response.success || !response.data) return []
    const items = Array.isArray(response.data) ? response.data : [response.data]
    return items.map((d: Record<string, unknown>) => ({
      name: String(d.DisplayName ?? ''),
      version: String(d.DisplayVersion ?? ''),
      publisher: d.Publisher ? String(d.Publisher) : undefined,
      installDate: d.InstallDate ? String(d.InstallDate) : undefined,
      installLocation: d.InstallLocation ? String(d.InstallLocation) : undefined,
    }))
  } catch { return [] }
}

function fallbackCPU(): CPUInfo {
  const cpus = require('os').cpus()
  return {
    model: cpus[0]?.model ?? 'Unknown',
    manufacturer: 'Unknown',
    cores: cpus.length,
    logicalProcessors: cpus.length,
    clockSpeedMhz: cpus[0]?.speed ?? 0,
    maxClockSpeedMhz: cpus[0]?.speed ?? 0,
    cacheL1KB: 0, cacheL2KB: 0, cacheL3KB: 0, usagePercent: 0,
  }
}

function fallbackMemory(): MemoryInfo {
  const os = require('os')
  const total = os.totalmem()
  const free = os.freemem()
  return {
    totalBytes: total,
    availableBytes: free,
    usedBytes: total - free,
    swapTotalBytes: 0, swapUsedBytes: 0,
    usagePercent: total > 0 ? ((total - free) / total) * 100 : 0,
  }
}
