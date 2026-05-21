/**
 * macOS-specific device introspection stubs.
 * TODO: Implement using system_profiler, ioreg, and sysctl.
 */
import os from 'node:os'
import type {
  CPUInfo, MemoryInfo, GPUInfo, DiskInfo, NetworkInfo,
  ProcessInfo, PeripheralInfo, ServiceInfo, SoftwareInfo,
} from '../types.js'

export async function getCPUInfo(): Promise<CPUInfo> {
  const cpus = os.cpus()
  return {
    model: cpus[0]?.model ?? 'Unknown', manufacturer: 'Apple',
    cores: cpus.length, logicalProcessors: cpus.length,
    clockSpeedMhz: cpus[0]?.speed ?? 0, maxClockSpeedMhz: cpus[0]?.speed ?? 0,
    cacheL1KB: 0, cacheL2KB: 0, cacheL3KB: 0, usagePercent: 0,
  }
}

export async function getMemoryInfo(): Promise<MemoryInfo> {
  const total = os.totalmem()
  const free = os.freemem()
  return {
    totalBytes: total, availableBytes: free, usedBytes: total - free,
    swapTotalBytes: 0, swapUsedBytes: 0,
    usagePercent: total > 0 ? ((total - free) / total) * 100 : 0,
  }
}

export async function getGPUInfo(): Promise<GPUInfo[]> { return [] }
export async function getDiskInfo(): Promise<DiskInfo[]> { return [] }
export async function getProcessList(): Promise<ProcessInfo[]> { return [] }
export async function getNetworkInterfaces(): Promise<NetworkInfo[]> { return [] }
export async function getPeripherals(): Promise<PeripheralInfo[]> { return [] }
export async function getServices(): Promise<ServiceInfo[]> { return [] }
export async function getInstalledSoftware(): Promise<SoftwareInfo[]> { return [] }
