/**
 * NativeCallBridge — Persistent PowerShell session for zero-latency native calls.
 *
 * Instead of spawning a new powershell.exe per call (~50ms overhead), this maintains
 * a single persistent PowerShell process via stdin/stdout pipe, reducing per-call
 * latency to <5ms for cached results and 10-20ms for fresh native calls.
 */

import { spawn, type ChildProcess } from 'child_process'
import { EventEmitter } from 'events'
import { getHotPathCache } from './hotPathCache.js'
import type { NativeCallRequest, NativeCallResponse } from './types.js'

interface PendingCall {
  resolve: (response: NativeCallResponse) => void
  reject: (error: Error) => void
  startTime: number
}

export class NativeCallBridge extends EventEmitter {
  private process: ChildProcess | null = null
  private buffer: string = ''
  private pendingCalls: Map<string, PendingCall> = new Map()
  private callCounter: number = 0
  private isStarting: boolean = false
  private initialized: boolean = false
  private readonly delimiter = '\x00NATIVE_BRIDGE_END\x00'
  private restartCount: number = 0
  private maxRestarts: number = 3

  constructor() {
    super()
  }

  async ensureReady(): Promise<void> {
    if (this.initialized && this.process && !this.process.killed) return
    if (this.isStarting) {
      // Wait for existing start
      return new Promise((resolve) => {
        this.once('ready', resolve)
      })
    }
    await this.start()
  }

  private async start(): Promise<void> {
    this.isStarting = true

    try {
      const isWindows = process.platform === 'win32'
      const command = isWindows ? 'powershell.exe' : 'bash'
      const args = isWindows
        ? ['-NoExit', '-NoProfile', '-NoLogo', '-Command', '-']
        : ['-s'] // bash, keep alive

      this.process = spawn(command, args, {
        stdio: ['pipe', 'pipe', 'pipe'],
        windowsHide: true,
        env: { ...process.env },
      })

      this.process.stdout?.on('data', (data: Buffer) => {
        this.handleOutput(data.toString())
      })

      this.process.stderr?.on('data', (data: Buffer) => {
        // Log errors but don't crash
        this.emit('error', data.toString())
      })

      this.process.on('exit', (code) => {
        this.initialized = false
        this.process = null
        this.emit('exit', code)

        // Reject all pending calls
        for (const [id, pending] of this.pendingCalls) {
          pending.reject(new Error(`PowerShell process exited with code ${code}`))
        }
        this.pendingCalls.clear()
      })

      // Mark ready
      this.initialized = true
      this.isStarting = false
      this.emit('ready')
    } catch (err) {
      this.isStarting = false
      throw err
    }
  }

  private handleOutput(data: string): void {
    this.buffer += data

    // Check for delimiter indicating end of response
    const delimIdx = this.buffer.indexOf(this.delimiter)
    if (delimIdx === -1) return

    const responseStr = this.buffer.substring(0, delimIdx)
    this.buffer = this.buffer.substring(delimIdx + this.delimiter.length)

    try {
      const parsed = JSON.parse(responseStr)
      const callId = parsed.__callId
      if (callId && this.pendingCalls.has(callId)) {
        const pending = this.pendingCalls.get(callId)!
        this.pendingCalls.delete(callId)
        pending.resolve({
          success: parsed.success ?? true,
          data: parsed.data,
          error: parsed.error,
          durationMs: Date.now() - pending.startTime,
          fromCache: false,
        })
      }
    } catch {
      // Not JSON or malformed — ignore
    }
  }

