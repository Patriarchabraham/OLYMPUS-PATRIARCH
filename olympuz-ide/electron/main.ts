import { existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { app, BrowserWindow, Menu, shell } from 'electron'
import { registerAiIpc } from './ipc/ai'
import { registerFsIpc } from './ipc/fs'
import { cleanupTerminal, registerTerminalIpc } from './ipc/terminal'

// On Windows, Electron sometimes leaves HOME unset; the Olympuz SDK reads
// ~/.olympuz config from HOME. Force it to the user profile directory.
if (!process.env.HOME && process.env.USERPROFILE) {
	process.env.HOME = process.env.USERPROFILE
}

// __dirname is the output dir of main (out/main). Compute project root from it.
const PROJECT_ROOT = resolve(__dirname, '..', '..')
const DIST_ROOT = resolve(PROJECT_ROOT, '..', 'dist')
const isDev = !app.isPackaged

function createWindow(): BrowserWindow {
	const mainWindow = new BrowserWindow({
		width: 1440,
		height: 900,
		minWidth: 900,
		minHeight: 600,
		show: false,
		autoHideMenuBar: true,
		title: 'Olympuz IDE',
		backgroundColor: '#0d1117',
		webPreferences: {
			preload: join(__dirname, '../preload/index.js'),
			contextIsolation: true,
			nodeIntegration: false,
			sandbox: false,
			webSecurity: true,
		},
	})

	mainWindow.on('ready-to-show', () => mainWindow.show())

	mainWindow.webContents.setWindowOpenHandler((details) => {
		shell.openExternal(details.url)
		return { action: 'deny' }
	})

	mainWindow.on('closed', () => {
		cleanupTerminal()
	})

	// Dev: load from the electron-vite dev server; Prod: load built index.html.
	if (isDev && process.env['ELECTRON_RENDERER_URL']) {
		mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
		mainWindow.webContents.openDevTools({ mode: 'detach' })
	} else {
		mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
	}

	return mainWindow
}

function buildMenu(): Menu | null {
	const isMac = process.platform === 'darwin'
	const template: Electron.MenuItemConstructorOptions[] = [
		...(isMac
			? ([
					{
						label: 'Olympuz IDE',
						submenu: [
							{ role: 'about' },
							{ type: 'separator' },
							{ role: 'services' },
							{ type: 'separator' },
							{ role: 'hide' },
							{ role: 'hideOthers' },
							{ role: 'unhide' },
							{ type: 'separator' },
							{ role: 'quit' },
						],
					},
				] as Electron.MenuItemConstructorOptions[])
			: []),
		{
			label: 'File',
			submenu: [
				{
					label: 'Open Folder…',
					accelerator: 'CmdOrCtrl+O',
					click: () => {
						BrowserWindow.getAllWindows().forEach((w) => w.webContents.send('menu:open-folder'))
					},
				},
				{
					label: 'Save',
					accelerator: 'CmdOrCtrl+S',
					click: () => {
						BrowserWindow.getAllWindows().forEach((w) => w.webContents.send('menu:save'))
					},
				},
				{ type: 'separator' },
				isMac ? { role: 'closeWindow' } : { role: 'quit' },
			].filter(Boolean) as Electron.MenuItemConstructorOptions[],
		},
		{
			label: 'View',
			submenu: [
				{ role: 'reload' },
				{ role: 'forceReload' },
				{ role: 'toggleDevTools' },
				{ type: 'separator' },
				{ role: 'resetZoom' },
				{ role: 'zoomIn' },
				{ role: 'zoomOut' },
				{ type: 'separator' },
				{ role: 'togglefullscreen' },
			],
		},
	]
	return Menu.buildFromTemplate(template)
}

app.whenReady().then(() => {
	// Register all IPC handlers before creating the window
	registerFsIpc()
	registerAiIpc()
	registerTerminalIpc()

	Menu.setApplicationMenu(buildMenu())
	createWindow()

	app.on('activate', () => {
		if (BrowserWindow.getAllWindows().length === 0) createWindow()
	})
})

app.on('window-all-closed', () => {
	cleanupTerminal()
	if (process.platform !== 'darwin') app.quit()
})

// Verify SDK bundle presence at startup; warn (don't crash) if missing.
if (!existsSync(join(DIST_ROOT, 'sdk.mjs'))) {
	console.warn(
		`[olympuz-ide] SDK bundle not found at ${DIST_ROOT}. ` +
			`Run \`bun run build\` in the project root, or the chat panel will fall back to subprocess mode.`,
	)
}
