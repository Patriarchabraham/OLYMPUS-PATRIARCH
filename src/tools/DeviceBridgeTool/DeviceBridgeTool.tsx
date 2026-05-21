import type { ToolResultBlockParam } from '@anthropic-ai/sdk/resources/index.mjs'
import { z } from 'zod/v4'
import { buildTool, type ToolDef } from '../../Tool.js'
import { lazySchema } from '../../utils/lazySchema.js'
import { DEVICE_BRIDGE_TOOL_NAME, getPrompt } from './prompt.js'
import { getDeviceBridgeManager } from '../../deviceBridge/index.js'
import type { LocalDeviceSnapshot, DeviceInfo } from '../../deviceBridge/types.js'
import * as androidBridge from '../../deviceBridge/androidBridge.js'

// ---------- Input schema ----------

const fullInputSchema = lazySchema(() =>
  z.strictObject({
    action: z.enum(['scan', 'list', 'info', 'screenshot', 'execute', 'apps', 'push', 'pull'])
      .describe('The device bridge action to perform'),
    deviceId: z.string().optional()
      .describe('Target device ID (from scan/list results)'),
    command: z.string().optional()
      .describe('Shell command to execute on the device (execute action)'),
    localPath: z.string().optional()
      .describe('Local file path (push/pull actions)'),
    remotePath: z.string().optional()
      .describe('Remote file path on device (push/pull actions)'),
    scanNetwork: z.boolean().optional()
      .describe('Include network device scanning (default true)'),
    scanUSB: z.boolean().optional()
      .describe('Include USB device scanning via ADB (default true)'),
  }),
)

type InputSchema = ReturnType<typeof fullInputSchema>

// ---------- Output schema ----------

const outputSchema = lazySchema(() =>
  z.object({
    success: z.boolean().describe('Whether the action succeeded'),
    message: z.string().optional().describe('Human-readable result message'),
    data: z.unknown().optional().describe('Action-specific data'),
    error: z.string().optional().describe('Error message if action failed'),
  }),
)

type OutputSchema = ReturnType<typeof outputSchema>
export type DeviceBridgeOutput = z.infer<OutputSchema>

// ---------- Helper: resolve ADB device ID from registry ID ----------

function resolveAdbId(deviceId: string): string | null {
  // Registry IDs look like "adb_1234567890ABCDEF"
  if (deviceId.startsWith('adb_')) {
    return deviceId.slice(4)
  }
  return null
}

// ---------- Tool definition ----------

