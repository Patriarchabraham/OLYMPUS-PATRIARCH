import { afterEach, beforeEach, expect, vi, test } from 'vitest'

// Mock the Anthropic-API-side before importing the module under test, so
// queryHaiku resolves into whatever the individual test wants (slow, failing,
// or successful). We preserve every other export from claude.js so unrelated
// transitive imports still work.
const haikuMock = vi.fn()

beforeEach(async () => {
  haikuMock.mockReset()
  const actual = await import('../../services/api/claude.js')
  vi.doMock('../../services/api/claude.js', () => ({
    ...actual,
    queryHaiku: haikuMock,
  }))
})

afterEach(() => {
  vi.restoreAllMocks()
})

async function runApply(markdown = 'Hello world.', signal?: AbortSignal): Promise<string> {
  vi.resetModules()
  const { applyPromptToMarkdown } =
    await vi.importActual('./utils.js') as typeof import('./utils.js')
  const ctrl = new AbortController()
  return applyPromptToMarkdown(
    'summarize',
    markdown,
    signal ?? ctrl.signal,
    false,
    false,
  )
}

test('returns raw truncated markdown when queryHaiku throws', async () => {
  haikuMock.mockImplementation(async () => {
    throw new Error('MiniMax rejected the model name')
  })

  const output = await runApply('Gitlawb homepage content.')
  expect(output).toContain('[Secondary-model summarization unavailable')
  expect(output).toContain('Gitlawb homepage content.')
})

test('returns raw truncated markdown when queryHaiku simulates a timeout', async () => {
  // Simulating raceWithTimeout's rejection path directly — we can't actually
  // wait 45s in a test. The error shape matches what raceWithTimeout produces.
  haikuMock.mockImplementation(async () => {
    const err = new Error('Secondary-model summarization timed out after 45000ms')
    ;(err as NodeJS.ErrnoException).code = 'SECONDARY_MODEL_TIMEOUT'
    throw err
  })

  const output = await runApply('Slow provider content.')
  expect(output).toContain('[Secondary-model summarization unavailable')
  expect(output).toContain('Slow provider content.')
})

test('returns the model response when queryHaiku succeeds', async () => {
  haikuMock.mockImplementation(async () => ({
    message: {
      content: [{ type: 'text', text: 'This page is about GitLawb, an AI legal platform.' }],
    },
  }))

  const output = await runApply('some page content')
  expect(output).toBe('This page is about GitLawb, an AI legal platform.')
})

test('returns fallback when queryHaiku resolves with empty content', async () => {
  haikuMock.mockImplementation(async () => ({ message: { content: [] } }))

  const output = await runApply('some page content')
  expect(output).toContain('[Secondary-model summarization unavailable')
  expect(output).toContain('some page content')
})

test('propagates AbortError from the caller signal', async () => {
  const ctrl = new AbortController()
  haikuMock.mockImplementation(async () => {
    ctrl.abort()
    return new Promise(() => {})
  })

  await expect(runApply('content', ctrl.signal)).rejects.toThrow()
})
