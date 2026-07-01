import { resolve } from 'node:path'
import { BrowserWindow, ipcMain } from 'electron'

/**
 * Terminal IPC handler — wraps node-pty to provide a real PTY shell inside
 * the xterm.js renderer panel.
 *
 * Channels (main ↔ renderer):
 *   invoke  'terminal:spawn'  (cwd: string) → void
 *   send    'terminal:input'  (data: string)
 *   send    'terminal:resize' (cols: number, rows: number)
 *   send    'terminal:kill'
 *   receive 'terminal:data'   (data: string)
 *   receive 'terminal:exit'   (code: number | null)
 */

// node-pty is a native module — import lazily so the app still starts even if
// it hasn't been rebuilt for the current Electron version yet.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type IPty = any

let pty: typeof import('node-pty') | null = null
let activePty: IPty | null = null

function loadPty(): typeof import('node-pty') | null {
	if (pty) return pty
	try {
		// Resolve relative to the IDE project root so Electron can find the
		// prebuilt .node binary inside olympuz-ide/node_modules/node-pty.
		const ptyPath = resolve(__dirname, '..', '..', 'node_modules', 'node-pty')
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		pty = require(ptyPath) as typeof import('node-pty')
		return pty
	} catch (err) {
		console.warn('[olympuz-ide/terminal] node-pty not available:', err)
		return null
	}
}

function broadcast(channel: string, ...args: unknown[]): void {
	for (const w of BrowserWindow.getAllWindows()) {
		if (!w.isDestroyed()) {
			w.webContents.send(channel, ...args)
		}
	}
}

function getShell(): { file: string; args: string[] } {
	if (process.platform === 'win32') {
		// Prefer PowerShell, fall back to cmd.exe
		return {
			file: process.env['ComSpec'] ?? 'powershell.exe',
			args: [],
		}
	}
	return {
		file: process.env['SHELL'] ?? '/bin/bash',
		args: ['--login'],
	}
}

function killActive(): void {
	if (activePty) {
		try {
			activePty.kill()
		} catch {
			// ignore — PTY may already be dead
		}
		activePty = null
	}
}

export function registerTerminalIpc(): void {
	// ── terminal:spawn ────────────────────────────────────────────────────────
	ipcMain.handle('terminal:spawn', (_evt, cwd: string) => {
		killActive()

		const nodePty = loadPty()
		if (!nodePty) {
			console.warn(
				'[olympuz-ide/terminal] node-pty unavailable — terminal panel will be non-functional. ' +
					'Run `npm rebuild` inside olympuz-ide/.',
			)
			// Send a friendly message to xterm so the user sees something
			broadcast(
				'terminal:data',
				'\r\n\x1b[33m[Olympuz IDE]\x1b[0m node-pty not found. ' +
					'Run `npm rebuild` inside the olympuz-ide directory and restart.\r\n',
			)
			return
		}

		const { file, args } = getShell()
		const spawnCwd = cwd || process.env.USERPROFILE || process.cwd()

		try {
			const ptyProcess: IPty = nodePty.spawn(file, args, {
				name: 'xterm-color',
				cols: 120,
				rows: 30,
				cwd: spawnCwd,
				env: { ...process.env } as Record<string, string>,
			})

			activePty = ptyProcess

			ptyProcess.onData((data: string) => {
				broadcast('terminal:data', data)
			})

			ptyProcess.onExit(({ exitCode }: { exitCode: number }) => {
				if (activePty === ptyProcess) activePty = null
				broadcast('terminal:exit', exitCode)
			})
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : String(err)
			console.error('[olympuz-ide/terminal] spawn failed:', msg)
			broadcast(
				'terminal:data',
				`\r\n\x1b[31m[Olympuz IDE] Terminal spawn failed: ${msg}\x1b[0m\r\n`,
			)
		}
	})

	// ── terminal:input ────────────────────────────────────────────────────────
	ipcMain.on('terminal:input', (_evt, data: string) => {
		if (activePty) {
			try {
				activePty.write(data)
			} catch {
				// PTY closed between events — ignore
			}
		}
	})

	// ── terminal:resize ───────────────────────────────────────────────────────
	ipcMain.on('terminal:resize', (_evt, cols: number, rows: number) => {
		if (activePty) {
			try {
				activePty.resize(Math.max(1, Math.floor(cols)), Math.max(1, Math.floor(rows)))
			} catch {
				// ignore
			}
		}
	})

	// ── terminal:kill ─────────────────────────────────────────────────────────
	ipcMain.on('terminal:kill', () => {
		killActive()
	})
}

export function cleanupTerminal(): void {
	killActive()
}
