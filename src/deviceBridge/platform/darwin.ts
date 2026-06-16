/**
 * macOS (darwin) device introspection — real implementations via native tools.
 *
 * Uses system_profiler (JSON), ps, launchctl, df, and os.networkInterfaces().
 * Every call is defensive: a failing/missing tool returns [] (or a best-effort
 * value), never fabricated data. Commands are bounded by a timeout so a hung
 * tool can't block introspection.
 */
import { execFileSync } from 'node:child_process'
import os from 'node:os'
import type {
	CPUInfo,
	DiskInfo,
	GPUInfo,
	MemoryInfo,
	NetworkInfo,
	PeripheralInfo,
	ProcessInfo,
	ServiceInfo,
	SoftwareInfo,
} from '../types.js'

const TIMEOUT_MS = 8000

/** Run a command synchronously and return stdout (empty string on any failure). */
function run(cmd: string, args: string[]): string {
	try {
		return execFileSync(cmd, args, {
			encoding: 'utf8',
			timeout: TIMEOUT_MS,
			maxBuffer: 16 * 1024 * 1024,
			stdio: ['ignore', 'pipe', 'ignore'],
		})
	} catch {
		return ''
	}
}

/** Run a command that emits JSON, parsed defensively. */
function runJson<T>(cmd: string, args: string[]): T | null {
	const out = run(cmd, args)
	if (!out.trim()) return null
	try {
		return JSON.parse(out) as T
	} catch {
		return null
	}
}

export async function getCPUInfo(): Promise<CPUInfo> {
	const cpus = os.cpus()
	// sysctl for cache sizes (per-core L2/L3 in bytes)
	const cache = (what: string): number => {
		const v = run('sysctl', ['-n', what])
		return Number.parseInt(v.trim(), 10) || 0
	}
	return {
		model: cpus[0]?.model ?? 'Unknown',
		manufacturer: 'Apple',
		cores: cpus.length,
		logicalProcessors: cpus.length,
		clockSpeedMhz: cpus[0]?.speed ?? 0,
		maxClockSpeedMhz: cpus[0]?.speed ?? 0,
		// macOS doesn't expose per-core L1 cleanly via sysctl name; 0 = unknown
		cacheL1KB: 0,
		cacheL2KB: Math.round(cache('hw.l2cachesize') / 1024),
		cacheL3KB: Math.round(cache('hw.l3cachesize') / 1024),
		usagePercent: 0,
	}
}

export async function getMemoryInfo(): Promise<MemoryInfo> {
	const total = os.totalmem()
	const free = os.freemem()
	// vm_stat gives page counts; fall back to 0 swap if unavailable
	let swapTotalBytes = 0
	let swapUsedBytes = 0
	const sysctl = run('sysctl', ['-n', 'vm.swapusage'])
	// e.g. "total = 2048.00M  used = 12.50M  free = 2035.50M  (encrypted)"
	const totalMatch = sysctl.match(/total\s*=\s*([\d.]+)([KMGT])/i)
	const usedMatch = sysctl.match(/used\s*=\s*([\d.]+)([KMGT])/i)
	const toBytes = (n: number, u: string): number =>
		n * (u === 'T' ? 1024 ** 4 : u === 'G' ? 1024 ** 3 : u === 'M' ? 1024 ** 2 : 1024)
	if (totalMatch?.[1] && totalMatch[2]) swapTotalBytes = toBytes(+totalMatch[1], totalMatch[2])
	if (usedMatch?.[1] && usedMatch[2]) swapUsedBytes = toBytes(+usedMatch[1], usedMatch[2])
	return {
		totalBytes: total,
		availableBytes: free,
		usedBytes: total - free,
		swapTotalBytes,
		swapUsedBytes,
		usagePercent: total > 0 ? ((total - free) / total) * 100 : 0,
	}
}

type SystemProfilerReport = Record<string, Array<Record<string, unknown>>>

/** Pull the array of items for a given system_profiler data type. */
function profilerItems(dataType: string): Array<Record<string, unknown>> {
	const report = runJson<SystemProfilerReport>('system_profiler', [
		dataType,
		'-json',
		'-detailLevel',
		'mini',
	])
	if (!report) return []
	const items = report[dataType]
	return Array.isArray(items) ? items : []
}

/** Recursively walk a system_profiler item tree collecting leaf device objects. */
function walkDevices(items: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
	const out: Array<Record<string, unknown>> = []
	for (const item of items) {
		out.push(item)
		for (const v of Object.values(item)) {
			if (Array.isArray(v)) {
				out.push(...walkDevices(v as Array<Record<string, unknown>>))
			}
		}
	}
	return out
}

const str = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v))

export async function getGPUInfo(): Promise<GPUInfo[]> {
	const items = walkDevices(profilerItems('SPDisplaysDataType'))
	const gpus: GPUInfo[] = []
	for (const d of items) {
		const name = str(d._name) || str(d.sppci_model)
		if (!name || /Graphics\/Displays|spdisplays/i.test(name)) continue
		const vramRaw = str(d.sppci_vram) || str(d.spdisplays_vram_shared)
		const vramMatch = vramRaw.match(/([\d.]+)\s*([TGMK])/i)
		const vramBytes = vramMatch
			? +vramMatch[1]! *
				(vramMatch[2] === 'T'
					? 1024 ** 4
					: vramMatch[2] === 'G'
						? 1024 ** 3
						: vramMatch[2] === 'M'
							? 1024 ** 2
							: 1024)
			: 0
		gpus.push({
			name,
			driver: str(d.sppci_driver) || 'metal',
			driverVersion: str(d.spdisplays_metal) || str(d.sppci_drv_version),
			vramBytes,
			usagePercent: 0,
		})
		if (gpus.length >= 8) break
	}
	return gpus
}