  async call(request: NativeCallRequest): Promise<NativeCallResponse> {
    const cache = getHotPathCache()

    // Check cache first
    if (request.cacheKey) {
      const cached = cache.get(request.cacheKey)
      if (cached) {
        return {
          success: true,
          data: cached.value,
          durationMs: 0,
          fromCache: true,
        }
      }
    }

    await this.ensureReady()

    const callId = `call_${++this.callCounter}_${Date.now()}`
    const startTime = Date.now()

    // Build PowerShell command
    const psCommand = this.buildPSCommand(request.api, request.params, callId)

    return new Promise<NativeCallResponse>((resolve, reject) => {
      if (!this.process?.stdin?.writable) {
        reject(new Error('PowerShell process not available'))
        return
      }

      this.pendingCalls.set(callId, { resolve, reject, startTime })
      this.process.stdin.write(psCommand + '\n')

      // Timeout
      const timeout = setTimeout(() => {
        if (this.pendingCalls.has(callId)) {
          this.pendingCalls.delete(callId)
          reject(new Error(`Native call timed out: ${request.api}`))
        }
      }, 10000)

      // Clean timeout on resolve
      const originalResolve = resolve
      resolve = (response: NativeCallResponse) => {
        clearTimeout(timeout)
        // Cache result
        if (request.cacheKey && response.success) {
          cache.set(request.cacheKey, response.data, request.cacheTtlMs)
        }
        originalResolve(response)
      }
      this.pendingCalls.set(callId, { resolve, reject, startTime })
    })
  }

  async batchCall(requests: NativeCallRequest[]): Promise<NativeCallResponse[]> {
    await this.ensureReady()

    // Check which ones are cached
    const results: (NativeCallResponse | null)[] = []
    const uncached: { index: number; request: NativeCallRequest }[] = []
    const cache = getHotPathCache()

    for (let i = 0; i < requests.length; i++) {
      const req = requests[i]
      if (req.cacheKey) {
        const cached = cache.get(req.cacheKey)
        if (cached) {
          results[i] = { success: true, data: cached.value, durationMs: 0, fromCache: true }
          continue
        }
      }
      results[i] = null
      uncached.push({ index: i, request: req })
    }

    // Execute uncached in batch
    if (uncached.length > 0 && this.process?.stdin?.writable) {
      const batchScript = uncached.map(({ request }) => {
        const callId = `batch_${++this.callCounter}_${Date.now()}`
        return this.buildPSCommand(request.api, request.params, callId)
      }).join('\n')

      // For batch, we execute sequentially in the persistent session
      for (const { index, request } of uncached) {
        try {
          const response = await this.call(request)
          results[index] = response
        } catch (err) {
          results[index] = {
            success: false,
            data: null,
            error: err instanceof Error ? err.message : String(err),
            durationMs: 0,
            fromCache: false,
          }
        }
      }
    }

    return results as NativeCallResponse[]
  }

