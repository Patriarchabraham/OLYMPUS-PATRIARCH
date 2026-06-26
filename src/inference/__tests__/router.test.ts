import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { ProviderProfile } from '../../utils/config.js'

// --- Mocks ---

const mockProfiles: ProviderProfile[] = []
let mockActiveProfile: ProviderProfile | undefined

vi.mock('../../utils/config.js', () => ({
	getGlobalConfig: () => ({
		providerProfiles: mockProfiles,
		activeProviderProfileId: mockActiveProfile?.id,
	}),
}))

vi.mock('../../utils/providerProfiles.js', () => ({
	getActiveProviderProfile: () => mockActiveProfile,
}))

// Import after mocks are registered.
const { route, resolveFamily } = await import('../router.js')
const { recordCost, _setLedgerPathForTest, resetStatsCache } = await import('../costLedger.js')
const { mkdtempSync, rmSync } = await import('node:fs')
const { tmpdir } = await import('node:os')
const { join } = await import('node:path')

let tempDir: string

beforeEach(() => {
	tempDir = mkdtempSync(join(tmpdir(), 'olympuz-router-'))
	_setLedgerPathForTest(join(tempDir, 'costs.jsonl'))
	resetStatsCache()
	mockProfiles.length = 0
	mockActiveProfile = undefined
})

afterEach(() => {
	rmSync(tempDir, { recursive: true, force: true })
})

describe('router.resolveFamily', () => {
	it('classifies known provider strings', () => {
		expect(resolveFamily('anthropic', '')).toBe('anthropic')
		expect(resolveFamily('openai', '')).toBe('openai')
		expect(resolveFamily('mistral', '')).toBe('mistral')
		expect(resolveFamily('deepseek', '')).toBe('deepseek')
		expect(resolveFamily('qwen', '')).toBe('qwen')
		expect(resolveFamily('xai', '')).toBe('xai')
	})

	it('detects local providers via baseURL', () => {
		expect(resolveFamily('custom', 'http://localhost:11434/v1')).toBe('local')
		expect(resolveFamily('custom', 'http://127.0.0.1:8080')).toBe('local')
		expect(resolveFamily('custom', 'https://api.openai.com')).toBe('unknown')
	})
})

describe('router.route', () => {
	it('providerOverride wins unconditionally', async () => {
		const decision = await route({
			queryText: 'anything',
			contextTokenEstimate: 0,
			toolBudget: 0,
			providerOverride: {
				model: 'gpt-5',
				baseURL: 'https://api.openai.com',
				apiKey: 'sk-test',
			},
		})
		expect(decision.provider).toBe('override')
		expect(decision.model).toBe('gpt-5')
		expect(decision.baseURL).toBe('https://api.openai.com')
		expect(decision.reason).toContain('override')
	})

	it('highest-priority rule wins', async () => {
		mockProfiles.push({
			id: 'ollama',
			name: 'Ollama Local',
			provider: 'ollama',
			baseUrl: 'http://localhost:11434/v1',
			model: 'qwen2.5-coder:7b',
		})

		const decision = await route(
			{
				queryText: 'fix typo in README',
				contextTokenEstimate: 0,
				toolBudget: 0,
			},
			{
				rules: [
					{
						condition: { taskType: 'trivial_fix' },
						provider: 'ollama',
						model: 'qwen2.5-coder:7b',
						priority: 1,
					},
				],
				costOptimization: true,
				latencyOptimization: true,
			},
		)

		expect(decision.provider).toBe('ollama')
		expect(decision.model).toBe('qwen2.5-coder:7b')
		expect(decision.reason).toContain('rule')
	})

	it('falls back to active profile when no rules and no stats', async () => {
		// Push active profile
		const profile: ProviderProfile = {
			id: 'primary',
			name: 'Primary',
			provider: 'openai',
			baseUrl: 'https://api.openai.com',
			model: 'gpt-4o',
		}
		mockProfiles.push(profile)
		mockActiveProfile = profile

		const decision = await route({
			queryText: 'add a feature',
			contextTokenEstimate: 0,
			toolBudget: 0,
		})
		expect(decision.provider).toBe('openai')
		expect(decision.reason).toContain('active provider profile')
	})

	it('scores providers using cost/latency/success stats', async () => {
		// Two configured providers
		mockProfiles.push(
			{
				id: 'ollama',
				name: 'Ollama',
				provider: 'ollama',
				baseUrl: 'http://localhost:11434/v1',
				model: 'qwen2.5-coder:7b',
			},
			{
				id: 'openai',
				name: 'OpenAI',
				provider: 'openai',
				baseUrl: 'https://api.openai.com',
				model: 'gpt-4o',
			},
		)

		// Seed ledger with stats — Ollama is faster and cheaper
		recordCost({
			timestamp: Date.now(),
			provider: 'ollama',
			model: 'qwen2.5-coder:7b',
			family: 'local',
			inputTokens: 100,
			outputTokens: 50,
			costUsd: 0,
			latencyMs: 200,
			taskType: 'feature_impl',
			success: true,
		})
		recordCost({
			timestamp: Date.now(),
			provider: 'openai',
			model: 'gpt-4o',
			family: 'openai',
			inputTokens: 100,
			outputTokens: 50,
			costUsd: 0.05,
			latencyMs: 2000,
			taskType: 'feature_impl',
			success: true,
		})
		resetStatsCache()

		const decision = await route({
			queryText: 'add a function',
			contextTokenEstimate: 0,
			toolBudget: 0,
		})

		expect(decision.provider).toBe('ollama')
		expect(decision.reason).toContain('scored best')
	})
})
