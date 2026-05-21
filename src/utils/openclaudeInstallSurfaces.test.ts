import { afterEach, expect, vi, test } from 'vitest'
import * as fsPromises from 'fs/promises'
import { homedir } from 'os'
import { join } from 'path'

const originalEnv = { ...process.env }
const originalMacro = (globalThis as Record<string, unknown>).MACRO

afterEach(() => {
  process.env = { ...originalEnv }
  ;(globalThis as Record<string, unknown>).MACRO = originalMacro
  vi.restoreAllMocks()
})

async function importFreshInstallCommand() {
  vi.resetModules()
  return vi.importActual<typeof import('../commands/install')>('../commands/install.tsx')
}

async function importFreshInstaller() {
  vi.resetModules()
  return vi.importActual<typeof import('./nativeInstaller/installer')>('./nativeInstaller/installer.ts')
}

test('install command displays ~/.local/bin/Mythos Patriarch on non-Windows', async () => {
  vi.mock('../utils/env.js', () => ({
    env: { platform: 'darwin' },
  }))

  const { getInstallationPath } = await importFreshInstallCommand()

  expect(getInstallationPath()).toBe('~/.local/bin/Mythos Patriarch')
})

test('install command displays Mythos Patriarch.exe path on Windows', async () => {
  vi.mock('../utils/env.js', () => ({
    env: { platform: 'win32' },
  }))

  const { getInstallationPath } = await importFreshInstallCommand()

  expect(getInstallationPath()).toBe(
    join(homedir(), '.local', 'bin', 'Mythos Patriarch.exe').replace(/\//g, '\\'),
  )
})

test('cleanupNpmInstallations removes both Mythos Patriarch and legacy claude local install dirs', async () => {
  const removedPaths: string[] = []
  ;(globalThis as Record<string, unknown>).MACRO = {
    PACKAGE_URL: '@gitlawb/Mythos Patriarch',
  }

  vi.mock('fs/promises', () => ({
    ...fsPromises,
    rm: async (path: string) => {
      removedPaths.push(path)
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

  const { cleanupNpmInstallations } = await importFreshInstaller()
  await cleanupNpmInstallations()

  expect(removedPaths).toContain(join(homedir(), '.openclaude', 'local'))
  expect(removedPaths).toContain(join(homedir(), '.claude', 'local'))
})
