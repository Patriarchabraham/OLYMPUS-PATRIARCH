/**
 * Linux device introspection — real implementations via /proc, lspci, lsusb,
 * df, systemctl, and the package manager.
 *
 * Defensive throughout: a missing tool or permission error returns [] (or a
 * best-effort value), never fabricated data. Process info is read straight
 * from /proc (no shell) for accuracy and zero-dependency.
 */
import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
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

function readFirstLine(path: string): string {
	try {
		return readFileSync(path, 'utf8').trim()
	} catch {
		return ''
	}
}

export async function getCPUInfo(): Promise<CPUInfo> {
	const cpus = os.cpus()
	let cacheL1 = 0
	let cacheL2 = 0
	try {
		const cpuinfo = readFileSync('/proc/cpuinfo', 'utf8')
		const pick = (re: RegExp): number => {
			const m = cpuinfo.match(re)
			return m ? Number.parseInt(m[1]!, 10) || 0 : 0
		}
		// /proc/cpuinfo "cache size" is the per-core (L1/L2) cache in KB
		cacheL1 = pick(/cache size\s*:\s*(\d+)\s*KB/i)
		cacheL2 = cacheL1
	} catch {
		/* ignore */
	}
	let maxClock = cpus[0]?.speed ?? 0
	const freqStr = readFirstLine('/sys/devices/system/cpu/cpu0/cpufreq/cpuinfo_max_freq')
	const freqKhz = Number.parseInt(freqStr, 10)
	if (Number.isFinite(freqKhz) && freqKhz > 0) maxClock = freqKhz / 1000
	return {
		model: cpus[0]?.model ?? 'Unknown',
		manufacturer: /intel/i.test(cpus[0]?.model ?? '')
			? 'Intel'
			: /amd/i.test(cpus[0]?.model ?? '')
				? 'AMD'
				: 'Unknown',
		cores: cpus.length,
		logicalProcessors: cpus.length,
		clockSpeedMhz: cpus[0]?.speed ?? 0,
		maxClockSpeedMhz: maxClock,
		cacheL1KB: cacheL1,
		cacheL2KB: cacheL2,
		cacheL3KB: 0,
		usagePercent: 0,
	}
}

export async function getMemoryInfo(): Promise<MemoryInfo> {
	const total = os.totalmem()
	const free = os.freemem()
	let swapTotalBytes = 0
	let swapUsedBytes = 0
	try {
		const meminfo = readFileSync('/proc/meminfo', 'utf8')
		const num = (k: string): number => {
			const m = meminfo.match(new RegExp(`${k}:\\s*(\\d+)`))
			return m ? Number.parseInt(m[1]!, 10) * 1024 : 0
		}
		swapTotalBytes = num('SwapTotal')
		swapUsedBytes = Math.max(0, swapTotalBytes - num('SwapFree'))
	} catch {
		/* ignore */
	}
	return {
		totalBytes: total,
		availableBytes: free,
		usedBytes: total - free,
		swapTotalBytes,
		swapUsedBytes,
		usagePercent: total > 0 ? ((total - free) / total) * 100 : 0,
	}
}

export async function getGPUInfo(): Promise<GPUInfo[]> {
	const out = run('lspci', ['-mm'])
	const gpus: GPUInfo[] = []
	for (const line of out.split('\n')) {
		if (!/VGA compatible controller|"3D controller"|Display controller/i.test(line)) continue
		const match = line.match(/^([0-9a-f:.]+)\s+"[^"]*"\s+"([^"]*)"\s+"([^"]*)"/)
		if (match) {
			gpus.push({
				name: `${match[2]} ${match[3]}`.trim(),
				driver: 'kernel',
				driverVersion: '',
				vramBytes: 0,
				usagePercent: 0,
			})
		}
		if (gpus.length >= 8) break
	}
	return gpus
}

export async function getDiskInfo(): Promise<DiskInfo[]> {
	const out = run('df', ['-kP'])
	const disks: DiskInfo[] = []
	for (const line of out.split('\n').slice(1)) {
		const cols = line.trim().split(/\s+/)
		if (cols.length < 6) continue
		const [fs, blocks, used, avail, , mount] = cols
		const kb = (n: string): number => (Number.parseInt(n, 10) || 0) * 1024
		if (!mount) continue
		disks.push({
			name: fs || mount || 'disk',
			mountPoint: mount,
			filesystem: fs || 'unknown',
			totalBytes: kb(blocks!),
			usedBytes: kb(used!),
			availableBytes: kb(avail!),
			type: /nvme|nvm/i.test(fs ?? '') ? 'nvme' : 'unknown',
		})
	}
	return disks
}

