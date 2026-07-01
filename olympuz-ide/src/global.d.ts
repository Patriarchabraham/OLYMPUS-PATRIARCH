/**
 * Global type augmentation for the renderer process.
 * Mirrors the OlympuzAPI shape from electron/preload.ts without
 * importing it directly (cross-project TS reference not needed).
 */
export {}

declare global {
	interface Window {
		olympuz: {
			fs: {
				openFolder: () => Promise<string | null>
				readDir: (p: string) => Promise<unknown[]>
				readFile: (p: string) => Promise<string>
				writeFile: (p: string, content: string) => Promise<boolean>
				createFile: (p: string, content?: string) => Promise<boolean>
				createDir: (p: string) => Promise<boolean>
				rename: (oldPath: string, newPath: string) => Promise<boolean>
				unlink: (p: string) => Promise<boolean>
				stat: (
					p: string,
				) => Promise<{ size: number; mtime: number; isDirectory: boolean; isFile: boolean }>
			}
			ai: {
				prompt: (opts: {
					cwd: string
					message: string
					sessionId?: string
					systemPrompt?: string
					model?: string
				}) => Promise<string>
				abort: () => void
				onMessage: (cb: (msg: unknown) => void) => () => void
				onStatus: (cb: (status: string, detail?: unknown) => void) => () => void
			}
			terminal: {
				spawn: (cwd: string) => Promise<void>
				input: (data: string) => void
				resize: (cols: number, rows: number) => void
				kill: () => void
				onData: (cb: (data: string) => void) => () => void
				onExit: (cb: (code: number | null) => void) => () => void
			}
			menu: {
				onOpenFolder: (cb: () => void) => () => void
				onSave: (cb: () => void) => () => void
			}
		}
	}
}
