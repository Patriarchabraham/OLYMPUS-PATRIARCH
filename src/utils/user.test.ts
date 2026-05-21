import { afterEach, describe, expect, test, vi } from 'vitest'

const originalEnv = { ...process.env }

async function importFreshUserModule() {
	vi.resetModules()
	return vi.importActual<typeof import('./user')>('./user.ts')
}

function installCommonMocks(options?: { oauthEmail?: string; gitEmail?: string }) {
	// NOTE: Do NOT mock ../bootstrap/state.js here.
	// vi.mock() is process-global in bun:test and vi.restoreAllMocks() does NOT
	// undo it. Mocking state.js leaks getSessionId = () => 'session-test' into
	// every other test file that imports state.js (e.g. SDK CON-1 tests).
	// The dynamic import (importFreshUserModule) will use the real state.js,
	// which is fine — these tests only assert email, not sessionId.

	vi.mock('./auth.js', () => ({
		getOauthAccountInfo: () =>
			options?.oauthEmail
				? {
						emailAddress: options.oauthEmail,
						organizationUuid: 'org-test',
						accountUuid: 'acct-test',
					}
				: undefined,
		getRateLimitTier: () => null,
		getSubscriptionType: () => null,
	}))

	vi.mock('./config.js', () => ({
		getGlobalConfig: () => ({}),
		getOrCreateUserID: () => 'device-test',
	}))

	vi.mock('./cwd.js', () => ({
		getCwd: () => 'C:\\repo',
	}))

	vi.mock('./env.js', () => ({
		env: { platform: 'windows' },
		getHostPlatformForAnalytics: () => 'windows',
	}))

	vi.mock('./envUtils.js', () => ({
		isEnvTruthy: (value: string | undefined) =>
			!!value && value !== '0' && value.toLowerCase() !== 'false',
	}))

	vi.mock('execa', () => ({
		execa: async () => ({
			exitCode: options?.gitEmail ? 0 : 1,
			stdout: options?.gitEmail ?? '',
		}),
	}))
}

afterEach(() => {
	vi.restoreAllMocks()
	process.env = { ...originalEnv }
	delete (globalThis as Record<string, unknown>).MACRO
})

describe('user email fallbacks', () => {
	test('getCoreUserData does not synthesize Anthropic email from COO_CREATOR', async () => {
		process.env.USER_TYPE = 'ant'
		process.env.COO_CREATOR = 'alice'
		;(globalThis as Record<string, unknown>).MACRO = { VERSION: '0.0.0' }

		installCommonMocks()

		const { getCoreUserData } = await importFreshUserModule()
		const result = getCoreUserData()

		expect(result.email).toBeUndefined()
	})

	test('initUser falls back to git email when oauth email is missing', async () => {
		process.env.USER_TYPE = 'ant'
		process.env.COO_CREATOR = 'alice'
		;(globalThis as Record<string, unknown>).MACRO = { VERSION: '0.0.0' }

		installCommonMocks({ gitEmail: 'git@example.com' })

		const { initUser, getCoreUserData } = await importFreshUserModule()
		await initUser()

		const result = getCoreUserData()
		expect(result.email).toBe('git@example.com')
	})
})
