import { afterEach, beforeEach, describe, expect, vi, test } from 'vitest'
import axios from 'axios'

const originalEnv = { ...process.env }

async function importFreshModule() {
  vi.restoreAllMocks()
  vi.resetModules()
  return vi.importActual<typeof import('./officialRegistry')>('./officialRegistry.ts')
}

beforeEach(() => {
  process.env = { ...originalEnv }
})

afterEach(() => {
  process.env = { ...originalEnv }
  vi.restoreAllMocks()
})

describe('prefetchOfficialMcpUrls', () => {
  test('does not fetch registry when using OpenAI mode', async () => {
    process.env.CLAUDE_CODE_USE_OPENAI = '1'
    vi.doMock('../../utils/model/providers.js', () => ({
      getAPIProvider: () => 'openai',
    }))
    const getSpy = vi.fn(() => Promise.resolve({ data: { servers: [] } }))
    axios.get = getSpy as typeof axios.get

    const { prefetchOfficialMcpUrls } = await importFreshModule()
    await prefetchOfficialMcpUrls()

    expect(getSpy).not.toHaveBeenCalled()
  })

  test('does not fetch registry when using Gemini mode', async () => {
    process.env.CLAUDE_CODE_USE_GEMINI = '1'
    vi.doMock('../../utils/model/providers.js', () => ({
      getAPIProvider: () => 'gemini',
    }))
    const getSpy = vi.fn(() => Promise.resolve({ data: { servers: [] } }))
    axios.get = getSpy as typeof axios.get

    const { prefetchOfficialMcpUrls } = await importFreshModule()
    await prefetchOfficialMcpUrls()

    expect(getSpy).not.toHaveBeenCalled()
  })

  test('fetches registry in first-party mode', async () => {
    delete process.env.CLAUDE_CODE_USE_OPENAI
    delete process.env.CLAUDE_CODE_USE_GEMINI
    delete process.env.CLAUDE_CODE_USE_GITHUB

    vi.doMock('../../utils/model/providers.js', () => ({
      getAPIProvider: () => 'firstParty',
    }))
    const getSpy = vi.fn(() =>
      Promise.resolve({
        data: {
          servers: [{ server: { remotes: [{ url: 'https://example.com/mcp' }] } }],
        },
      }),
    )
    axios.get = getSpy as typeof axios.get

    const { prefetchOfficialMcpUrls, isOfficialMcpUrl } = await importFreshModule()
    await prefetchOfficialMcpUrls()

    expect(getSpy).toHaveBeenCalledTimes(1)
    expect(isOfficialMcpUrl('https://example.com/mcp')).toBe(true)
  })
})