const _deviceBridgeToolDef = {
  name: DEVICE_BRIDGE_TOOL_NAME,
  searchHint: 'device scan android mobile hardware peripheral usb network',
  maxResultSizeChars: 200_000,
  get inputSchema(): InputSchema {
    return fullInputSchema()
  },
  get outputSchema(): OutputSchema {
    return outputSchema()
  },

  isEnabled() {
    // Always available — the tool gracefully handles missing tools (ADB, etc.)
    return true
  },

  isConcurrencySafe() {
    return false
  },

  isReadOnly(input) {
    return input.action === 'scan' || input.action === 'list' || input.action === 'info' || input.action === 'apps'
  },

  toAutoClassifierInput(input) {
    return `DeviceBridge(${input.action})`
  },

  userFacingName(input) {
    if (!input?.action) return 'DeviceBridge'
    const actionNames: Record<string, string> = {
      scan: 'DeviceScan',
      list: 'DeviceList',
      info: 'DeviceInfo',
      screenshot: 'DeviceScreenshot',
      execute: 'DeviceExec',
      apps: 'DeviceApps',
      push: 'DevicePush',
      pull: 'DevicePull',
    }
    return actionNames[input.action] ?? 'DeviceBridge'
  },

  getToolUseSummary(input) {
    if (!input?.action) return null
    return `DeviceBridge: ${input.action}`
  },

  getActivityDescription(input) {
    if (!input?.action) return 'Interacting with devices'
    switch (input.action) {
      case 'scan': return 'Scanning for devices'
      case 'list': return 'Listing devices'
      case 'info': return 'Getting device info'
      case 'screenshot': return `Taking screenshot from ${input.deviceId ?? 'device'}`
      case 'execute': return `Executing command on ${input.deviceId ?? 'device'}`
      case 'apps': return `Listing apps on ${input.deviceId ?? 'device'}`
      case 'push': return `Pushing file to ${input.deviceId ?? 'device'}`
      case 'pull': return `Pulling file from ${input.deviceId ?? 'device'}`
      default: return 'Interacting with devices'
    }
  },

  async description(input) {
    return `Device bridge: ${input.action ?? 'unknown action'}`
  },

  async prompt() {
    return getPrompt()
  },

  renderToolUseMessage(
    input: Partial<{ action: string; deviceId: string; command: string }>,
    { verbose }: { theme?: string; verbose: boolean },
  ): string {
    if (!input?.action) return 'DeviceBridge'
    if (verbose) {
      const parts = [`action: ${input.action}`]
      if (input.deviceId) parts.push(`device: ${input.deviceId}`)
      if (input.command) parts.push(`command: "${input.command}"`)
      return parts.join(', ')
    }
    return `${input.action}${input.deviceId ? ` → ${input.deviceId}` : ''}`
  },

  async call(input) {
    try {
      const manager = getDeviceBridgeManager()

      switch (input.action) {
        case 'scan': {
          const devices = await manager.scan({
            scanNetwork: input.scanNetwork ?? true,
            scanUSB: input.scanUSB ?? true,
            scanBluetooth: false,
            networkTimeout: 5000,
          })
          return {
            data: {
              success: true,
              message: `Found ${devices.length} device(s)`,
              data: devices.map((d: DeviceInfo) => ({
                id: d.id,
                name: d.name,
                type: d.type,
                platform: d.platform,
                status: d.connectionStatus,
                capabilities: d.capabilities,
              })),
            },
          }
        }

        case 'list': {
          const devices = manager.listDevices()
          return {
            data: {
              success: true,
              message: `${devices.length} device(s) known`,
              data: devices.map((d: DeviceInfo) => ({
                id: d.id,
                name: d.name,
                type: d.type,
                status: d.connectionStatus,
                lastSeen: d.lastSeen,
              })),
            },
          }
        }

        case 'info': {
          if (input.deviceId) {
            const info = manager.getDeviceInfo(input.deviceId)
            if (!info) {
              return { data: { success: false, error: `Device not found: ${input.deviceId}` } }
            }
            // For Android devices, get detailed info via ADB
            const adbId = resolveAdbId(input.deviceId)
            if (adbId && info.type === 'android') {
              try {
                const detailed = await androidBridge.getDeviceInfo(adbId)
                return { data: { success: true, data: detailed } }
              } catch (err) {
                return { data: { success: true, data: info } }
              }
            }
            return { data: { success: true, data: info } }
          }

          // Local device snapshot
          const snapshot: LocalDeviceSnapshot = await manager.getLocalSnapshot()
          return {
            data: {
              success: true,
              message: `Local device: ${snapshot.hostname} (${snapshot.platform} ${snapshot.osVersion})`,
              data: {
                hostname: snapshot.hostname,
                platform: snapshot.platform,
                osVersion: snapshot.osVersion,
                arch: snapshot.arch,
                cpu: snapshot.cpu,
                memory: snapshot.memory,
                gpu: snapshot.gpu,
                disks: snapshot.disks,
                uptime: snapshot.uptime,
                peripherals: snapshot.connectedPeripherals.length,
                processes: snapshot.runningProcesses.length,
                services: snapshot.systemServices.length,
              },
            },
          }
        }

        case 'screenshot': {
          if (!input.deviceId) {
            return { data: { success: false, error: 'screenshot requires deviceId' } }
          }
          const adbId = resolveAdbId(input.deviceId)
          if (!adbId) {
            return { data: { success: false, error: 'Screenshots are only supported for Android devices (adb_* IDs)' } }
          }
          const pngBuffer = await androidBridge.takeScreenshot(adbId)
          const base64 = pngBuffer.toString('base64')
          return {
            data: {
              success: true,
              message: `Screenshot captured from ${input.deviceId} (${pngBuffer.length} bytes)`,
              data: { imageBase64: base64 },
            },
          }
        }

        case 'execute': {
          if (!input.deviceId || !input.command) {
            return { data: { success: false, error: 'execute requires deviceId and command' } }
          }
          const result = await manager.execute(input.deviceId, input.command)
          return {
            data: {
              success: result.exitCode === 0,
              message: `Command exited with code ${result.exitCode}`,
              data: {
                exitCode: result.exitCode,
                stdout: result.stdout,
                stderr: result.stderr,
                durationMs: result.durationMs,
              },
            },
          }
        }

        case 'apps': {
          if (!input.deviceId) {
            return { data: { success: false, error: 'apps requires deviceId of an Android device' } }
          }
          const adbId = resolveAdbId(input.deviceId)
          if (!adbId) {
            return { data: { success: false, error: 'apps is only supported for Android devices (adb_* IDs)' } }
          }
          const apps = await androidBridge.listApps(adbId)
          return {
            data: {
              success: true,
              message: `${apps.length} third-party apps found`,
              data: apps,
            },
          }
        }

        case 'push': {
          if (!input.deviceId || !input.localPath || !input.remotePath) {
            return { data: { success: false, error: 'push requires deviceId, localPath, and remotePath' } }
          }
          const adbId = resolveAdbId(input.deviceId)
          if (!adbId) {
            return { data: { success: false, error: 'push is only supported for Android devices' } }
          }
          await androidBridge.pushFile(adbId, input.localPath, input.remotePath)
          return {
            data: {
              success: true,
              message: `Pushed ${input.localPath} → ${input.remotePath}`,
            },
          }
        }

        case 'pull': {
          if (!input.deviceId || !input.remotePath || !input.localPath) {
            return { data: { success: false, error: 'pull requires deviceId, remotePath, and localPath' } }
          }
          const adbId = resolveAdbId(input.deviceId)
          if (!adbId) {
            return { data: { success: false, error: 'pull is only supported for Android devices' } }
          }
          await androidBridge.pullFile(adbId, input.remotePath, input.localPath)
          return {
            data: {
              success: true,
              message: `Pulled ${input.remotePath} → ${input.localPath}`,
            },
          }
        }

        default:
          return {
            data: {
              success: false,
              error: `Unknown action: ${input.action}`,
            },
          }
      }
    } catch (err) {
      return {
        data: {
          success: false,
          error: err instanceof Error ? err.message : String(err),
        },
      }
    }
  },

  mapToolResultToToolResultBlockParam(
    output: DeviceBridgeOutput,
    toolUseID: string,
  ): ToolResultBlockParam {
    // For screenshot responses with image data
    const data = output.data as { imageBase64?: string } | undefined
    if (data?.imageBase64) {
      return {
        tool_use_id: toolUseID,
        type: 'tool_result',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/png',
              data: data.imageBase64,
            },
          },
          ...(output.message ? [{ type: 'text' as const, text: output.message }] : []),
        ],
      }
    }

    const content = output.error
      ? `Error: ${output.error}`
      : output.message ?? (output.success ? 'Action completed' : 'Action failed')

    return {
      tool_use_id: toolUseID,
      type: 'tool_result',
      content,
      is_error: !output.success,
    }
  },

  extractSearchText(output: DeviceBridgeOutput) {
    if (typeof output.data === 'string') return output.data
    return output.message ?? ''
  },
} satisfies ToolDef<InputSchema, DeviceBridgeOutput>

export const DeviceBridgeTool = buildTool(_deviceBridgeToolDef as any) as unknown as ToolDef<InputSchema, DeviceBridgeOutput>
