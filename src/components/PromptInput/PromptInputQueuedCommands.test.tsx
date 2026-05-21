import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { renderToString } from '../../utils/staticRender.js'

vi.mock('../../hooks/useTerminalSize.js', () => ({
  useTerminalSize: () => ({ columns: 100, rows: 24 }),
}))

vi.mock('../../hooks/useCommandQueue.js', () => ({
  useCommandQueue: () => [
    {
      value: 'Use another library',
      mode: 'prompt',
    },
  ],
}))

vi.mock('src/state/AppState.js', () => ({
  useAppState: (
    selector: (state: { viewingAgentTaskId?: string; isBriefOnly: boolean }) => unknown,
  ) => selector({ viewingAgentTaskId: undefined, isBriefOnly: false }),
}))

describe('PromptInputQueuedCommands', () => {
  it('shows a next-turn guidance banner for queued prompt messages', async () => {
    const { PromptInputQueuedCommands } = await import('./PromptInputQueuedCommands.js')

    const output = await renderToString(<PromptInputQueuedCommands />, 100)

    expect(output).toContain('1 message queued for next turn')
    expect(output).toContain('Use another library')
  })
})
