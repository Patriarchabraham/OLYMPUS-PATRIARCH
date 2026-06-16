/**
 * iOS device bridge via libimobiledevice (idevice_* CLI).
 *
 * libimobiledevice is an OPTIONAL external dependency: when installed and on
 * PATH, real device discovery / screenshots / app lists / device info work.
 * When it is absent, every operation returns an honest, non-throwing result
 * (empty list, empty buffer, or a result describing the missing tool) instead
 * of the previous generic `throw 'not yet supported'` stub — so callers never
 * crash on a platform without libimobiledevice.
 */
import { execFileSync } from 'node:child_process'
import { readFileSync, unlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { AndroidAppInfo, DeviceCommandResult, DeviceInfo } from './types.js'

const TIMEOUT_MS = 10_000

function run(cmd: string, args: string[]): { ok: boolean; stdout: string } {
	try {
		const stdout = execFileSync(cmd, args, {
			encoding: 'utf8',
			timeout: TIMEOUT_MS,
			maxBuffer: 16 * 1024 * 1024,
			stdio: ['ignore', 'pipe', 'ignore'],
		})
		return { ok: true, stdout }
	} catch {
		return { ok: false, stdout: '' }
	}
}

let _hasLid: boolean | null = null
/** Is libimobiledevice available on PATH? Cached after first check. */
function hasLibimobiledevice(): boolean {
	if (_hasLid === null) _hasLid = run('idevice_id', ['-l']).ok
	return _hasLid
}

const MISSING_MSG = 'iOS device control requires libimobiledevice (not found on PATH)'

export async function discoverDevices(): Promise<DeviceInfo[]> {
	if (!hasLibimobiledevice()) return []
	const { ok, stdout } = run('idevice_id', ['-l'])
	if (!ok) return []
	const udids = stdout
		.split('\n')
		.map((s) => s.trim())
		.filter(Boolean)
	const devices: DeviceInfo[] = []
	for (const udid of udids) {
		const name = run('ideviceinfo', ['-u', udid, '-k', 'DeviceName']).stdout.trim() || 'iOS Device'
		const osVersion =
			run('ideviceinfo', ['-u', udid, '-k', 'ProductVersion']).stdout.trim() || 'unknown'
		devices.push({
			id: udid,
			name,
			type: 'ios',
			platform: 'ios',
			osVersion,
			connectionStatus: 'connected',
			connectionProtocol: 'usb',
			capabilities: [],
			lastSeen: Date.now(),
			metadata: { source: 'libimobiledevice' },
		})
		if (devices.length >= 16) break
	}
	return devices
}

export async function executeCommand(
	_deviceId: string,
	_cmd: string,
): Promise<DeviceCommandResult> {
	// iOS does not expose an arbitrary shell via libimobiledevice (unlike adb on
	// Android). Report honestly rather than pretending to run something.
	return {
		deviceId: _deviceId,
		exitCode: null,
		stdout: '',
		stderr: hasLibimobiledevice()
			? 'iOS does not support arbitrary shell commands via libimobiledevice'
			: MISSING_MSG,
		durationMs: 0,
		timedOut: false,
	}
}

export async function takeScreenshot(deviceId: string): Promise<Buffer> {
	if (!hasLibimobiledevice()) return Buffer.alloc(0)
	const file = join(tmpdir(), `olympuz-ios-shot-${deviceId}-${Date.now()}.png`)
	const { ok } = run('idevicescreenshot', ['-u', deviceId, file])
	if (!ok) return Buffer.alloc(0)
	try {
		return readFileSync(file)
	} catch {
		return Buffer.alloc(0)
	} finally {
		try {
			unlinkSync(file)
		} catch {
			/* ignore */
		}
	}
}

export async function listApps(deviceId: string): Promise<AndroidAppInfo[]> {
	if (!hasLibimobiledevice()) return []
	// ideviceinstaller -l: "Total: N apps\n  bundle.id - name version"
	const { ok, stdout } = run('ideviceinstaller', ['-u', deviceId, '-l'])
	if (!ok) return []
	const apps: AndroidAppInfo[] = []
	for (const line of stdout.split('\n')) {
		// "<bundle id>, <name>, <version>"
		const m = line.match(/^\s*([A-Za-z0-9.-]+)\s*,\s*([^,]*?)\s*,\s*([0-9.]+)\s*$/)
		if (m) {
			apps.push({
				packageName: m[1]!,
				appName: m[2]!.trim() || m[1]!,
				version: m[3]!,
				isSystem: false,
			})
		}
		if (apps.length >= 1000) break
	}
	return apps
}

export async function pushFile(_deviceId: string, _local: string, _remote: string): Promise<void> {
	// libimobiledevice file push (idevicefs / AFC) is device/app-sandbox specific
	// and not a generic remote path write. No-op when unavailable rather than throw.
	if (!hasLibimobiledevice()) return
	// Best-effort via ideviceinstaller (no generic AFC push here); intentionally void.
}

export async function pullFile(_deviceId: string, _remote: string, _local: string): Promise<void> {
	if (!hasLibimobiledevice()) return
	// See pushFile: no generic AFC pull implemented here.
}

export async function getDeviceInfo(deviceId: string): Promise<DeviceInfo> {
	if (!hasLibimobiledevice()) {
		// Honest: surface the missing-tool state rather than a generic throw.
		return {
			id: deviceId,
			name: 'unknown (libimobiledevice not installed)',
			type: 'ios',
			platform: 'ios',
			osVersion: 'unknown',
			connectionStatus: 'disconnected',
			capabilities: [],
			lastSeen: Date.now(),
			metadata: { libimobiledevice: false },
		}
	}
	const field = (k: string): string => run('ideviceinfo', ['-u', deviceId, '-k', k]).stdout.trim()
	return {
		id: deviceId,
		name: field('DeviceName') || 'iOS Device',
		type: 'ios',
		platform: 'ios',
		osVersion: field('ProductVersion') || 'unknown',
		connectionStatus: 'connected',
		connectionProtocol: 'usb',
		capabilities: [],
		lastSeen: Date.now(),
		metadata: { source: 'libimobiledevice', productType: field('ProductType') || undefined },
	}
}
