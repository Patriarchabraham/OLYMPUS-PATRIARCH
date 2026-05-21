import { afterEach, beforeEach, expect, test, vi } from 'vitest'

type MockStorageData = Record<string, unknown>

const originalEnv = { ...process.env }
const originalArgv = [...process.argv]
let storageState: MockStorageData = {}

async function importFreshModule() {
	vi.mock('./secureStorage/index.js', () => ({
		getSecureStorage: () => ({
			name: 'mock-secure-storage',
			read: () => storageState,
			readAsync: async () => storageState,
			update: (next: MockStorageData) => {
				storageState = next
				return { success: true }
			},
			delete: () => {
				storageState = {}
				return true
			},
		}),
	}))

	vi.resetModules()
	return vi.importActual<typeof import('./geminiCredentials')>('./geminiCredentials.ts')
}

beforeEach(() => {
	process.env = { ...originalEnv }
	delete process.env.CLAUDE_CODE_SIMPLE
	process.argv = originalArgv.filter((arg) => arg !== '--bare')
	storageState = {}
})

afterEach(() => {
	process.env = { ...originalEnv }
	process.argv = [...originalArgv]
	storageState = {}
	vi.restoreAllMocks()
})

test('saveGeminiAccessToken stores and reads back the token', async () => {
	const { readGeminiAccessToken, saveGeminiAccessToken } = await importFreshModule()

	const result = saveGeminiAccessToken('token-123')
	expect(result.success).toBe(true)
	expect(readGeminiAccessToken()).toBe('token-123')
})

test('clearGeminiAccessToken removes the stored token', async () => {
	const { clearGeminiAccessToken, readGeminiAccessToken, saveGeminiAccessToken } =
		await importFreshModule()

	expect(saveGeminiAccessToken('token-123').success).toBe(true)
	expect(clearGeminiAccessToken().success).toBe(true)
	expect(readGeminiAccessToken()).toBeUndefined()
})
