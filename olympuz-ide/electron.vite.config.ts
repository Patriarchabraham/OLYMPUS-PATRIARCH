import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'electron-vite'

export default defineConfig({
	main: {
		build: {
			rollupOptions: {
				input: { index: resolve(__dirname, 'electron/main.ts') },
				external: [
					// The Olympuz SDK bundle is loaded via dynamic import at runtime.
					// It must stay external — never bundled into the IDE.
					'../../dist/sdk.mjs',
					/^[./]+dist\/sdk\.mjs$/,
				],
			},
		},
	},
	preload: {
		build: {
			rollupOptions: {
				input: { index: resolve(__dirname, 'electron/preload.ts') },
			},
		},
	},
	renderer: {
		root: 'src',
		resolve: {
			alias: {
				'@renderer': resolve(__dirname, 'src'),
			},
		},
		plugins: [react()],
		build: {
			rollupOptions: {
				input: { index: resolve(__dirname, 'src/index.html') },
			},
		},
	},
})
