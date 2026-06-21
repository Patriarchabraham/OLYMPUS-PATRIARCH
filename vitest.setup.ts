import { existsSync, mkdtempSync, readFileSync } from 'node:fs'
import Module from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { buildSync, transformSync } from 'esbuild'
import { resetFeatureFlags } from './vitest.bun-bundle-mock'

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
// Project `src/` root, for resolving `src/...` alias specifiers (see below).
const SRC_ROOT = fileURLToPath(new URL('./src', import.meta.url))

/**
 * Pre-bundle ESM-only npm packages (ones whose package.json exports have no
 * CJS/`require` entry) into CommonJS, so Node's CJS loader — used by the
 * `registerTsLoaders` path below when an escaped `.ts` module is transformed
 * to CJS and then `require()`s such a package — can load them. Returns a map
 * of package specifier → on-disk bundled `.cjs` path.
 *
 * `@alcalzone/ansi-tokenize` is the sole such blocker in this tree; it is a
 * pure tokenizer (no native/async init) so it bundles to CJS cleanly.
 */
function bundleEsmOnlyPackages(): Map<string, string> {
	const tmpDir = mkdtempSync(join(tmpdir(), 'olympuz-cjs-bundles-'))
	const packages = [
		{
			spec: '@alcalzone/ansi-tokenize',
			entry: 'node_modules/@alcalzone/ansi-tokenize/build/index.js',
		},
	]
	const redirects = new Map<string, string>()
	for (const { spec, entry } of packages) {
		const entryPath = fileURLToPath(new URL(`./${entry}`, import.meta.url))
		if (!existsSync(entryPath)) continue
		const outPath = join(tmpDir, `${spec.replace(/[^a-z0-9]+/gi, '_')}.cjs`)
		buildSync({
			entryPoints: [entryPath],
			bundle: true,
			format: 'cjs',
			platform: 'node',
			target: `node${process.versions.node.split('.')[0]}`,
			outfile: outPath,
			logLevel: 'silent',
		})
		redirects.set(spec, outPath)
	}
	return redirects
}
const ESM_ONLY_REDIRECTS = bundleEsmOnlyPackages()

// Import/require specifiers in this codebase use `.js`/`.jsx`/`.mjs`/`.cjs`
// extensions that must map to on-disk `.ts`/`.tsx` source under Vitest.
const JS_SPEC_EXT = /\.(jsx?|cjs|mjs)$/
const TS_SOURCE_EXTS = ['.ts', '.tsx']

const originalResolveFilename = Module._resolveFilename
Module._resolveFilename = function patchedResolveFilename(
	request: string,
	parent: Module | null,
	isMain: boolean,
	options: unknown,
) {
	// Redirect requires of pre-bundled ESM-only packages (e.g. ansi-tokenize)
	// to their CJS bundle so the Node-CJS loader path can load them.
	const esmRedirect = ESM_ONLY_REDIRECTS.get(request)
	if (esmRedirect) return esmRedirect

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

	// Handle relative .js/.jsx/.mjs/.cjs requires — resolve to .ts/.tsx source
	if (parent?.filename && request.startsWith('.') && JS_SPEC_EXT.test(request)) {
		const dir = dirname(parent.filename)
		const base = request.replace(JS_SPEC_EXT, '')

		for (const ext of TS_SOURCE_EXTS) {
			const tsPath = resolve(dir, base + ext)
			if (existsSync(tsPath)) {
				return originalResolveFilename.call(this, tsPath, parent, isMain, options)
			}
		}
		// Try index.ts/.tsx for directory imports
		for (const ext of TS_SOURCE_EXTS) {
			const indexPath = resolve(dir, `${base}index${ext}`)
			if (existsSync(indexPath)) {
				return originalResolveFilename.call(this, indexPath, parent, isMain, options)
			}
		}
	}

	// Handle `src/` alias specifiers (e.g. require('src/utils/crypto.js')).
	// esbuild rewrites `import ... from 'src/...'` to `require('src/...')` in CJS
	// output, and Node's CJS resolver doesn't know the `src/` alias (only Vite's
	// resolveId plugin does). Resolve them to the on-disk `.ts`/`.tsx` source.
	if (request.startsWith('src/') && JS_SPEC_EXT.test(request)) {
		const subpath = request.replace(JS_SPEC_EXT, '').replace(/^src\//, '')

		for (const ext of TS_SOURCE_EXTS) {
			const tsPath = resolve(SRC_ROOT, subpath + ext)
			if (existsSync(tsPath)) {
				return originalResolveFilename.call(this, tsPath, parent, isMain, options)
			}
		}
		for (const ext of TS_SOURCE_EXTS) {
			const indexPath = resolve(SRC_ROOT, `${subpath}index${ext}`)
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
	const exts = (
		Module as unknown as { _extensions: Record<string, (m: Module, f: string) => void> }
	)._extensions
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

/**
 * Register a CommonJS loader for `.ts` / `.tsx` that transforms via esbuild.
 *
 * When a src module is loaded through Node's CJS loader (rather than Vite's
 * pipeline — see the `_resolveFilename` patch above, which returns a `.ts`
 * path), Node has no `.ts` extension handler and parses the TypeScript source
 * as plain JavaScript, throwing `SyntaxError: Unexpected token '{'`. Transforming
 * to CJS first lets these escaped loads succeed.
 */
function registerTsLoaders(): void {
	const exts = (
		Module as unknown as { _extensions: Record<string, (m: NodeJS.Module, f: string) => void> }
	)._extensions
	const target = `node${process.versions.node.split('.')[0]}`
	// Cache transformed output per file: tests call vi.resetModules() heavily,
	// which re-imports (and thus re-transforms) the same sources; caching keeps
	// the single-fork worker's heap growth bounded.
	const transformCache = new Map<string, string>()
	for (const ext of ['.ts', '.tsx'] as const) {
		const loader = ext === '.tsx' ? 'tsx' : 'ts'
		exts[ext] = (mod, filename) => {
			let code = transformCache.get(filename)
			if (code === undefined) {
				const source = readFileSync(filename, 'utf8')
				const result = transformSync(source, {
					loader,
					format: 'cjs',
					target,
					sourcemap: 'inline',
					sourcefile: filename,
					define: { 'import.meta.url': JSON.stringify(pathToFileURL(filename).href) },
				})
				code = result.code
				transformCache.set(filename, code)
			}
			;(mod as unknown as { _compile: (code: string, filename: string) => void })._compile(
				code,
				filename,
			)
		}
	}
}
registerTsLoaders()

afterEach(() => {
	resetFeatureFlags()
})
