import type * as fsPromises from 'node:fs/promises'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, test, vi } from 'vitest'

// vi.mock() factories are hoisted to the top of the file, so they cannot
// reference per-test locals. Route all per-test values through mutable
// holders created with vi.hoisted(), which executes before the hoisted
// mocks and is safe to reference inside them.
const envState = vi.hoisted(() => ({
	// Default to the real platform so non-env-dependent code sees reality.
	platform: typeof process !== 'undefined' && process.platform ? process.platform : 'linux',
}))

const installState = vi.hoisted(() => ({
	// Paths removed by the mocked fs/promises.rm during cleanup tests.
	removedPaths: [] as string[],
}))

// Single hoisted mock for ../utils/env.js — tests mutate envState.platform
// to control the platform branch.
vi.mock('../utils/env.js', () => ({
	env: {
		get platform() {
			return envState.platform
		},
	},
}))

// fs/promises mock preserves every real export (so unrelated fs calls work)
// but routes `rm` through the installState.removedPaths recorder.
vi.mock('fs/promises', async (importOriginal) => ({
	...((await importOriginal()) as typeof fsPromises),
	rm: async (path: string) => {
		installState.removedPaths.push(path)
	},
}))

vi.mock('./execFileNoThrow.js', () => ({
	execFileNoThrowWithCwd: async () => ({
		code: 1,
		stderr: 'npm ERR! code E404',
	}),
}))

vi.mock('./envUtils.js', () => ({
	getClaudeConfigHomeDir: () => join(homedir(), '.openclaude'),
	isEnvTruthy: (value: string | undefined) => value === '1',
}))

const originalEnv = { ...process.env }
const originalMacro = (globalThis as Record<string, unknown>).MACRO

afterEach(() => {
	process.env = { ...originalEnv }
	;(globalThis as Record<string, unknown>).MACRO = originalMacro
	installState.removedPaths.length = 0
	vi.restoreAllMocks()
})

test('install command displays ~/.local/bin/Olympuz Coder on non-Windows', async () => {
	envState.platform = 'darwin'

	const { getInstallationPath } = await import('../commands/install.tsx')

	expect(getInstallationPath()).toBe('~/.local/bin/Olympuz Coder')
})

test('install command displays Olympuz Coder.exe path on Windows', async () => {
	envState.platform = 'win32'

	const { getInstallationPath } = await import('../commands/install.tsx')

	expect(getInstallationPath()).toBe(
		join(homedir(), '.local', 'bin', 'Olympuz Coder.exe').replace(/\//g, '\\'),
	)
})

test('cleanupNpmInstallations removes both Olympuz Coder and legacy claude local install dirs', async () => {
	;(globalThis as Record<string, unknown>).MACRO = {
		PACKAGE_URL: '@gitlawb/Olympuz Coder',
	}

	const { cleanupNpmInstallations } = await import('./nativeInstaller/installer.ts')
	await cleanupNpmInstallations()

	expect(installState.removedPaths).toContain(join(homedir(), '.openclaude', 'local'))
	expect(installState.removedPaths).toContain(join(homedir(), '.claude', 'local'))
})
