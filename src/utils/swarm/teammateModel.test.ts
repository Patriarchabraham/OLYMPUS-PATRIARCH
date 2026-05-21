import { afterEach, expect, test, vi } from 'vitest'

const provider = vi.hoisted(() => {
	let value = 'mistral'
	return {
		get: () => value,
		set: (v: string) => {
			value = v
		},
	}
})

vi.mock('../model/providers.js', () => ({
	getAPIProvider: () => provider.get(),
}))

afterEach(() => {
	vi.restoreAllMocks()
})

async function importFreshTeammateModelModule(providerName = 'mistral') {
	provider.set(providerName)
	vi.resetModules()
	return vi.importActual<typeof import('./teammateModel.js')>('./teammateModel.js')
}

test('getHardcodedTeammateModelFallback returns a Mistral fallback in mistral mode', async () => {
	const { getHardcodedTeammateModelFallback } = await importFreshTeammateModelModule()

	expect(getHardcodedTeammateModelFallback()).toBe('devstral-latest')
})