export async function getDiskInfo(): Promise<DiskInfo[]> {
	// df -k: Filesystem 1024-blocks Used Available Capacity Mounted-on
	const out = run('df', ['-kP'])
	const disks: DiskInfo[] = []
	for (const line of out.split('\n').slice(1)) {
		const cols = line.trim().split(/\s+/)
		if (cols.length < 6) continue
		const [fs, blocks, used, avail, , mount] = cols
		const kb = (n: string): number => (Number.parseInt(n, 10) || 0) * 1024
		if (!mount || mount === 'none') continue
		disks.push({
			name: fs || mount || 'disk',
			mountPoint: mount,
			filesystem: fs || 'unknown',
			totalBytes: kb(blocks!),
			usedBytes: kb(used!),
			availableBytes: kb(avail!),
			type: 'unknown',
		})
	}
	return disks
}

export async function getProcessList(): Promise<ProcessInfo[]> {
	// ps aux: USER PID %CPU %MEM VSZ RSS TT STAT STARTED TIME COMMAND
	const out = run('ps', ['aux'])
	const procs: ProcessInfo[] = []
	for (const line of out.split('\n').slice(1)) {
		const cols = line.trim().split(/\s+/)
		if (cols.length < 11) continue
		const pid = Number.parseInt(cols[1]!, 10)
		if (!Number.isFinite(pid)) continue
		procs.push({
			pid,
			name: cols.slice(10).join(' ').split('/').pop() || cols[10] || '',
			cpuPercent: Number.parseFloat(cols[2]!) || 0,
			memoryBytes: (Number.parseInt(cols[5]!, 10) || 0) * 1024, // RSS in KB
			status: cols[7] || 'unknown',
			user: cols[0],
			command: cols.slice(10).join(' '),
		})
		if (procs.length >= 500) break
	}
	return procs
}

export async function getNetworkInterfaces(): Promise<NetworkInfo[]> {
	// Portable: os.networkInterfaces() gives real IPs/MACs without shell.
	const nets = os.networkInterfaces()
	const result: NetworkInfo[] = []
	let index = 0
	for (const [name, addrs] of Object.entries(nets)) {
		if (!addrs) continue
		const ipv4 = addrs.find((a) => a.family === 'IPv4' && !a.internal)
		const mac = addrs[0]?.mac ?? '00:00:00:00:00:00'
		const isLoop = name === 'lo0' || name.startsWith('lo')
		result.push({
			name,
			interfaceIndex: index++,
			macAddress: mac,
			ipAddress: ipv4?.address ?? '',
			type: isLoop
				? 'loopback'
				: name.startsWith('en') && /wl|wi/i.test(name)
					? 'wifi'
					: 'ethernet',
			status: ipv4 ? 'up' : 'down',
			dnsServers: [],
		})
	}
	return result
}

export async function getPeripherals(): Promise<PeripheralInfo[]> {
	const items = walkDevices([
		...profilerItems('SPUSBDataType'),
		...profilerItems('SPBluetoothDataType'),
	])
	const periphs: PeripheralInfo[] = []
	for (const d of items) {
		const name = str(d._name)
		if (!name) continue
		const isUSB = '_name' in d && 'spusb_data' in d
		periphs.push({
			id: str(d._name) + str(d.spusb_vendor_id),
			name,
			type: str(d.spusb_device_type || d._name).toLowerCase() || 'device',
			manufacturer: str(d.spusb_manufacturer) || undefined,
			status: 'ok',
			connection: isUSB ? 'usb' : 'bluetooth',
		})
		if (periphs.length >= 100) break
	}
	return periphs
}

export async function getServices(): Promise<ServiceInfo[]> {
	// launchctl list: PID Status Label
	const out = run('launchctl', ['list'])
	const svcs: ServiceInfo[] = []
	for (const line of out.split('\n').slice(1)) {
		const cols = line.trim().split(/\s+/)
		if (cols.length < 3) continue
		const pid = cols[0]
		const status = cols[1]
		const label = cols.slice(2).join(' ')
		if (!label) continue
		svcs.push({
			name: label,
			displayName: label.split('.').pop() || label,
			status: pid !== '-' && pid !== '0' ? 'running' : status === '0' ? 'stopped' : 'unknown',
			startType: 'unknown',
			pid: pid !== '-' ? Number.parseInt(pid, 10) || undefined : undefined,
		})
		if (svcs.length >= 500) break
	}
	return svcs
}

export async function getInstalledSoftware(): Promise<SoftwareInfo[]> {
	const items = profilerItems('SPApplicationsDataType')
	const apps: SoftwareInfo[] = []
	for (const d of items) {
		const name = str(d._name)
		if (!name) continue
		apps.push({
			name,
			version: str(d.spapplications_version) || str(d.version),
			publisher: str(d.spapplications_obtained_from) || undefined,
			installDate: str(d.spapplications_signed_by) || undefined,
			installLocation: str(d.spapplications_path) || undefined,
		})
		if (apps.length >= 1000) break
	}
	return apps
}
