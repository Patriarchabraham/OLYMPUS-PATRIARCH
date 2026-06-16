import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { defineConfig } from 'vitest/config'

/**
 * Vite plugin that resolves local `require()` and `import` of `.js` paths
 * to the corresponding `.ts`/`.tsx` source files.
 *
 * Handles BOTH relative imports (../foo/bar.js) AND the `src/` path alias
 * (src/foo/bar.js). The codebase uses `.js` extensions throughout, which works
 * in Bun (runtime) and the production build (esbuild strips them), but fails in
 * Vitest because only the `.ts` files exist on disk. Without `src/` handling,
 * value imports like `import { X } from 'src/entrypoints/agentSdkTypes.js'`
 * (used across the settings/schema/hooks modules) fail to resolve and cascade
 * into ~135 failed suites.
 */
function resolveJsToTsPlugin() {
	const srcRoot = resolve(__dirname, 'src')
	const extensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs']

	function tryResolve(candidateBase: string): string | null {
		for (const ext of extensions) {
			const candidate = candidateBase + ext
			if (existsSync(candidate)) return candidate
		}
		// Try index.ts / index.tsx for directory imports
		for (const ext of extensions) {
			const candidate = join(candidateBase, `index${ext}`)
			if (existsSync(candidate)) return candidate
		}
		return null
	}

	return {
		name: 'resolve-js-to-ts',
		enforce: 'pre' as const,
		resolveId(source: string, importer: string | undefined) {
			if (!source.endsWith('.js') && !source.endsWith('.mjs')) return null
			const base = source.replace(/\.(js|mjs)$/, '')

			// src/ alias imports (e.g. 'src/services/mcp/types.js')
			if (source.startsWith('src/')) {
				const subpath = base.replace(/^src\//, '')
				return tryResolve(resolve(srcRoot, subpath))
			}

			// Relative imports (./ or ../)
			if (!importer) return null
			if (!source.startsWith('.')) return null
			return tryResolve(resolve(dirname(importer), base))
		},
	}
}

/**
 * Vite plugin that treats `.txt` files as string modules (Bun compat).
 * Bun natively supports `require('./file.txt')` returning the content as a string.
 */
function rawTextPlugin() {
	return {
		name: 'raw-text-loader',
		transform(code: string, id: string) {
			if (id.endsWith('.txt') || id.endsWith('.md')) {
				return {
					code: `export default ${JSON.stringify(code)}`,
					map: null,
				}
			}
		},
	}
}

export default defineConfig({
	test: {
		globals: true,
		setupFiles: ['./vitest.setup.ts'],
		include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
		testTimeout: 30_000,
		hookTimeout: 30_000,
		pool: 'forks',
		poolOptions: {
			forks: {
				singleFork: true,
			},
		},
		// Force ALL source modules through Vite's pipeline so our resolveId
		// plugin handles .js → .ts resolution for ESM imports.
		// NOTE: `deps.inline` is deprecated in Vitest 3.x and no longer forces src
		// modules through Vite — use server.deps.inline (the documented migration).
		// The regex matches both POSIX (/src/) and Windows (\src\) separators.
		server: {
			deps: {
				inline: [/[/\\]src[/\\]/],
			},
		},
	},
	resolve: {
		alias: {
			'src/*': resolve(__dirname, 'src'),
			// Mock bun:bundle feature flags
			'bun:bundle': resolve(__dirname, 'vitest.bun-bundle-mock.ts'),
		},
	},
	plugins: [resolveJsToTsPlugin(), rawTextPlugin()],
})
