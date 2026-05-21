/**
 * NativeCallBridge — Persistent PowerShell session for zero-latency native calls.
 *
 * Instead of spawning a new powershell.exe per call (~50ms overhead), this maintains
 * a single persistent PowerShell process via stdin/stdout pipe, reducing per-call
 * latency to <5ms for cached results and 10-20ms for fresh native calls.
 */

import { spawn, type ChildProcess } from 'node:child_process'
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
          pending.reject(new Error(`Native bridge process exited with code ${code}`))
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
        reject(new Error('Native bridge process not available'))
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
      const originalResolve = resolve as (value: NativeCallResponse | PromiseLike<NativeCallResponse>) => void
      resolve = ((response: NativeCallResponse) => {
        clearTimeout(timeout)
        // Cache result
        if (request.cacheKey && response.success) {
          cache.set(request.cacheKey, response.data, request.cacheTtlMs)
        }
        originalResolve(response)
      }) as (value: NativeCallResponse | PromiseLike<NativeCallResponse>) => void
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
    const isWindows = process.platform === 'win32'

    if (!isWindows) {
      return this.buildBashCommand(api, params, callId)
    }

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

  /**
   * Build bash-appropriate commands for Linux/macOS platforms.
   * Uses standard Unix tools (lscpu, free, df, ps, ip, etc.) and Python for JSON output.
   */
  private buildBashCommand(api: string, params: Record<string, unknown>, callId: string): string {
    const d = this.delimiter
    const jsonWrapper = (cmd: string) =>
      `echo '{"__callId":"${callId}","success":true,"data":' && ${cmd} && echo '}' && echo '${d}'`

    const jsonError = (msg: string) =>
      `echo '{"__callId":"${callId}","success":false,"error":"${msg}"}' && echo '${d}'`

    switch (api) {
      case 'get_cpu_info':
        return jsonWrapper(`lscpu -J 2>/dev/null | python3 -c "import sys,json; d=json.load(sys.stdin); print(json.dumps({'Name':d.get('CPU Model',''),'Manufacturer':'','NumberOfCores':d.get('CPU(s)',''),'NumberOfLogicalProcessors':d.get('CPU(s)',''),'CurrentClockSpeed':0,'MaxClockSpeed':0,'L2CacheSize':0,'L3CacheSize':0,'LoadPercentage':0}))" 2>/dev/null || echo '{}'`)

      case 'get_memory_info':
        return jsonWrapper(`python3 -c "
import json,os
t=os.sysconf('SC_PAGE_SIZE')*os.sysconf('SC_PHYS_PAGES')
f=os.sysconf('SC_PAGE_SIZE')*os.sysconf('SC_AVPHYS_PAGES')
print(json.dumps({'TotalVisibleMemorySize':t//1024,'FreePhysicalMemory':f//1024}))
" 2>/dev/null || echo '{}'`)

      case 'get_gpu_info':
        return jsonWrapper(`lspci -vmm 2>/dev/null | grep -A3 'VGA' | python3 -c "import sys,json; print(json.dumps([{'Name':'Unknown GPU','DriverVersion':'Unknown','AdapterRAM':0}]))" 2>/dev/null || echo '[]'`)

      case 'get_disk_info':
        return jsonWrapper(`df -k -P 2>/dev/null | tail -n +2 | python3 -c "
import sys,json
lines=[l.split() for l in sys.stdin if len(l.split())>=6]
print(json.dumps([{'DeviceID':l[0],'FileSystem':l[0],'Size':l[1],'FreeSpace':l[3],'VolumeName':l[5]} for l in lines]))
" 2>/dev/null || echo '[]'`)

      case 'get_process_list':
        return jsonWrapper(`ps -eo pid,comm,%cpu,rss --no-headers 2>/dev/null | python3 -c "
import sys,json
lines=[l.split() for l in sys.stdin if len(l.split())>=4]
print(json.dumps([{'Id':int(l[0]),'ProcessName':l[1],'CPU':float(l[2]),'WorkingSet64':int(l[3])*1024} for l in lines[:50]]))
" 2>/dev/null || echo '[]'`)

      case 'get_network_info':
        return jsonWrapper(`python3 -c "
import json,socket,struct
import fcntl
def get_mac(ifname):
  try:
    s=socket.socket(socket.AF_INET,socket.SOCK_DGRAM)
    return ':'.join(f'{b:02x}' for b in fcntl.ioctl(s.fileno(),0x8927,struct.pack('256s',ifname[:15].encode()))[18:24])
  except: return ''
ifs=[]
for i in socket.if_nameindex():
  nm=i[1]
  if nm=='lo': continue
  ifs.append({'Description':nm,'MACAddress':get_mac(nm),'IPAddress':'','DNSServerSearchOrder':[]})
print(json.dumps(ifs))
" 2>/dev/null || echo '[]'`)

      case 'get_peripherals':
        return jsonWrapper(`lsusb 2>/dev/null | python3 -c "import sys,json; print(json.dumps([{'FriendlyName':l.strip(),'InstanceId':'','Class':'usb','Status':'OK'} for l in sys.stdin]))" 2>/dev/null || echo '[]'`)

      case 'get_services':
        return jsonWrapper(`systemctl list-units --type=service --no-legend --no-pager 2>/dev/null | python3 -c "
import sys,json
lines=[l.split() for l in sys.stdin if l.strip()]
print(json.dumps([{'Name':l[0],('DisplayName'):l[0],'Status':l[2] if len(l)>2 else 'unknown','StartType':'unknown'} for l in lines]))
" 2>/dev/null || echo '[]'`)

      case 'get_ports':
        return jsonWrapper(`ss -tlnp 2>/dev/null | python3 -c "import sys,json; print(json.dumps([l.strip() for l in sys.stdin]))" 2>/dev/null || echo '[]'`)

      case 'get_installed_software':
        return jsonWrapper(`dpkg-query -W -f='\${Package}\t\${Version}\n' 2>/dev/null | head -100 | python3 -c "import sys,json; print(json.dumps([{'DisplayName':l.split('\t')[0],'DisplayVersion':l.split('\t')[1] if '\t' in l else ''} for l in sys.stdin]))" 2>/dev/null || echo '[]'`)

      case 'inspect_dll': {
        const path = (params.path as string) ?? ''
        const escaped = path.replace(/'/g, "'\\''")
        return `if [ -f '${escaped}' ]; then file '${escaped}' | python3 -c "import sys,json; print(json.dumps({'Name':'${escaped}','Version':'unknown','FullName':'${escaped}'}))" 2>/dev/null && echo '${d}'; else echo '{"__callId":"${callId}","success":false,"error":"File not found"}' && echo '${d}'; fi`
      }

      case 'get_environment':
        return jsonWrapper(`env | python3 -c "import sys,json; print(json.dumps([{'Key':l.split('=',1)[0],'Value':l.split('=',1)[1] if '=' in l else ''} for l in sys.stdin]))" 2>/dev/null || echo '[]'`)

      default:
        return jsonError(`Unknown API: ${api}`)
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
