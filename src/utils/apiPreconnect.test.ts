import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

const originalEnv = { ...process.env }
const originalFetch = globalThis.fetch

async function importFreshModule() {
	vi.restoreAllMocks()
	vi.resetModules()
	return vi.importActual<typeof import('./apiPreconnect')>('./apiPreconnect.ts')
}

beforeEach(() => {
	process.env = { ...originalEnv }
})

afterEach(() => {
	process.env = { ...originalEnv }
	globalThis.fetch = originalFetch
	vi.restoreAllMocks()
})

describe('preconnectAnthropicApi', () => {
	test('does not fetch when OpenAI mode is enabled', async () => {
		process.env.CLAUDE_CODE_USE_OPENAI = '1'
		vi.doMock('./model/providers.js', () => ({
			getAPIProvider: () => 'openai',
		}))
		const fetchMock = vi.fn(() => Promise.resolve(new Response(null, { status: 200 })))
		globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch

		const { preconnectAnthropicApi } = await importFreshModule()
		preconnectAnthropicApi()

		expect(fetchMock).not.toHaveBeenCalled()
	})

	test('does not fetch when Gemini mode is enabled', async () => {
		process.env.CLAUDE_CODE_USE_GEMINI = '1'
		vi.doMock('./model/providers.js', () => ({
			getAPIProvider: () => 'gemini',
		}))
		const fetchMock = vi.fn(() => Promise.resolve(new Response(null, { status: 200 })))
		globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch

		const { preconnectAnthropicApi } = await importFreshModule()
		preconnectAnthropicApi()

		expect(fetchMock).not.toHaveBeenCalled()
	})

	test('does not fetch when GitHub mode is enabled', async () => {
		process.env.CLAUDE_CODE_USE_GITHUB = '1'
		vi.doMock('./model/providers.js', () => ({
			getAPIProvider: () => 'github',
		}))
		const fetchMock = vi.fn(() => Promise.resolve(new Response(null, { status: 200 })))
		globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch

		const { preconnectAnthropicApi } = await importFreshModule()
		preconnectAnthropicApi()

		expect(fetchMock).not.toHaveBeenCalled()
	})

	test('fetches in first-party mode', async () => {
		delete process.env.CLAUDE_CODE_USE_OPENAI
		delete process.env.CLAUDE_CODE_USE_GEMINI
		delete process.env.CLAUDE_CODE_USE_GITHUB
		delete process.env.CLAUDE_CODE_USE_BEDROCK
		delete process.env.CLAUDE_CODE_USE_VERTEX
		delete process.env.CLAUDE_CODE_USE_FOUNDRY
		delete process.env.HTTPS_PROXY
		delete process.env.https_proxy
		delete process.env.HTTP_PROXY
		delete process.env.http_proxy
		delete process.env.ANTHROPIC_UNIX_SOCKET
		delete process.env.CLAUDE_CODE_CLIENT_CERT
		delete process.env.CLAUDE_CODE_CLIENT_KEY

		vi.doMock('./model/providers.js', () => ({
			getAPIProvider: () => 'firstParty',
		}))
		const fetchMock = vi.fn(() => Promise.resolve(new Response(null, { status: 200 })))
		globalThis.fetch = fetchMock as unknown as typeof globalThis.fetch

		const { preconnectAnthropicApi } = await importFreshModule()
		preconnectAnthropicApi()

		expect(fetchMock).toHaveBeenCalledTimes(1)
	})
})
