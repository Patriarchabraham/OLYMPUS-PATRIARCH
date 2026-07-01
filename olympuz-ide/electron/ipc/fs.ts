import { promises as fsp } from 'node:fs'
import { basename, dirname, join, relative, sep } from 'node:path'
import { BrowserWindow, dialog, ipcMain } from 'electron'

/**
 * Register all filesystem IPC handlers.
 *
 * All paths arriving from the renderer are validated to stay within the
 * currently-opened workspace to prevent the renderer from touching files
 * outside the project (defense-in-depth — even if the renderer is compromised
 * it cannot escape the workspace root).
 */

let workspaceRoot: string | null = null

export function getWorkspaceRoot(): string | null {
	return workspaceRoot
}

export function setWorkspaceRoot(p: string | null): void {
	workspaceRoot = p
}

/** True if `target` is inside `workspaceRoot` (or equal to it). */
function isInsideWorkspace(target: string): boolean {
	if (!workspaceRoot) return false
	const a = normalize(target)
	const root = normalize(workspaceRoot)
	return a === root || a.startsWith(root + sep)
}

function normalize(p: string): string {
	return p.replace(/[\\/]+/g, sep).replace(/[\\/]$/, '')
}

export type DirEntry = {
	name: string
	path: string
	isDirectory: boolean
	size: number
	mtime: number
}

async function readDirFlat(dirPath: string): Promise<DirEntry[]> {
	const entries = await fsp.readdir(dirPath, { withFileTypes: true })
	const out: DirEntry[] = []
	for (const ent of entries) {
		// Skip noise directories that should never appear in the tree.
		if (ent.isDirectory() && isIgnoredDir(ent.name)) continue
		if (!ent.isDirectory() && isIgnoredFile(ent.name)) continue
		const childPath = join(dirPath, ent.name)
		try {
			const stat = await fsp.stat(childPath)
			out.push({
				name: ent.name,
				path: childPath,
				isDirectory: ent.isDirectory(),
				size: stat.size,
				mtime: stat.mtimeMs,
			})
		} catch {
			// Stat can fail on broken symlinks / locked files — skip silently.
		}
	}
	// Directories first, then files; alphabetical within each group.
	out.sort((a, b) => {
		if (a.isDirectory !== b.isDirectory) return a.isDirectory ? -1 : 1
		return a.name.localeCompare(b.name, undefined, { numeric: true })
	})
	return out
}

function isIgnoredDir(name: string): boolean {
	return (
		name === 'node_modules' ||
		name === '.git' ||
		name === 'dist' ||
		name === 'out' ||
		name === 'release' ||
		name === '.benchmark-tmp' ||
		name === '.cache' ||
		name === '.openclaude' ||
		name === '__pycache__'
	)
}

function isIgnoredFile(name: string): boolean {
	return name.startsWith('.') && (name.endsWith('.log') || name === '.DS_Store')
}

export function registerFsIpc(): void {
	ipcMain.handle('fs:open-folder', async () => {
		const result = await dialog.showOpenDialog({
			properties: ['openDirectory'],
		})
		if (result.canceled || result.filePaths.length === 0) return null
		const picked = result.filePaths[0]!
		workspaceRoot = picked
		return picked
	})

	ipcMain.handle('fs:read-dir', async (_evt, p: string) => {
		if (!isInsideWorkspace(p)) {
			throw new Error(`Path outside workspace: ${p}`)
		}
		return readDirFlat(p)
	})

	ipcMain.handle('fs:read-file', async (_evt, p: string) => {
		if (!isInsideWorkspace(p)) {
			throw new Error(`Path outside workspace: ${p}`)
		}
		return fsp.readFile(p, 'utf8')
	})

	ipcMain.handle('fs:write-file', async (_evt, p: string, content: string) => {
		if (!isInsideWorkspace(p)) {
			throw new Error(`Path outside workspace: ${p}`)
		}
		await fsp.mkdir(dirname(p), { recursive: true })
		await fsp.writeFile(p, content, 'utf8')
		return true
	})

	ipcMain.handle('fs:create-file', async (_evt, p: string, content: string = '') => {
		if (!isInsideWorkspace(p)) {
			throw new Error(`Path outside workspace: ${p}`)
		}
		await fsp.writeFile(p, content, 'utf8')
		return true
	})

	ipcMain.handle('fs:create-dir', async (_evt, p: string) => {
		if (!isInsideWorkspace(p)) {
			throw new Error(`Path outside workspace: ${p}`)
		}
		await fsp.mkdir(p, { recursive: true })
		return true
	})

	ipcMain.handle('fs:rename', async (_evt, oldPath: string, newPath: string) => {
		if (!isInsideWorkspace(oldPath) || !isInsideWorkspace(newPath)) {
			throw new Error('Rename crosses workspace boundary')
		}
		await fsp.rename(oldPath, newPath)
		return true
	})

	ipcMain.handle('fs:unlink', async (_evt, p: string) => {
		if (!isInsideWorkspace(p)) {
			throw new Error(`Path outside workspace: ${p}`)
		}
		const stat = await fsp.stat(p)
		if (stat.isDirectory()) {
			await fsp.rmdir(p, { recursive: true })
		} else {
			await fsp.unlink(p)
		}
		return true
	})

	ipcMain.handle('fs:stat', async (_evt, p: string) => {
		if (!isInsideWorkspace(p)) {
			throw new Error(`Path outside workspace: ${p}`)
		}
		const stat = await fsp.stat(p)
		return {
			size: stat.size,
			mtime: stat.mtimeMs,
			isDirectory: stat.isDirectory(),
			isFile: stat.isFile(),
		}
	})
}

/** Broadcast workspace change to every renderer (used by ai.ts to know cwd). */
export function broadcastWorkspaceChange(): void {
	for (const w of BrowserWindow.getAllWindows()) {
		w.webContents.send('workspace:changed', workspaceRoot)
	}
}

export { basename, relative }
