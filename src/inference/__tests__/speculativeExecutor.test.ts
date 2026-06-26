import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { heuristicScore, speculativeExecute } from '../speculativeExecutor.js'

// Mock localModel so we don't need a real Ollama server.
vi.mock('../localModel.js', () => ({
	// Default to "not ready" — individual tests override.
	isLocalReady: vi.fn(async () => false),
	draftResponse: vi.fn(async () => 'mocked local draft response'),
	verifyOutput: vi.fn(async () => ({ confidence: 0.9, concerns: [] as string[] })),
	DEFAULT_LOCAL_MODEL: 'gemma3:4b',
	DEFAULT_LOCAL_ENDPOINT: 'http://localhost:11434',
	invalidateReadinessCache: vi.fn(),
	getLocalModelName: vi.fn(() => 'gemma3:4b'),
	getLocalEndpoint: vi.fn(() => 'http://localhost:11434'),
	compressPrompt: vi.fn(async (p: string) => p),
	pullModelInBackground: vi.fn(async () => undefined),
}))

// Grab the mocked functions so tests can configure them per-case.
const localModel = await import('../localModel.js')

describe('heuristicScore', () => {
	it('returns 0 for empty draft', () => {
		expect(heuristicScore('how do I do X?', '')).toBe(0)
	})

	it('returns 0 for very short draft', () => {
		expect(heuristicScore('how do I do X?', 'too short')).toBe(0)
	})

	it('scores a clean medium-length response highly', () => {
		const draft =
			'You can accomplish this by using a for-loop to iterate over the items and applying the transform function to each one.'
		const score = heuristicScore('How do I transform items?', draft)
		expect(score).toBeGreaterThan(0.6)
	})

	it('penalizes early failure markers', () => {
		const draft = "I'm sorry, I can't help with that particular request due to policy restrictions."
		const score = heuristicScore('anything', draft)
		expect(score).toBeLessThan(0.4)
	})

	it('rewards balanced code fences for code queries', () => {
		const draft = 'Here is the fix:\n\n```ts\nconst x = 1\n```\n\nThis works because of reasons.'
		const score = heuristicScore('fix the bug', draft)
		expect(score).toBeGreaterThan(0.7)
	})

	it('penalizes unbalanced code fences', () => {
		const draft = 'Here is the fix:\n\n```ts\nconst x = 1\n\nThis works because of reasons.'
		const score = heuristicScore('fix the bug', draft)
		expect(score).toBeLessThan(0.8)
	})

	it('clamps to [0, 1]', () => {
		// Pathological inputs shouldn't blow the range.
		const long = 'a'.repeat(10_000)
		const score = heuristicScore('query', long)
		expect(score).toBeGreaterThanOrEqual(0)
		expect(score).toBeLessThanOrEqual(1)
	})
})