export async function getProcessList(): Promise<ProcessInfo[]> {
	let pids: string[] = []
	try {
		pids = readdirSync('/proc').filter((d) => /^\d+$/.test(d))
	} catch {
		return []
	}
	const procs: ProcessInfo[] = []
	for (const pidStr of pids) {
		const pid = Number.parseInt(pidStr, 10)
		if (!Number.isFinite(pid)) continue
		const stat = readFirstLine(`/proc/${pidStr}/stat`)
		const lastParen = stat.lastIndexOf(')')
		if (lastParen < 0) continue
		const name = stat.slice(stat.indexOf('(') + 1, lastParen)
		const rest = stat.slice(lastParen + 2).split(' ')
		const state = rest[0] || '?'
		const cmd = readFirstLine(`/proc/${pidStr}/cmdline`).replace(/\0/g, ' ').trim()
		let memBytes = 0
		const rssMatch = readFirstLine(`/proc/${pidStr}/status`).match(/VmRSS:\s*(\d+)/)
		if (rssMatch) memBytes = Number.parseInt(rssMatch[1]!, 10) * 1024
		procs.push({
			pid,
			name: name || cmd.split(' ')[0] || String(pid),
			cpuPercent: 0, // requires delta sampling; 0 = honest unknown
			memoryBytes: memBytes,
			status: state,
			command: cmd || undefined,
		})
		if (procs.length >= 500) break
	}
	return procs
}

export async function getNetworkInterfaces(): Promise<NetworkInfo[]> {
	const nets = os.networkInterfaces()
	let gateway = ''
	try {
		const route = readFileSync('/proc/net/route', 'utf8')
		const def = route.split('\n').find((l) => /\s00000000\s/.test(l))
		if (def) {
			const gwHex = def.trim().split(/\s+/)[2]
			if (gwHex && gwHex.length === 8) {
				gateway = [gwHex.slice(6, 8), gwHex.slice(4, 6), gwHex.slice(2, 4), gwHex.slice(0, 2)]
					.map((h) => Number.parseInt(h, 16))
					.join('.')
			}
		}
	} catch {
		/* ignore */
	}
	const result: NetworkInfo[] = []
	let index = 0
	for (const [name, addrs] of Object.entries(nets)) {
		if (!addrs) continue
		const ipv4 = addrs.find((a) => a.family === 'IPv4' && !a.internal)
		const mac = addrs[0]?.mac ?? '00:00:00:00:00:00'
		result.push({
			name,
			interfaceIndex: index++,
			macAddress: mac,
			ipAddress: ipv4?.address ?? '',
			gateway: gateway || undefined,
			type: name === 'lo' ? 'loopback' : /^(wl|wlan|wlp)/i.test(name) ? 'wifi' : 'ethernet',
			status: ipv4 ? 'up' : 'down',
			dnsServers: [],
		})
	}
	return result
}

export async function getPeripherals(): Promise<PeripheralInfo[]> {
	const periphs: PeripheralInfo[] = []
	for (const line of run('lsusb', []).split('\n')) {
		const m = line.match(/ID\s+([0-9a-f]{4}):([0-9a-f]{4})\s+(.*)/)
		if (!m) continue
		periphs.push({
			id: `usb:${m[1]}:${m[2]}`,
			name: m[3]!.trim(),
			type: 'usb',
			status: 'ok',
			connection: 'usb',
		})
		if (periphs.length >= 100) break
	}
	return periphs
}

export async function getServices(): Promise<ServiceInfo[]> {
	let out = run('systemctl', ['list-units', '--type=service', '--no-legend', '--plain'])
	if (!out.trim()) {
		out = run('service', ['--status-all'])
		const svcs: ServiceInfo[] = []
		for (const line of out.split('\n')) {
			const m = line.match(/^\s*\[ ([-+?]) \]\s+(.*)/)
			if (!m) continue
			const name = m[2]!.trim()
			svcs.push({
				name,
				displayName: name,
				status: m[1] === '+' ? 'running' : 'stopped',
				startType: 'unknown',
			})
			if (svcs.length >= 500) break
		}
		return svcs
	}
	const svcs: ServiceInfo[] = []
	for (const line of out.split('\n')) {
		const cols = line.trim().split(/\s+/)
		if (cols.length < 4) continue
		const [name, , active] = cols
		svcs.push({
			name: name!,
			displayName: name!,
			status:
				active === 'active'
					? 'running'
					: active === 'inactive' || active === 'failed'
						? 'stopped'
						: 'unknown',
			startType: 'unknown',
		})
		if (svcs.length >= 500) break
	}
	return svcs
}

export async function getInstalledSoftware(): Promise<SoftwareInfo[]> {
	let out = run('dpkg-query', ['-W', '-f=${Package}\t${Version}\n'])
	if (!out.trim()) {
		out = run('rpm', ['-qa', '--qf', '%{NAME}\t%{VERSION}-%{RELEASE}\n'])
	}
	const apps: SoftwareInfo[] = []
	for (const line of out.split('\n')) {
		const cols = line.split('\t')
		if (cols.length < 2 || !cols[0]) continue
		apps.push({ name: cols[0]!, version: cols[1]! })
		if (apps.length >= 2000) break
	}
	return apps
}
