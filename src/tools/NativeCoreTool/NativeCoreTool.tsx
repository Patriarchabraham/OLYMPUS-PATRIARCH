import { z } from 'zod/v4'
import { buildTool, type ToolDef } from '../../Tool.js'
import { lazySchema } from '../../utils/lazySchema.js'
import { getNativeCallBridge } from '../../nativeCore/nativeCallBridge.js'
import { getHotPathCache } from '../../nativeCore/hotPathCache.js'
import { collectLocalDeviceSnapshot } from '../../nativeCore/systemProfiler.js'
import { NATIVE_CORE_TOOL_NAME, getPrompt } from './prompt.js'

// ---------- Input schema ----------

const fullInputSchema = lazySchema(() =>
  z.strictObject({
    action: z.enum([
      'inspect_dll',
      'list_dlls',
      'system_profile',
      'performance',
      'optimize',
    ]).describe('The native core action to perform'),
    path: z.string().optional().describe('File path (for inspect_dll)'),
    directory: z.string().optional().describe('Directory path (for list_dlls)'),
  }),
)

type InputSchema = ReturnType<typeof fullInputSchema>

// ---------- Output schema ----------

const outputSchema = lazySchema(() =>
  z.object({
    success: z.boolean().describe('Whether the action succeeded'),
    action: z.string().describe('The action that was performed'),
    data: z.any().optional().describe('Action-specific result data'),
    error: z.string().optional().describe('Error message if action failed'),
  }),
)

type OutputSchema = ReturnType<typeof outputSchema>
export type NativeCoreOutput = z.infer<OutputSchema>

// ---------- Tool definition ----------

