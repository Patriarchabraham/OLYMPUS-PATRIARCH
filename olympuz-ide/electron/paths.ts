import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { app } from 'electron'

/**
 * Resolve the path to the Olympuz SDK bundle.
 *
 * - In packaged builds: extraResources copies sdk.mjs next to the app → resourcesPath/sdk.mjs
 * - In dev: the bundle lives in the parent project's dist/ → ../../../dist/sdk.mjs relative to out/main
 *
 * Falls back to a sibling ../dist/sdk.mjs if the packaged path is missing.
 */
export function resolveSdkPath(): string {
	const packaged = resolve(process.resourcesPath, 'sdk.mjs')
	if (existsSync(packaged)) return packaged

	// Dev: from olympuz-ide/out/main/index.js → up 3 → dist/sdk.mjs
	const devPath = resolve(__dirname, '..', '..', '..', 'dist', 'sdk.mjs')
	if (existsSync(devPath)) return devPath

	// Last-resort fallback (when running ts-node or different layout)
	const fallback = resolve(__dirname, '..', '..', 'dist', 'sdk.mjs')
	return fallback
}

/**
 * Resolve the bin/ directory of the parent Olympuz CLI install.
 * Used for the subprocess fallback path.
 */
export function resolveOlympuzBin(): string {
	const packaged = resolve(process.resourcesPath, 'bin')
	if (existsSync(packaged)) return packaged
	return resolve(__dirname, '..', '..', '..', 'bin')
}

/**
 * Path to the user's workspace — defaults to the Olympuz root in dev,
 * or the OS home in packaged builds.
 */
export function defaultWorkspace(): string {
	return app?.getPath?.('home') ?? process.env.USERPROFILE ?? process.cwd()
}
