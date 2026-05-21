import { describe, test, expect, vi } from 'vitest'

// Hoisted mock for providers module used by all tests in this file.
// vi.mock is hoisted to the top of the file by Vitest regardless of
// where it appears in source, so the factory runs before any import.
let mockGetAPIProvider: () => string = () => 'openai'
let mockIsFirstPartyAnthropicBaseUrl: () => boolean = () => false

vi.mock('./providers.js', () => ({
  get getAPIProvider() { return mockGetAPIProvider },
  get isFirstPartyAnthropicBaseUrl() { return mockIsFirstPartyAnthropicBaseUrl },
}))

// Also mock the model.js and aliases.js dependencies that agent.ts imports
vi.mock('./model.js', () => ({
  getCanonicalName: (m: string) => m.toLowerCase(),
  getRuntimeMainLoopModel: (opts: { mainLoopModel: string }) => opts.mainLoopModel,
  parseUserSpecifiedModel: (m: string) => m,
}))

vi.mock('./aliases.js', () => ({
  MODEL_ALIASES: ['haiku', 'sonnet', 'opus'],
}))

vi.mock('./bedrock.js', () => ({
  getBedrockRegionPrefix: () => '',
  applyBedrockRegionPrefix: (m: string) => m,
}))

import { getAgentModel, checkIsClaudeNativeProvider } from './agent.js'