describe('speculativeExecute', () => {
	const originalFetch = globalThis.fetch

	beforeEach(() => {
		vi.mocked(localModel.isLocalReady).mockResolvedValue(false)
		vi.mocked(localModel.draftResponse).mockResolvedValue('mocked local draft response')
		vi.mocked(localModel.verifyOutput).mockResolvedValue({ confidence: 0.9, concerns: [] })
	})

	afterEach(() => {
		globalThis.fetch = originalFetch
		vi.restoreAllMocks()
	})

	it('returns cloud_only when local model is not ready', async () => {
		vi.mocked(localModel.isLocalReady).mockResolvedValue(false)
		globalThis.fetch = vi.fn(async () => ({
			ok: true,
			text: async () => '{}',
			json: async () => ({
				choices: [{ message: { content: 'Cloud response that is long enough.' } }],
			}),
		})) as unknown as typeof fetch
		const result = await speculativeExecute('test query', {
			cloudProvider: {
				provider: 'openai',
				model: 'gpt-4o-mini',
				baseURL: 'https://api.openai.com/v1',
				apiKey: 'test',
			},
		})
		expect(result.source).toBe('cloud_only')
		expect(result.usedLocalDraft).toBe(false)
	})

	it('returns local_only when local is ready but no cloud configured', async () => {
		vi.mocked(localModel.isLocalReady).mockResolvedValue(true)
		vi.mocked(localModel.draftResponse).mockResolvedValue(
			'Here is a complete and helpful response that meets the length requirement.',
		)
		const result = await speculativeExecute('test query')
		expect(result.source).toBe('local_only')
		expect(result.usedLocalDraft).toBe(true)
		expect(result.content.length).toBeGreaterThan(20)
	})

	it('returns local_accepted when draft passes threshold', async () => {
		vi.mocked(localModel.isLocalReady).mockResolvedValue(true)
		vi.mocked(localModel.draftResponse).mockResolvedValue(
			'You can fix this by updating the configuration file and restarting the server afterwards.',
		)
		const result = await speculativeExecute('how to fix the server?', {
			acceptThreshold: 0.5,
			cloudProvider: {
				provider: 'openai',
				model: 'gpt-4o-mini',
				baseURL: 'https://example.invalid',
				apiKey: 'test',
			},
		})
		expect(result.source).toBe('local_accepted')
		expect(result.usedLocalDraft).toBe(true)
		expect(result.draftConfidence).toBeGreaterThan(0.5)
	})

	it('falls back to cloud when draft is too short', async () => {
		vi.mocked(localModel.isLocalReady).mockResolvedValue(true)
		vi.mocked(localModel.draftResponse).mockResolvedValue('short')

		// Mock fetch for the cloud call.
		globalThis.fetch = vi.fn(async () => ({
			ok: true,
			text: async () => '{}',
			json: async () => ({
				choices: [{ message: { content: 'Cloud response that is long enough.' } }],
			}),
		})) as unknown as typeof fetch

		const result = await speculativeExecute('test', {
			cloudProvider: {
				provider: 'openai',
				model: 'gpt-4o-mini',
				baseURL: 'https://api.openai.com/v1',
				apiKey: 'k',
			},
		})
		expect(result.source).toBe('cloud_only')
		expect(result.usedLocalDraft).toBe(false)
	})

	it('uses deepVerify when enabled and quality is borderline', async () => {
		vi.mocked(localModel.isLocalReady).mockResolvedValue(true)
		vi.mocked(localModel.draftResponse).mockResolvedValue(
			'Here is a balanced code answer:\n\n```ts\nfunction f() { return 1 }\n```\n\nThat should work.',
		)
		vi.mocked(localModel.verifyOutput).mockResolvedValue({
			confidence: 0.95,
			concerns: [],
		})
		const result = await speculativeExecute('fix the function', {
			deepVerify: true,
			acceptThreshold: 0.7,
		})
		expect(localModel.verifyOutput).toHaveBeenCalled()
		expect(result.source).toBe('local_only')
		expect(result.usedLocalDraft).toBe(true)
		expect(result.concerns).toEqual([])
	})

	it('penalizes deepVerify concerns', async () => {
		vi.mocked(localModel.isLocalReady).mockResolvedValue(true)
		vi.mocked(localModel.draftResponse).mockResolvedValue(
			'Here is a balanced code answer:\n\n```ts\nfunction f() { return 1 }\n```\n\nThat should work.',
		)
		vi.mocked(localModel.verifyOutput).mockResolvedValue({
			confidence: 0.3,
			concerns: ['missing error handling', 'no tests', 'unsafe cast'],
		})

		// Cloud configured — should reject local draft and fall back.
		globalThis.fetch = vi.fn(async () => ({
			ok: true,
			text: async () => '{}',
			json: async () => ({
				choices: [{ message: { content: 'A much better cloud response with full detail.' } }],
			}),
		})) as unknown as typeof fetch

		const result = await speculativeExecute('fix the function', {
			deepVerify: true,
			acceptThreshold: 0.7,
			cloudProvider: {
				provider: 'openai',
				model: 'gpt-4o-mini',
				baseURL: 'https://api.openai.com/v1',
				apiKey: 'k',
			},
		})
		expect(localModel.verifyOutput).toHaveBeenCalled()
		expect(result.usedLocalDraft).toBe(false)
		expect(result.concerns.length).toBeGreaterThan(0)
	})

	it('respects localTimeoutMs', async () => {
		vi.mocked(localModel.isLocalReady).mockResolvedValue(true)
		// draftResponse hangs forever; should time out.
		vi.mocked(localModel.draftResponse).mockImplementation(() => new Promise<string>(() => {}))

		globalThis.fetch = vi.fn(async () => ({
			ok: true,
			text: async () => '{}',
			json: async () => ({
				choices: [{ message: { content: 'Cloud response that is long enough to pass.' } }],
			}),
		})) as unknown as typeof fetch

		const result = await speculativeExecute('test', {
			localTimeoutMs: 50,
			cloudProvider: {
				provider: 'openai',
				model: 'gpt-4o-mini',
				baseURL: 'https://api.openai.com/v1',
				apiKey: 'k',
			},
		})
		expect(result.source).toBe('cloud_only')
		expect(result.usedLocalDraft).toBe(false)
	}, 5_000)

	it('records latencyMs for every call', async () => {
		vi.mocked(localModel.isLocalReady).mockResolvedValue(false)
		const result = await speculativeExecute('test')
		expect(result.latencyMs).toBeGreaterThanOrEqual(0)
		expect(typeof result.latencyMs).toBe('number')
	})
})
