/**
 * SystemProfiler — Deep system profiling using NativeCallBridge.
 * Collects CPU topology, memory topology, NUMA, power state, and more.
 */

import { getNativeCallBridge } from './nativeCallBridge.js'
import type { SystemProfile, CPUTopology, MemoryTopology, NUMANode, TPMInfo } from './types.js'
import type { LocalDeviceSnapshot } from '../deviceBridge/types.js'

export async function getSystemProfile(): Promise<SystemProfile> {
  const bridge = getNativeCallBridge()

  const response = await bridge.call({
    api: 'get_system_profile',
    params: {},
    cacheKey: 'system_profile',
    cacheTtlMs: 60000,
    priority: 'normal',
  })

  if (response.success && response.data) {
    return response.data as SystemProfile
  }

  // Fallback: build from individual calls
  return buildProfileFromIndividualCalls()
}

async function buildProfileFromIndividualCalls(): Promise<SystemProfile> {
  const os = await import('os')

  const cpus = os.cpus()
  const firstCpu = cpus[0]

  const cpuTopology: CPUTopology = {
    sockets: 1,
    coresPerSocket: cpus.length > 0 ? Math.floor(cpus.length / (firstCpu ? getThreadsPerCore(firstCpu) : 2)) : 1,
    threadsPerCore: firstCpu ? getThreadsPerCore(firstCpu) : 2,
    l1CacheKB: 0,
    l2CacheKB: 0,
    l3CacheKB: 0,
    clockGHz: (firstCpu?.speed ?? 0) / 1000,
    maxClockGHz: (firstCpu?.speed ?? 0) / 1000,
    features: [],
  }

  const memoryTopology: MemoryTopology = {
    totalBytes: os.totalmem(),
    speedMHz: 0,
    type: 'Unknown',
    slots: [],
  }

  return {
    cpuTopology,
    memoryTopology,
    numaNodes: [{
      id: 0,
      cpuRange: `0-${cpus.length - 1}`,
      memoryBytes: os.totalmem(),
    }],
    powerPlan: 'Unknown',
    hypervisor: detectHypervisor(cpus),
    secureBoot: false,
    tpm: null,
    kernelVersion: os.release(),
    bootTime: Date.now() - (os.uptime() * 1000),
    lastBootTime: Date.now() - (os.uptime() * 1000),
  }
}

function getThreadsPerCore(cpu: { model: string }): number {
  const model = cpu.model.toLowerCase()
  // Intel Hyper-Threading / AMD SMT typically 2 threads per core
  if (model.includes('intel') || model.includes('amd')) return 2
  return 1
}

function detectHypervisor(cpus: { model: string }[]): string | null {
  if (cpus.length === 0) return null
  const model = cpus[0].model.toLowerCase()
  if (model.includes('hypervisor') || model.includes('virtual')) return 'Detected'
  return null
}

/**
 * Collect a full local device snapshot using the native bridge and platform-specific calls.
 */
export async function collectLocalDeviceSnapshot(): Promise<LocalDeviceSnapshot> {
  const os = await import('os')
  const bridge = getNativeCallBridge()

  // Only load platform-specific functions on Windows
  const isWindows = process.platform === 'win32'

  let cpu, memory, gpu, disks, processes, network, peripherals, software, services

  if (isWindows) {
    const win = await import('./platform/windowsNative.js')
    const results = await Promise.allSettled([
      win.getCPUInfo(),
      win.getMemoryInfo(),
      win.getGPUInfo(),
      win.getDiskInfo(),
      win.getProcessList(),
      win.getNetworkInterfaces(),
      win.getPeripherals(),
      win.getInstalledSoftware(),
      win.getServices(),
    ])

    cpu = results[0].status === 'fulfilled' ? results[0].value : null
    memory = results[1].status === 'fulfilled' ? results[1].value : null
    gpu = results[2].status === 'fulfilled' ? results[2].value : []
    disks = results[3].status === 'fulfilled' ? results[3].value : []
    processes = results[4].status === 'fulfilled' ? results[4].value : []
    network = results[5].status === 'fulfilled' ? results[5].value : []
    peripherals = results[6].status === 'fulfilled' ? results[6].value : []
    software = results[7].status === 'fulfilled' ? results[7].value : []
    services = results[8].status === 'fulfilled' ? results[8].value : []
  }

  return {
    hostname: os.hostname(),
    platform: os.platform(),
    osVersion: os.version(),
    arch: os.arch(),
    cpu: cpu ?? {
      model: os.cpus()[0]?.model ?? 'Unknown',
      manufacturer: 'Unknown',
      cores: os.cpus().length,
      logicalProcessors: os.cpus().length,
      clockSpeedMhz: os.cpus()[0]?.speed ?? 0,
      maxClockSpeedMhz: os.cpus()[0]?.speed ?? 0,
      cacheL1KB: 0, cacheL2KB: 0, cacheL3KB: 0, usagePercent: 0,
    },
    memory: memory ?? {
      totalBytes: os.totalmem(),
      availableBytes: os.freemem(),
      usedBytes: os.totalmem() - os.freemem(),
      swapTotalBytes: 0, swapUsedBytes: 0,
      usagePercent: os.totalmem() > 0 ? ((os.totalmem() - os.freemem()) / os.totalmem()) * 100 : 0,
    },
    gpu: gpu ?? [],
    disks: disks ?? [],
    networkInterfaces: network ?? [],
    runningProcesses: processes ?? [],
    installedSoftware: software ?? [],
    systemServices: services ?? [],
    connectedPeripherals: peripherals ?? [],
    environmentVariables: {},
    openPorts: [],
    uptime: os.uptime(),
    timestamp: Date.now(),
  }
}
