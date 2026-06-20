import { afterEach, describe, expect, test, vi } from 'vitest'

const originalEnv = { ...process.env }

// vi.mock() factories are hoisted to module top by Vitest and cannot close over
// the installCommonMocks(options) parameter (ported from bun:test where
// mock.module captures closures). Hold per-test mock state in a hoisted mutable
// object that the factories read from; installCommonMocks populates it before
// the fresh import re-evaluates the factories.
const mockState = vi.hoisted(() => ({
	oauthEmail: undefined as string | undefined,
	gitEmail: undefined as string | undefined,
}))

async function importFreshUserModule() {
	vi.resetModules()
	return vi.importActual<typeof import('./user')>('./user.ts')
}

function installCommonMocks(options?: { oauthEmail?: string; gitEmail?: string }) {
	// NOTE: Do NOT mock ../bootstrap/state.js here.
	// vi.mock() is process-global and vi.restoreAllMocks() does NOT undo it.
	// Mocking state.js leaks getSessionId = () => 'session-test' into every other
	// test file that imports state.js (e.g. SDK CON-1 tests). The dynamic import
	// (importFreshUserModule) will use the real state.js, which is fine — these
	// tests only assert email, not sessionId.

	mockState.oauthEmail = options?.oauthEmail
	mockState.gitEmail = options?.gitEmail

	vi.mock('./auth.js', () => ({
		getOauthAccountInfo: () =>
			mockState.oauthEmail
				? {
						emailAddress: mockState.oauthEmail,
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
			exitCode: mockState.gitEmail ? 0 : 1,
			stdout: mockState.gitEmail ?? '',
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