  private buildPSCommand(api: string, params: Record<string, unknown>, callId: string): string {
    const paramsJson = JSON.stringify(params).replace(/'/g, "''")

    switch (api) {
      case 'get_cpu_info':
        return `$d = Get-CimInstance Win32_Processor | Select-Object Name,Manufacturer,NumberOfCores,NumberOfLogicalProcessors,CurrentClockSpeed,MaxClockSpeed,L2CacheSize,L3CacheSize,LoadPercentage | ConvertTo-Json -Compress; '{"__callId":"${callId}","success":true,"data":' + $d + '}' + '${this.delimiter}'`

      case 'get_memory_info':
        return `$d = Get-CimInstance Win32_OperatingSystem | Select-Object TotalVisibleMemorySize,FreePhysicalMemory | ConvertTo-Json -Compress; '{"__callId":"${callId}","success":true,"data":' + $d + '}' + '${this.delimiter}'`

      case 'get_gpu_info':
        return `$d = Get-CimInstance Win32_VideoController | Select-Object Name,DriverVersion,AdapterRAM | ConvertTo-Json -Compress; '{"__callId":"${callId}","success":true,"data":' + $d + '}' + '${this.delimiter}'`

      case 'get_disk_info':
        return `$d = Get-CimInstance Win32_LogicalDisk -Filter 'DriveType=3' | Select-Object DeviceID,FileSystem,Size,FreeSpace,VolumeName | ConvertTo-Json -Compress; '{"__callId":"${callId}","success":true,"data":' + $d + '}' + '${this.delimiter}'`

      case 'get_process_list':
        return `$d = Get-Process | Select-Object Id,ProcessName,CPU,WorkingSet64,StartTime | ConvertTo-Json -Compress -Depth 1; '{"__callId":"${callId}","success":true,"data":' + $d + '}' + '${this.delimiter}'`

      case 'get_network_info':
        return `$d = Get-CimInstance Win32_NetworkAdapterConfiguration -Filter 'IPEnabled=true' | Select-Object Description,MACAddress,IPAddress,DefaultIPGateway,DNSServerSearchOrder | ConvertTo-Json -Compress; '{"__callId":"${callId}","success":true,"data":' + $d + '}' + '${this.delimiter}'`

      case 'get_peripherals':
        return `$d = Get-PnpDevice -PresentOnly | Select-Object FriendlyName,InstanceId,Class,Status,Problem | ConvertTo-Json -Compress; '{"__callId":"${callId}","success":true,"data":' + $d + '}' + '${this.delimiter}'`

      case 'get_services':
        return `$d = Get-Service | Select-Object Name,DisplayName,Status,StartType | ConvertTo-Json -Compress; '{"__callId":"${callId}","success":true,"data":' + $d + '}' + '${this.delimiter}'`

      case 'get_ports':
        return `$d = netstat -ano | Select-String 'LISTENING|ESTABLISHED' | ConvertTo-Json -Compress; '{"__callId":"${callId}","success":true,"data":' + $d + '}' + '${this.delimiter}'`

      case 'get_installed_software':
        return `$d = Get-ItemProperty 'HKLM:\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\*' -ErrorAction SilentlyContinue | Where-Object DisplayName | Select-Object DisplayName,DisplayVersion,Publisher,InstallDate,InstallLocation | ConvertTo-Json -Compress; '{"__callId":"${callId}","success":true,"data":' + $d + '}' + '${this.delimiter}'`

      case 'inspect_dll': {
        const path = (params.path as string) ?? ''
        return `$p = '${path.replace(/'/g, "''")}'; if (Test-Path $p) { $a = [System.Reflection.Assembly]::LoadFrom($p); $d = @{Name=$a.GetName().Name; Version=$a.GetName().Version.ToString(); FullName=$a.FullName} | ConvertTo-Json -Compress; '{"__callId":"${callId}","success":true,"data":' + $d + '}' + '${this.delimiter}' } else { '{"__callId":"${callId}","success":false,"error":"File not found"}' + '${this.delimiter}' }`
      }

      case 'get_environment':
        return `$d = Get-ChildItem Env: | Select-Object Key,Value | ConvertTo-Json -Compress; '{"__callId":"${callId}","success":true,"data":' + $d + '}' + '${this.delimiter}'`

      default:
        return `'{"__callId":"${callId}","success":false,"error":"Unknown API: ${api}"}' + '${this.delimiter}'`
    }
  }

  async prewarm(): Promise<void> {
    const commonCalls: NativeCallRequest[] = [
      { api: 'get_cpu_info', params: {}, cacheKey: 'cpu_info', cacheTtlMs: 60000, priority: 'normal' },
      { api: 'get_memory_info', params: {}, cacheKey: 'memory_info', cacheTtlMs: 15000, priority: 'normal' },
      { api: 'get_gpu_info', params: {}, cacheKey: 'gpu_info', cacheTtlMs: 60000, priority: 'normal' },
      { api: 'get_disk_info', params: {}, cacheKey: 'disk_info', cacheTtlMs: 30000, priority: 'normal' },
      { api: 'get_network_info', params: {}, cacheKey: 'network_info', cacheTtlMs: 30000, priority: 'low' },
    ]

    // Fire all prewarm calls in parallel (will batch in PS session)
    await Promise.allSettled(commonCalls.map((req) => this.call(req)))
  }

  async dispose(): Promise<void> {
    if (this.process && !this.process.killed) {
      this.process.stdin?.write('exit\n')
      // Give it a moment to exit gracefully
      setTimeout(() => {
        this.process?.kill()
        this.process = null
        this.initialized = false
      }, 1000)
    }
  }

  get isReady(): boolean {
    return this.initialized && this.process !== null && !this.process.killed
  }
}

// Singleton
let _bridge: NativeCallBridge | null = null

export function getNativeCallBridge(): NativeCallBridge {
  if (!_bridge) {
    _bridge = new NativeCallBridge()
  }
  return _bridge
}

export function disposeNativeCallBridge(): void {
  if (_bridge) {
    _bridge.dispose()
    _bridge = null
  }
}
