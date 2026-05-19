import { afterEach, expect, test, vi } from 'vitest'

afterEach(() => {
	vi.restoreAllMocks()
})

async function importFreshTeammateModelModule(provider = 'mistral') {
	vi.restoreAllMocks()
	vi.mock('../model/providers.js', () => ({
		getAPIProvider: () => provider,
	}))
	const nonce = `${Date.now()}-${Math.random()}`
	void nonce
	vi.resetModules()
	return vi.importActual('./teammateModel.js')
}

test('getHardcodedTeammateModelFallback returns a Mistral fallback in mistral mode', async () => {
	const { getHardcodedTeammateModelFallback } = await importFreshTeammateModelModule()

	expect(getHardcodedTeammateModelFallback()).toBe('devstral-latest')
})
