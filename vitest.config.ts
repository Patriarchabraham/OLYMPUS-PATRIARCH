import { defineConfig } from 'vitest/config'
import { resolve, dirname, join, basename } from 'path'
import { existsSync } from 'fs'

/**
 * Vite plugin that resolves local `require()` and `import` of `.js` paths
 * to the corresponding `.ts`/`.tsx` source files.
 *
 * The Olympuz codebase uses `require('../foo/bar.js')` throughout, which works
 * in Bun (runtime) and in the production build (esbuild strips the extensions),
 * but fails in Vitest because only the `.ts` files exist on disk.
 */
function resolveJsToTsPlugin() {
	return {
		name: 'resolve-js-to-ts',
		enforce: 'pre' as const,
		resolveId(source: string, importer: string | undefined) {
			// Only handle relative .js imports
			if (!source.endsWith('.js') && !source.endsWith('.mjs')) return null
			if (!importer) return null
			if (!source.startsWith('.')) return null

			const extensions = ['.ts', '.tsx', '.js', '.jsx', '.mjs']
			const base = source.replace(/\.(js|mjs)$/, '')

			// Resolve relative to the importing file's directory
			const importerDir = dirname(importer)
			const candidateBase = resolve(importerDir, base)

			// Try each extension
			for (const ext of extensions) {
				const candidate = candidateBase + ext
				if (existsSync(candidate)) {
					return candidate
				}
			}

			// Try index.ts / index.tsx for directory imports
			for (const ext of extensions) {
				const candidate = join(candidateBase, `index${ext}`)
				if (existsSync(candidate)) {
					return candidate
				}
			}

			return null
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
		// Force ALL source modules through Vite's pipeline so our
		// resolveId plugin handles .js → .ts resolution for ESM imports
		deps: {
			inline: [/\/src\//],
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
