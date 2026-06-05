import { resetFeatureFlags } from './vitest.bun-bundle-mock'
import { existsSync, readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import Module from 'node:module'

/**
 * Patch Node's module resolution to resolve `.js` requires to `.ts` source files.
 *
 * The Olympuz codebase uses `require('../foo/bar.js')` throughout, which works in
 * Bun (native TS support) and in the production build (esbuild resolves extensions),
 * but fails in Vitest because only `.ts` files exist on disk.
 *
 * This setup file runs before any test and patches Module._resolveFilename to
 * transparently resolve `.js` → `.ts` for relative imports within src/.
 */
const originalResolveFilename = Module._resolveFilename
Module._resolveFilename = function patchedResolveFilename(
	request: string,
	parent: Module | null,
	isMain: boolean,
	options: unknown,
) {
	// Handle .txt/.md requires — Bun supports these natively, Vitest doesn't
	if (
		parent?.filename &&
		request.startsWith('.') &&
		(request.endsWith('.txt') || request.endsWith('.md'))
	) {
		const dir = dirname(parent.filename)
		const fullPath = resolve(dir, request)
		if (existsSync(fullPath)) {
			return fullPath
		}
	}

	// Handle .js/.mjs requires — resolve to .ts source files
	if (
		parent?.filename &&
		(request.endsWith('.js') || request.endsWith('.mjs')) &&
		request.startsWith('.')
	) {
		const dir = dirname(parent.filename)
		const extensions = ['.ts', '.tsx']

		for (const ext of extensions) {
			const tsPath = resolve(dir, request.replace(/\.(js|mjs)$/, ext))
			if (existsSync(tsPath)) {
				return originalResolveFilename.call(this, tsPath, parent, isMain, options)
			}
		}

		// Try index.ts for directory imports
		for (const ext of extensions) {
			const indexPath = resolve(dir, request.replace(/\.(js|mjs)$/, `index${ext}`))
			if (existsSync(indexPath)) {
				return originalResolveFilename.call(this, indexPath, parent, isMain, options)
			}
		}
	}

	return originalResolveFilename.call(this, request, parent, isMain, options)
}

/**
 * Register .txt and .md as loadable extensions so require('./file.txt')
 * returns the file content as a string (matching Bun behavior).
 */
function registerRawExtensions(): void {
	const exts = (Module as unknown as { _extensions: Record<string, (m: Module, f: string) => void> })._extensions
	if (typeof exts === 'object') {
		const rawExts = ['.txt', '.md']
		for (const ext of rawExts) {
			if (!exts[ext]) {
				exts[ext] = (m: Module, filename: string) => {
					const content = readFileSync(filename, 'utf-8')
					m.exports = content
				}
			}
		}
	}
}
registerRawExtensions()

afterEach(() => {
	resetFeatureFlags()
})