describe('getAgentModel provider-aware fallback', () => {
  describe('Claude-native providers', () => {
    test('haiku alias resolves to haiku model for official Anthropic API', () => {
      mockGetAPIProvider = () => 'firstParty'
      mockIsFirstPartyAnthropicBaseUrl = () => true

      const result = getAgentModel('haiku', 'claude-sonnet-4-6', undefined, 'default')

      // Should resolve haiku alias, not inherit parent
      expect(result).toContain('haiku')
      expect(result).not.toBe('claude-sonnet-4-6')
    })

    test('haiku alias resolves for Bedrock provider', () => {
      mockGetAPIProvider = () => 'bedrock'
      mockIsFirstPartyAnthropicBaseUrl = () => false

      const result = getAgentModel('haiku', 'claude-sonnet-4-6', undefined, 'default')

      // Should resolve haiku alias for Bedrock
      expect(result).toContain('haiku')
    })

    test('haiku alias resolves for Vertex provider', () => {
      mockGetAPIProvider = () => 'vertex'
      mockIsFirstPartyAnthropicBaseUrl = () => false

      const result = getAgentModel('haiku', 'claude-sonnet-4-6', undefined, 'default')

      // Should resolve haiku alias for Vertex
      expect(result).toContain('haiku')
    })

    test('haiku alias resolves for Foundry provider', () => {
      mockGetAPIProvider = () => 'foundry'
      mockIsFirstPartyAnthropicBaseUrl = () => false

      const result = getAgentModel('haiku', 'claude-sonnet-4-6', undefined, 'default')

      // Should resolve haiku alias for Foundry
      expect(result).toContain('haiku')
    })
  })

  describe('Non-Claude-native providers', () => {
    test('haiku alias inherits parent model for OpenAI provider', () => {
      mockGetAPIProvider = () => 'openai'
      mockIsFirstPartyAnthropicBaseUrl = () => false

      const result = getAgentModel('haiku', 'gpt-4o-mini', undefined, 'default')

      // Should inherit parent model for OpenAI (no haiku concept)
      expect(result).toBe('gpt-4o-mini')
    })

    test('haiku alias inherits parent model for Gemini provider', () => {
      mockGetAPIProvider = () => 'gemini'
      mockIsFirstPartyAnthropicBaseUrl = () => false

      const result = getAgentModel('haiku', 'gemini-2.5-pro', undefined, 'default')

      // Should inherit parent model for Gemini
      expect(result).toBe('gemini-2.5-pro')
    })

    test('haiku alias inherits parent model for custom Anthropic-compatible URL', () => {
      // firstParty provider but with custom URL (not official Anthropic)
      mockGetAPIProvider = () => 'firstParty'
      mockIsFirstPartyAnthropicBaseUrl = () => false

      const result = getAgentModel('haiku', 'claude-sonnet-4-6', undefined, 'default')

      // Should inherit parent for custom Anthropic-compatible URL
      expect(result).toBe('claude-sonnet-4-6')
    })

    test('sonnet alias inherits parent model for OpenAI provider', () => {
      mockGetAPIProvider = () => 'openai'
      mockIsFirstPartyAnthropicBaseUrl = () => false

      const result = getAgentModel('sonnet', 'gpt-4o-mini', undefined, 'default')

      // Should inherit parent model for OpenAI
      expect(result).toBe('gpt-4o-mini')
    })

    test('haiku alias inherits parent model for Mistral provider', () => {
      mockGetAPIProvider = () => 'mistral'
      mockIsFirstPartyAnthropicBaseUrl = () => false

      const result = getAgentModel('haiku', 'mistral-small-latest', undefined, 'default')

      // Should inherit parent model for Mistral (no haiku concept)
      expect(result).toBe('mistral-small-latest')
    })

    test('haiku alias inherits parent model for GitHub Copilot provider', () => {
      mockGetAPIProvider = () => 'github'
      mockIsFirstPartyAnthropicBaseUrl = () => false

      const result = getAgentModel('haiku', 'gpt-4o-mini', undefined, 'default')

      // Should inherit parent model for GitHub Copilot
      expect(result).toBe('gpt-4o-mini')
    })

    test('haiku alias inherits parent model for NVIDIA NIM provider', () => {
      mockGetAPIProvider = () => 'nvidia-nim'
      mockIsFirstPartyAnthropicBaseUrl = () => false

      const result = getAgentModel('haiku', 'meta/llama-3.1-8b-instruct', undefined, 'default')

      // Should inherit parent model for NVIDIA NIM (no haiku concept)
      expect(result).toBe('meta/llama-3.1-8b-instruct')
    })

    test('haiku alias inherits parent model for MiniMax provider', () => {
      mockGetAPIProvider = () => 'minimax'
      mockIsFirstPartyAnthropicBaseUrl = () => false

      const result = getAgentModel('haiku', 'MiniMax-M2.5-highspeed', undefined, 'default')

      // Should inherit parent model for MiniMax (no haiku concept)
      expect(result).toBe('MiniMax-M2.5-highspeed')
    })

    test('haiku alias inherits parent model for Codex provider', () => {
      mockGetAPIProvider = () => 'codex'
      mockIsFirstPartyAnthropicBaseUrl = () => false

      const result = getAgentModel('haiku', 'gpt-5.5-mini', undefined, 'default')

      // Should inherit parent model for Codex provider (no haiku concept)
      expect(result).toBe('gpt-5.5-mini')
    })
  })

  describe('inherit behavior unchanged', () => {
    test('inherit always returns parent model regardless of provider', () => {
      mockGetAPIProvider = () => 'openai'
      mockIsFirstPartyAnthropicBaseUrl = () => false

      const result = getAgentModel('inherit', 'gpt-4o', undefined, 'default')

      expect(result).toBe('gpt-4o')
    })
  })

  describe('checkIsClaudeNativeProvider helper', () => {
    test('returns true for official Anthropic API', () => {
      mockGetAPIProvider = () => 'firstParty'
      mockIsFirstPartyAnthropicBaseUrl = () => true

      expect(checkIsClaudeNativeProvider()).toBe(true)
    })

    test('returns true for Bedrock provider', () => {
      mockGetAPIProvider = () => 'bedrock'
      mockIsFirstPartyAnthropicBaseUrl = () => false

      expect(checkIsClaudeNativeProvider()).toBe(true)
    })

    test('returns true for Vertex provider', () => {
      mockGetAPIProvider = () => 'vertex'
      mockIsFirstPartyAnthropicBaseUrl = () => false

      expect(checkIsClaudeNativeProvider()).toBe(true)
    })

    test('returns true for Foundry provider', () => {
      mockGetAPIProvider = () => 'foundry'
      mockIsFirstPartyAnthropicBaseUrl = () => false

      expect(checkIsClaudeNativeProvider()).toBe(true)
    })

    test('returns false for OpenAI provider', () => {
      mockGetAPIProvider = () => 'openai'
      mockIsFirstPartyAnthropicBaseUrl = () => false

      expect(checkIsClaudeNativeProvider()).toBe(false)
    })

    test('returns false for custom Anthropic URL', () => {
      mockGetAPIProvider = () => 'firstParty'
      mockIsFirstPartyAnthropicBaseUrl = () => false

      expect(checkIsClaudeNativeProvider()).toBe(false)
    })
  })
})