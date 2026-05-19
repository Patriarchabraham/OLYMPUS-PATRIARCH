import { afterEach, expect, test, vi } from 'vitest'

const originalClaudeCodeNewInit = process.env.CLAUDE_CODE_NEW_INIT

async function importInitCommand() {
	vi.resetModules()
	return ((await vi.importActual('./init.ts')) as any).default
}

afterEach(() => {
	vi.restoreAllMocks()

	if (originalClaudeCodeNewInit === undefined) {
		delete process.env.CLAUDE_CODE_NEW_INIT
	} else {
		process.env.CLAUDE_CODE_NEW_INIT = originalClaudeCodeNewInit
	}
})

test('NEW_INIT prompt preserves existing root CLAUDE.md by default', async () => {
	process.env.CLAUDE_CODE_NEW_INIT = '1'

	vi.mock('../projectOnboardingState.js', () => ({
		maybeMarkProjectOnboardingComplete: () => {},
	}))
	vi.mock('./initMode.js', () => ({
		isNewInitEnabled: () => true,
	}))

	const command = await importInitCommand()
	const blocks = await command.getPromptForCommand()

	expect(blocks).toHaveLength(1)
	expect(blocks[0]?.type).toBe('text')
	expect(String(blocks[0]?.text)).toContain(
		'checked-in root `CLAUDE.md` and does NOT already have a root `AGENTS.md`',
	)
	expect(String(blocks[0]?.text)).toContain('do NOT silently create a second root instruction file')
	expect(String(blocks[0]?.text)).toContain(
		'update the existing root `CLAUDE.md` in place by default',
	)
})
