/**
 * NativeCore Module — Native Performance Engine Types
 * DLL inspection, persistent PowerShell bridge, hot-path caching, zero-latency native calls.
 */

export interface DLLInfo {
  path: string
  name: string
  version: string
  architecture: 'x86' | 'x64' | 'ARM64' | 'unknown'
  exports: DLLExport[]
  imports: DLLImport[]
  size: number
  createdTime: number
  modifiedTime: number
  digitalSignature: SignatureInfo | null
  dependencies: string[]
  productname: string
  companyname: string
  description: string
}

export interface DLLExport {
  name: string
  ordinal: number
  address: string
  isPublic: boolean
}

export interface DLLImport {
  dllName: string
  functions: string[]
}

export interface SignatureInfo {
  isSigned: boolean
  signer: string
  isValid: boolean
  expiryDate?: number
  thumbprint?: string
}

export interface SystemProfile {
  cpuTopology: CPUTopology
  memoryTopology: MemoryTopology
  numaNodes: NUMANode[]
  powerPlan: string
  hypervisor: string | null
  secureBoot: boolean
  tpm: TPMInfo | null
  kernelVersion: string
  bootTime: number
  lastBootTime: number
}

export interface CPUTopology {
  sockets: number
  coresPerSocket: number
  threadsPerCore: number
  l1CacheKB: number
  l2CacheKB: number
  l3CacheKB: number
  clockGHz: number
  maxClockGHz: number
  features: string[] // e.g. 'AVX2', 'SSE4.2', 'HYPERVISOR'
}

export interface MemoryTopology {
  totalBytes: number
  speedMHz: number
  type: string // 'DDR4', 'DDR5', etc
  slots: MemorySlot[]
}

export interface MemorySlot {
  slot: string
  capacityBytes: number
  speedMHz: number
  type: string
  manufacturer: string
  populated: boolean
}

export interface NUMANode {
  id: number
  cpuRange: string // e.g. '0-7'
  memoryBytes: number
}

export interface TPMInfo {
  version: string
  manufacturer: string
  isReady: boolean
}

export interface PerformanceReport {
  timestamp: number
  avgLatencyMs: number
  p50LatencyMs: number
  p95LatencyMs: number
  p99LatencyMs: number
  totalCalls: number
  cacheHitRate: number
  bottlenecks: Bottleneck[]
  recommendations: OptimizationRecommendation[]
}

export interface Bottleneck {
  operation: string
  avgDurationMs: number
  callCount: number
  impact: 'low' | 'medium' | 'high' | 'critical'
  description: string
}

export interface OptimizationRecommendation {
  category: 'caching' | 'batching' | 'connection' | 'process' | 'memory'
  description: string
  estimatedImprovement: string
  priority: 'low' | 'medium' | 'high'
  action: string
}

export interface CachedNativeResult {
  key: string
  value: unknown
  timestamp: number
  ttlMs: number
  hitCount: number
}

export interface NativeCallRequest {
  api: string
  params: Record<string, unknown>
  cacheKey?: string
  cacheTtlMs?: number
  priority: 'low' | 'normal' | 'high'
}

export interface NativeCallResponse {
  success: boolean
  data: unknown
  error?: string
  durationMs: number
  fromCache: boolean
}

export interface ProcessOptimization {
  pid: number
  processName: string
  currentPriority: string
  recommendedPriority: string
  currentAffinity: string
  recommendedAffinity: string
  memoryUsageBytes: number
  recommendations: string[]
}

export type NativeApiCall =
  | 'get_cpu_info'
  | 'get_memory_info'
  | 'get_gpu_info'
  | 'get_disk_info'
  | 'get_process_list'
  | 'get_network_info'
  | 'get_peripherals'
  | 'get_services'
  | 'get_ports'
  | 'get_installed_software'
  | 'get_system_profile'
  | 'inspect_dll'
  | 'list_dlls'
  | 'get_environment'
  | 'get_performance_counters'