const _nativeCoreToolDef = {
  name: NATIVE_CORE_TOOL_NAME,
  searchHint: 'native system dll performance optimize profile',
  maxResultSizeChars: 200_000,
  get inputSchema(): InputSchema {
    return fullInputSchema()
  },
  get outputSchema(): OutputSchema {
    return outputSchema()
  },

  isEnabled() {
    return true
  },

  isConcurrencySafe() {
    return false
  },

  isReadOnly() {
    return true
  },

  toAutoClassifierInput(input) {
    return `NativeCore(${input.action})`
  },

  userFacingName(input) {
    if (!input?.action) return 'NativeCore'
    const actionNames: Record<string, string> = {
      inspect_dll: 'InspectDLL',
      list_dlls: 'ListDLLs',
      system_profile: 'SystemProfile',
      performance: 'Performance',
      optimize: 'Optimize',
    }
    return actionNames[input.action] ?? 'NativeCore'
  },

  getToolUseSummary(input) {
    if (!input?.action) return null
    return `NativeCore: ${input.action}`
  },

  getActivityDescription(input) {
    if (!input?.action) return 'Inspecting native system'
    switch (input.action) {
      case 'inspect_dll': return `Inspecting DLL: ${input.path ?? 'unknown'}`
      case 'list_dlls': return `Listing DLLs in ${input.directory ?? 'System32'}`
      case 'system_profile': return 'Profiling system'
      case 'performance': return 'Reading performance metrics'
      case 'optimize': return 'Analyzing process optimizations'
      default: return 'Inspecting native system'
    }
  },

  async description(input) {
    return `Native system inspection: ${input.action ?? 'unknown action'}`
  },

  async prompt() {
    return getPrompt()
  },

  renderToolUseMessage(
    input: Partial<{ action: string; path: string; directory: string }>,
    { verbose }: { theme?: string; verbose: boolean },
  ): string {
    if (!input?.action) return 'NativeCore'
    if (verbose) {
      const parts = [`action: ${input.action}`]
      if (input.path) parts.push(`path: "${input.path}"`)
      if (input.directory) parts.push(`directory: "${input.directory}"`)
      return parts.join(', ')
    }
    return input.action
  },

  async call(input) {
    try {
      switch (input.action) {
        case 'inspect_dll': {
          if (!input.path) {
            return {
              data: {
                success: false,
                action: input.action,
                error: 'inspect_dll requires a path parameter',
              },
            }
          }
          const bridge = getNativeCallBridge()
          const response = await bridge.call({
            api: 'inspect_dll',
            params: { path: input.path },
            cacheKey: `dll_${input.path}`,
            cacheTtlMs: 60000,
            priority: 'normal',
          })
          return {
            data: {
              success: response.success,
              action: input.action,
              data: response.data,
              error: response.error,
            },
          }
        }

        case 'list_dlls': {
          const dir = input.directory ?? (process.platform === 'win32' ? 'C:\\Windows\\System32' : '/usr/lib')
          const bridge = getNativeCallBridge()
          const response = await bridge.call({
            api: 'inspect_dll',
            params: { path: dir },
            cacheKey: `dll_list_${dir}`,
            cacheTtlMs: 60000,
            priority: 'low',
          })

          // The DLL list response
          const dllList = response.success && Array.isArray(response.data)
            ? (response.data as Array<{ name?: string; path?: string }>).slice(0, 100)
            : []
          return {
            data: {
              success: true,
              action: input.action,
              data: {
                directory: dir,
                dllCount: dllList.length,
                dlls: dllList.map(d => d.name ?? d.path ?? 'unknown'),
              },
            },
          }
        }

        case 'system_profile': {
          const snapshot = await collectLocalDeviceSnapshot()
          return {
            data: {
              success: true,
              action: input.action,
              data: {
                hostname: snapshot.hostname,
                platform: snapshot.platform,
                osVersion: snapshot.osVersion,
                arch: snapshot.arch,
                uptime: snapshot.uptime,
                cpu: {
                  model: snapshot.cpu.model,
                  cores: snapshot.cpu.cores,
                  logicalProcessors: snapshot.cpu.logicalProcessors,
                  clockSpeedMhz: snapshot.cpu.clockSpeedMhz,
                  cacheL2KB: snapshot.cpu.cacheL2KB,
                  cacheL3KB: snapshot.cpu.cacheL3KB,
                  usagePercent: snapshot.cpu.usagePercent,
                },
                memory: {
                  totalGB: (snapshot.memory.totalBytes / 1024 / 1024 / 1024).toFixed(1),
                  usedGB: (snapshot.memory.usedBytes / 1024 / 1024 / 1024).toFixed(1),
                  availableGB: (snapshot.memory.availableBytes / 1024 / 1024 / 1024).toFixed(1),
                  usagePercent: snapshot.memory.usagePercent.toFixed(1),
                },
                gpus: snapshot.gpu.map(g => ({
                  name: g.name,
                  driverVersion: g.driverVersion,
                  vramMB: (g.vramBytes / 1024 / 1024).toFixed(0),
                })),
                disks: snapshot.disks.map(d => ({
                  mount: d.mountPoint,
                  totalGB: (d.totalBytes / 1024 / 1024 / 1024).toFixed(1),
                  usedGB: (d.usedBytes / 1024 / 1024 / 1024).toFixed(1),
                  filesystem: d.filesystem,
                })),
                networks: snapshot.networkInterfaces.map(n => ({
                  name: n.name,
                  ip: n.ipAddress,
                  type: n.type,
                })),
                peripherals: snapshot.connectedPeripherals.length,
                processes: snapshot.runningProcesses.length,
                services: snapshot.systemServices.length,
                topProcesses: snapshot.runningProcesses
                  .sort((a, b) => b.memoryBytes - a.memoryBytes)
                  .slice(0, 15)
                  .map(p => ({
                    pid: p.pid,
                    name: p.name,
                    memoryMB: (p.memoryBytes / 1024 / 1024).toFixed(1),
                    cpuPercent: p.cpuPercent.toFixed(1),
                  })),
              },
            },
          }
        }

        case 'performance': {
          const cache = getHotPathCache()
          const stats = cache.getStats()
          const bridge = getNativeCallBridge()
          return {
            data: {
              success: true,
              action: input.action,
              data: {
                bridgeReady: bridge.isReady,
                cacheSize: stats.size,
                cacheHitRate: `${(stats.hitRate * 100).toFixed(1)}%`,
                oldestEntryAge: stats.oldestEntry > 0
                  ? `${((Date.now() - stats.oldestEntry) / 1000).toFixed(1)}s`
                  : 'N/A',
                platform: process.platform,
                nodeVersion: process.version,
                memoryUsageMB: (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1),
                memoryTotalMB: (process.memoryUsage().heapTotal / 1024 / 1024).toFixed(1),
                rssMB: (process.memoryUsage().rss / 1024 / 1024).toFixed(1),
                uptime: `${(process.uptime()).toFixed(0)}s`,
              },
            },
          }
        }

        case 'optimize': {
          const snapshot = await collectLocalDeviceSnapshot()
          const topProcesses = snapshot.runningProcesses
            .sort((a, b) => b.memoryBytes - a.memoryBytes)
            .slice(0, 20)
          const recommendations: string[] = []

          // Identify high-memory processes
          for (const proc of topProcesses) {
            const memMB = proc.memoryBytes / 1024 / 1024
            if (memMB > 500) {
              recommendations.push(`[HIGH MEM] ${proc.name} (PID ${proc.pid}): ${memMB.toFixed(0)} MB — consider restarting if not actively used`)
            }
            if (proc.cpuPercent > 50) {
              recommendations.push(`[HIGH CPU] ${proc.name} (PID ${proc.pid}): ${proc.cpuPercent.toFixed(1)}% CPU — check for runaway processes`)
            }
          }

          // Memory pressure analysis
          const memPressure = snapshot.memory.usagePercent
          if (memPressure > 85) {
            recommendations.push(`[MEMORY PRESSURE] ${memPressure.toFixed(0)}% used — consider closing unused applications`)
          } else if (memPressure > 70) {
            recommendations.push(`[MEMORY WARNING] ${memPressure.toFixed(0)}% used — moderate pressure`)
          }

          return {
            data: {
              success: true,
              action: input.action,
              data: {
                totalProcesses: snapshot.runningProcesses.length,
                memoryPressurePercent: memPressure.toFixed(1),
                recommendations: recommendations.length > 0
                  ? recommendations
                  : ['System appears well-optimized — no significant issues detected'],
                topByMemory: topProcesses.slice(0, 10).map(p => ({
                  pid: p.pid,
                  name: p.name,
                  memoryMB: (p.memoryBytes / 1024 / 1024).toFixed(1),
                  cpuPercent: p.cpuPercent.toFixed(1),
                })),
              },
            },
          }
        }

        default:
          return {
            data: {
              success: false,
              action: input.action ?? 'unknown',
              error: `Unknown action: ${input.action}`,
            },
          }
      }
    } catch (err) {
      return {
        data: {
          success: false,
          action: input.action ?? 'unknown',
          error: err instanceof Error ? err.message : String(err),
        },
      }
    }
  },
} as any

export const NativeCoreTool = buildTool(_nativeCoreToolDef as any) as unknown as ToolDef<InputSchema, NativeCoreOutput>
