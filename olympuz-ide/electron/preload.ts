import { contextBridge, ipcRenderer } from 'electron'

/**
 * Safe IPC API exposed to the renderer. The renderer never touches Node
 * directly — every operation goes through these channels.
 *
 * Naming convention:
 *   - `invoke:` channels use ipcRenderer.invoke → Promise (request/response)
 *   - `on:` channels receive events from main (one-way, streaming)
 *   - `send:` channels send events to main (one-way)
 */
const api = {
	// ─── File system ──────────────────────────────────────────────────────
	fs: {
		openFolder: () => ipcRenderer.invoke('fs:open-folder'),
		readDir: (p: string) => ipcRenderer.invoke('fs:read-dir', p),
		readFile: (p: string) => ipcRenderer.invoke('fs:read-file', p),
		writeFile: (p: string, content: string) => ipcRenderer.invoke('fs:write-file', p, content),
		createFile: (p: string, content?: string) => ipcRenderer.invoke('fs:create-file', p, content),
		createDir: (p: string) => ipcRenderer.invoke('fs:create-dir', p),
		rename: (oldPath: string, newPath: string) => ipcRenderer.invoke('fs:rename', oldPath, newPath),
		unlink: (p: string) => ipcRenderer.invoke('fs:unlink', p),
		stat: (p: string) => ipcRenderer.invoke('fs:stat', p),
	},

	// ─── AI / SDK bridge ─────────────────────────────────────────────────
	ai: {
		/** Start a streaming query. Returns the new sessionId. */
		prompt: (opts: {
			cwd: string
			message: string
			sessionId?: string
			systemPrompt?: string
			model?: string
		}) => ipcRenderer.invoke('ai:prompt', opts),
		/** Abort the in-flight query. */
		abort: () => ipcRenderer.send('ai:abort'),
		/** Subscribe to streaming messages. Returns an unsubscribe fn. */
		onMessage: (cb: (msg: unknown) => void) => {
			const handler = (_: unknown, msg: unknown) => cb(msg)
			ipcRenderer.on('ai:message', handler)
			return () => ipcRenderer.removeListener('ai:message', handler)
		},
		/** Subscribe to status changes (idle/running/error). */
		onStatus: (cb: (status: string, detail?: unknown) => void) => {
			const handler = (_: unknown, status: string, detail?: unknown) => cb(status, detail)
			ipcRenderer.on('ai:status', handler)
			return () => ipcRenderer.removeListener('ai:status', handler)
		},
	},

	// ─── Terminal ────────────────────────────────────────────────────────
	terminal: {
		spawn: (cwd: string) => ipcRenderer.invoke('terminal:spawn', cwd),
		input: (data: string) => ipcRenderer.send('terminal:input', data),
		resize: (cols: number, rows: number) => ipcRenderer.send('terminal:resize', cols, rows),
		kill: () => ipcRenderer.send('terminal:kill'),
		onData: (cb: (data: string) => void) => {
			const handler = (_: unknown, data: string) => cb(data)
			ipcRenderer.on('terminal:data', handler)
			return () => ipcRenderer.removeListener('terminal:data', handler)
		},
		onExit: (cb: (code: number | null) => void) => {
			const handler = (_: unknown, code: number | null) => cb(code)
			ipcRenderer.on('terminal:exit', handler)
			return () => ipcRenderer.removeListener('terminal:exit', handler)
		},
	},

	// ─── Menu events ─────────────────────────────────────────────────────
	menu: {
		onOpenFolder: (cb: () => void) => {
			const h = () => cb()
			ipcRenderer.on('menu:open-folder', h)
			return () => ipcRenderer.removeListener('menu:open-folder', h)
		},
		onSave: (cb: () => void) => {
			const h = () => cb()
			ipcRenderer.on('menu:save', h)
			return () => ipcRenderer.removeListener('menu:save', h)
		},
	},
}

contextBridge.exposeInMainWorld('olympuz', api)

// Type export for renderer (consumed via `declare global` in renderer types).
export type OlympuzAPI = typeof api
