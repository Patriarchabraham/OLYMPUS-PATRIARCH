import { existsSync, readFileSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

/**
 * Bun-runtime compatibility shims for tests that run under Vitest / Node.
 *
 * Production source guards every `Bun.*` call with `typeof Bun !== 'undefined'`
 * and falls back to a Node equivalent — so it works under Vitest unchanged. But
 * a number of tests call `Bun.file()` / `Bun.sleep()` / `import.meta.dir`
 * directly, assuming a Bun runtime, and crash at collection time with
 * "Bun is not defined".
 *
 * Rather than define a partial global `Bun` (which would flip every source-side
 * `typeof Bun !== 'undefined'` guard to true and route code through untested
 * shim implementations of Bun.hash / Bun.semver / etc.), these helpers give
 * tests the same ergonomics backed by Node. Call sites stay unchanged, e.g.
 * `await file('x.ts').text()` keeps working.
 */

/** Bun.file() workalike backed by the Node fs. */
export function fileLike(path: string) {
	return {
		get size() {
			try {
				return statSync(path).size
			} catch {
				return 0
			}
		},
		text: async () => readFileSync(path, 'utf8'),
		json: async () => JSON.parse(readFileSync(path, 'utf8')),
		arrayBuffer: async () => {
			const buf = readFileSync(path)
			return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)
		},
		bytes: async () => new Uint8Array(readFileSync(path)),
		exists: () => existsSync(path),
	}
}

/** Bun.sleep() workalike. */
export function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Replaces Bun's `import.meta.dir` with a Node-compatible directory path. */
export function hereDir(importMetaUrl: string): string {
	return fileURLToPath(new URL('.', importMetaUrl))
}
