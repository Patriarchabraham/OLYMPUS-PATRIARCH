import { type ChildProcess, spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { BrowserWindow, ipcMain } from 'electron'
import { getWorkspaceRoot } from './fs'

/**
 * AI IPC handler — bridges the renderer to the Olympuz CLI/SDK.
 *
 * Channels:
 *   invoke  'ai:prompt'  → { cwd, message, sessionId?, systemPrompt?, model? }
 *   send    'ai:abort'   → abort in-flight query
 *   receive 'ai:message' → streaming message chunks
 *   receive 'ai:status'  → 'idle' | 'running' | 'error'
 */

interface PromptOpts {
	cwd: string
	message: string
	sessionId?: string
	systemPrompt?: string
	model?: string
}

let activeProcess: ChildProcess | null = null
let activeSessionId: string | null = null

function broadcast(channel: string, ...args: unknown[]): void {
	for (const w of BrowserWindow.getAllWindows()) {
		if (!w.isDestroyed()) {
			w.webContents.send(channel, ...args)
		}
	}
}

function resolveOlympuzBin(): string {
	// packaged: resources/bin/olympuz
	const packaged = resolve(process.resourcesPath, 'bin', 'olympuz')
	if (existsSync(packaged)) return packaged
	if (existsSync(packaged + '.cmd')) return packaged + '.cmd'

	// dev: ../../bin/olympuz (from olympuz-ide/out/main)
	const devBin = resolve(__dirname, '..', '..', '..', 'bin', 'olympuz')
	if (existsSync(devBin)) return devBin
	if (existsSync(devBin + '.cmd')) return devBin + '.cmd'

	// fallback: assume `olympuz` is on PATH
	return process.platform === 'win32' ? 'olympuz.cmd' : 'olympuz'
}

function makeCwd(requested: string): string {
	const ws = getWorkspaceRoot()
	if (ws) return ws
	return requested || process.cwd()
}

function abortActive(): void {
	if (activeProcess) {
		try {
			activeProcess.kill()
		} catch {
			// ignore
		}
		activeProcess = null
		activeSessionId = null
	}
}

export function registerAiIpc(): void {
	// ── ai:prompt ────────────────────────────────────────────────────────────
	ipcMain.handle('ai:prompt', async (_evt, opts: PromptOpts) => {
		// Abort any existing run first (prevents stacking / freezing)
		abortActive()

		const sessionId = opts.sessionId ?? `session-${Date.now()}`
		const cwd = makeCwd(opts.cwd)
		const bin = resolveOlympuzBin()

		const args: string[] = [
			'--print',
			'--output-format',
			'stream-json',
			'--dangerously-skip-permissions',
			opts.message,
		]

		if (opts.model) args.unshift('--model', opts.model)

		broadcast('ai:status', 'running')

		let proc: ChildProcess
		try {
			proc = spawn(bin, args, {
				cwd,
				env: { ...process.env },
				stdio: ['ignore', 'pipe', 'pipe'],
				windowsHide: true,
			})
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : String(err)
			broadcast('ai:status', 'error', { message: `Failed to start AI: ${msg}` })
			return sessionId
		}

		activeProcess = proc
		activeSessionId = sessionId

		let stdoutBuf = ''

		proc.stdout?.on('data', (chunk: Buffer) => {
			stdoutBuf += chunk.toString('utf8')
			// Stream-json outputs one JSON object per line
			const lines = stdoutBuf.split('\n')
			stdoutBuf = lines.pop() ?? ''
			for (const line of lines) {
				const trimmed = line.trim()
				if (!trimmed) continue
				try {
					const obj = JSON.parse(trimmed)
					broadcast('ai:message', { sessionId, ...obj })
				} catch {
					// Not JSON — forward as raw text message
					broadcast('ai:message', { sessionId, type: 'text', text: trimmed })
				}
			}
		})

		proc.stderr?.on('data', (chunk: Buffer) => {
			const text = chunk.toString('utf8').trim()
			if (text) {
				console.warn('[olympuz-ide/ai]', text)
				broadcast('ai:message', { sessionId, type: 'error', text })
			}
		})

		proc.on('error', (err) => {
			console.error('[olympuz-ide/ai] process error:', err)
			broadcast('ai:status', 'error', { message: err.message })
			if (activeProcess === proc) {
				activeProcess = null
				activeSessionId = null
			}
		})

		proc.on('close', (code) => {
			// Flush any remaining stdout buffer
			if (stdoutBuf.trim()) {
				try {
					const obj = JSON.parse(stdoutBuf.trim())
					broadcast('ai:message', { sessionId, ...obj })
				} catch {
					broadcast('ai:message', { sessionId, type: 'text', text: stdoutBuf.trim() })
				}
				stdoutBuf = ''
			}
			if (activeProcess === proc) {
				activeProcess = null
				activeSessionId = null
			}
			broadcast('ai:status', code === 0 ? 'idle' : 'error', {
				exitCode: code,
				sessionId,
			})
		})

		return sessionId
	})

	// ── ai:abort ─────────────────────────────────────────────────────────────
	ipcMain.on('ai:abort', () => {
		abortActive()
		broadcast('ai:status', 'idle')
	})
}

export function cleanupAi(): void {
	abortActive()
}
