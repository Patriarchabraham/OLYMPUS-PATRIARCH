/**
 * Hook-side-effect regression lives in a separate file with no static import of
 * conversationRecovery so Bun's mock.module can replace sessionStart before
 * that module is first loaded.
 */
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeAll, expect, test, vi } from 'vitest'

const tempDirs: string[] = []
const originalEnv = { ...process.env }
const sessionId = '00000000-0000-4000-8000-000000001999'
const ts = '2026-04-02T00:00:00.000Z'

// vi.mock() factories are hoisted to module top by Vitest and cannot close over
// per-test parameters. Hold mutable mock state in a hoisted object the factories
// read at call time. The impl reads getAPIProvider() at CALL time, so a single
// cached module import respects per-test provider settings via this state.
const mockState = vi.hoisted(() => ({
	provider: 'firstParty' as string,
	sessionStartHook: null as null | ((...args: unknown[]) => Promise<unknown[]>),
}))

vi.mock('./model/providers.js', () => ({
	getAPIProvider: () => mockState.provider,
}))

vi.mock('./sessionStart.js', () => ({
	processSessionStartHooks: (...args: unknown[]) => {
		if (mockState.sessionStartHook) {
			return mockState.sessionStartHook(...args)
		}
		return Promise.resolve([])
	},
}))

// Cached single import — paid once in beforeAll (with extended timeout) to
// avoid per-test vi.importActual() cold-transform hangs (>30s) under the
// esbuild CJS loader for this module's transitive graph.
let conversationRecovery: typeof import('./conversationRecovery.ts') | null = null

function id(n: number): string {
	return `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
}

function user(uuid: string, content: string) {
	return {
		type: 'user',
		uuid,
		parentUuid: null,
		timestamp: ts,
		cwd: '/tmp',
		userType: 'external',
		sessionId,
		version: 'test',
		isSidechain: false,
		isMeta: false,
		message: {
			role: 'user',
			content,
		},
	}
}

async function writeJsonl(entry: unknown): Promise<string> {
	const dir = await mkdtemp(join(tmpdir(), 'Olympuz Coder-conversation-recovery-hooks-'))
	tempDirs.push(dir)
	const filePath = join(dir, 'resume.jsonl')
	await writeFile(filePath, `${JSON.stringify(entry)}\n`)
	return filePath
}

beforeAll(async () => {
	conversationRecovery = await vi.importActual('./conversationRecovery.ts')
}, 90_000)

afterEach(async () => {
	vi.restoreAllMocks()
	mockState.provider = 'firstParty'
	mockState.sessionStartHook = null
	process.env = { ...originalEnv }
	await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

test('loadConversationForResume rejects oversized transcripts before resume hooks run', async () => {
	delete process.env.CLAUDE_CODE_SIMPLE
	const hugeContent = 'x'.repeat(8 * 1024 * 1024 + 32 * 1024)
	const path = await writeJsonl(user(id(3), hugeContent))
	const hookSpy = vi.fn(() => Promise.resolve([{ type: 'hook' }]))
	mockState.sessionStartHook = hookSpy as never

	await expect(
		conversationRecovery!.loadConversationForResume('fixture', path),
	).rejects.toBeInstanceOf(conversationRecovery!.ResumeTranscriptTooLargeError)
	expect(hookSpy).not.toHaveBeenCalled()
})

test('deserializeMessagesWithInterruptDetection strips thinking blocks only for OpenAI-compatible providers', async () => {
	const serializedMessages = [
		user(id(10), 'hello'),
		{
			type: 'assistant',
			uuid: id(11),
			parentUuid: id(10),
			timestamp: ts,
			cwd: '/tmp',
			sessionId,
			version: 'test',
			message: {
				role: 'assistant',
				content: [
					{ type: 'thinking', thinking: 'secret reasoning' },
					{ type: 'text', text: 'visible reply' },
				],
			},
		},
		{
			type: 'assistant',
			uuid: id(12),
			parentUuid: id(11),
			timestamp: ts,
			cwd: '/tmp',
			sessionId,
			version: 'test',
			message: {
				role: 'assistant',
				content: [{ type: 'thinking', thinking: 'only hidden reasoning' }],
			},
		},
		user(id(13), 'follow up'),
	]

	// Third-party (OpenAI-compatible) provider: thinking blocks must be stripped.
	mockState.provider = 'openai'

	const thirdParty = conversationRecovery!.deserializeMessagesWithInterruptDetection(
		serializedMessages as never[],
	)
	const thirdPartyAssistantMessages = thirdParty.messages.filter(
		(message) => message.type === 'assistant',
	)

	expect(thirdPartyAssistantMessages).toHaveLength(2)
	expect(thirdPartyAssistantMessages[0]?.message?.content).toEqual([
		{ type: 'text', text: 'visible reply' },
	])
	expect(
		JSON.stringify(thirdPartyAssistantMessages.map((message) => message.message?.content)),
	).not.toContain('secret reasoning')
	expect(
		JSON.stringify(thirdPartyAssistantMessages.map((message) => message.message?.content)),
	).not.toContain('only hidden reasoning')

	// Anthropic-compatible provider (bedrock): thinking blocks must be retained.
	mockState.provider = 'bedrock'

	const anthropicCompatible = conversationRecovery!.deserializeMessagesWithInterruptDetection(
		serializedMessages as never[],
	)
	const anthropicAssistantMessages = anthropicCompatible.messages.filter(
		(message) => message.type === 'assistant',
	)

	expect(anthropicAssistantMessages).toHaveLength(2)
	expect(anthropicAssistantMessages[0]?.message?.content).toEqual([
		{ type: 'thinking', thinking: 'secret reasoning' },
		{ type: 'text', text: 'visible reply' },
	])
	expect(
		JSON.stringify(anthropicAssistantMessages.map((message) => message.message?.content)),
	).toContain('secret reasoning')
	expect(
		JSON.stringify(anthropicAssistantMessages.map((message) => message.message?.content)),
	).not.toContain('only hidden reasoning')
})
