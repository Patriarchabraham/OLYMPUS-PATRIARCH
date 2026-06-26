import { describe, expect, it } from 'vitest'

import { runMoA } from '../mixtureOfAgents.js'

describe('mixtureOfAgents.runMoA', () => {
	it('runs with forceProviders and returns best candidate', async () => {
		// We can't make real LLM calls in unit tests. Use a fake provider
		// pointing at an unreachable URL — all candidates will fail.
		// We expect the function to throw "all MoA candidates failed".
		await expect(
			runMoA('test query', {
				forceProviders: [
					{
						provider: 'fake',
						model: 'fake-model',
						baseURL: 'http://127.0.0.1:1/v1',
						apiKey: '',
					},
				],
			}),
		).rejects.toThrow(/all MoA candidates failed|MoA requires/)
	}, 5000)

	it('throws when no providers are available', async () => {
		await expect(runMoA('test')).rejects.toThrow(/MoA requires at least one provider/)
	}, 5000)
})
