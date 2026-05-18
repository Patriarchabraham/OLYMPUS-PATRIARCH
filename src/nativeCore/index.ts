/**
 * NativeCore Module — Native Performance Engine
 *
 * Provides DLL inspection, persistent PowerShell bridge, hot-path caching,
 * and zero-latency native system calls.
 */

export { NativeCallBridge, getNativeCallBridge, disposeNativeCallBridge } from './nativeCallBridge.js'
export { HotPathCache, getHotPathCache } from './hotPathCache.js'
export { getSystemProfile, collectLocalDeviceSnapshot } from './systemProfiler.js'
export type {
  DLLInfo,
  DLLExport,
  DLLImport,
  SignatureInfo,
  SystemProfile,
  CPUTopology,
  MemoryTopology,
  MemorySlot,
  NUMANode,
  TPMInfo,
  PerformanceReport,
  Bottleneck,
  OptimizationRecommendation,
  CachedNativeResult,
  NativeCallRequest,
  NativeCallResponse,
  ProcessOptimization,
  NativeApiCall,
} from './types.js'
