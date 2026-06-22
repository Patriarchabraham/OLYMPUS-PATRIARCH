import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest'

type HookChainsModule = typeof import('./hookChains.js')

type ImportHarnessOptions = {
	allowRemoteSessions?: boolean
	teamFile?: {
		name: string
		members: Array<{ name: string }>
	} | null
	teamName?: string
	senderName?: string
	replBridgeHandle?: unknown
}

const tempDirs: string[] = []
const originalHookChainsEnabled = process.env.CLAUDE_CODE_ENABLE_HOOK_CHAINS

// vi.mock() factories are hoisted to module top by Vitest and cannot close over
// per-call parameters. Hold the mutable harness state in a hoisted object the
// factories read from at call time (mirrors the fastMode.test.ts pattern).
// Stable spy references are also hoisted so the cached single import of
// hookChains always calls the same spy instances the test asserts against.
const harnessState = vi.hoisted(() => ({
	allowRemoteSessions: true,
	teamFile: null as { name: string; members: Array<{ name: string }> } | null,
	teamName: 'mesh-team',
	senderName: 'mesh-lead',
	replBridgeHandle: null as unknown,
	writeToMailboxSpy: vi.fn(async () => {}),
	agentToolCallSpy: vi.fn(async () => ({
		data: { status: 'async_launched', agentId: 'agent-fallback-1' },
	})),
}))

// Hoisted, process-global mocks apply to hookChains' imports (including the
// impl's dynamic import() sites). A single cached import of hookChains then
// picks up these mocks without per-test vi.importActual() — which triggered
// CJS-transform cold-start hangs (>30s) under the esbuild loader.
vi.mock('../services/analytics/index.js', () => ({
	logEvent: () => {},
}))

vi.mock('./telemetry/events.js', () => ({
	logOTelEvent: async () => {},
}))

vi.mock('../services/policyLimits/index.js', () => ({
	isPolicyAllowed: () => harnessState.allowRemoteSessions,
}))

vi.mock('./swarm/teamHelpers.js', () => ({
	readTeamFileAsync: async () => harnessState.teamFile,
}))

vi.mock('./teammateMailbox.js', () => ({
	writeToMailbox: harnessState.writeToMailboxSpy,
}))

vi.mock('./teammate.js', () => ({
	getAgentName: () => harnessState.senderName,
	getTeamName: () => harnessState.teamName,
	getTeammateColor: () => 'blue',
	isTeammate: () => false,
	isPlanModeRequired: () => false,
	getAgentId: () => undefined,
	getParentSessionId: () => undefined,
}))

vi.mock('../bridge/replBridgeHandle.js', () => ({
	getReplBridgeHandle: () => harnessState.replBridgeHandle,
}))

vi.mock('../tools/AgentTool/AgentTool.js', () => ({
	AgentTool: {
		call: harnessState.agentToolCallSpy,
	},
}))

// Cached single import — reused across tests to avoid repeated cold transforms.
let cachedModule: HookChainsModule | null = null

async function createConfigFile(config: unknown): Promise<string> {
	const dir = await mkdtemp(join(tmpdir(), 'Olympuz Coder-hook-chains-int-'))
	tempDirs.push(dir)
	const filePath = join(dir, 'hook-chains.json')
	await writeFile(filePath, JSON.stringify(config, null, 2), 'utf-8')
	return filePath
}

async function importHookChainsHarness(options: ImportHarnessOptions = {}): Promise<{
	mod: HookChainsModule
	writeToMailboxSpy: ReturnType<typeof vi.fn>
	agentToolCallSpy: ReturnType<typeof vi.fn>
}> {
	harnessState.allowRemoteSessions = options.allowRemoteSessions ?? true
	harnessState.teamFile = options.teamFile ?? null
	harnessState.teamName = options.teamName ?? 'mesh-team'
	harnessState.senderName = options.senderName ?? 'mesh-lead'
	harnessState.replBridgeHandle = options.replBridgeHandle ?? null

	// Clear spy call history between harness invocations so per-test assertions
	// start from a clean slate, while keeping the spy identity stable for the
	// cached module.
	harnessState.writeToMailboxSpy.mockClear()
	harnessState.agentToolCallSpy.mockClear()

	if (!cachedModule) {
		cachedModule = (await vi.importActual('./hookChains.js')) as HookChainsModule
	}
	return {
		mod: cachedModule,
		writeToMailboxSpy: harnessState.writeToMailboxSpy,
		agentToolCallSpy: harnessState.agentToolCallSpy,
	}
}

// Pay the one-time cold transform/import of hookChains (and its transitive
// graph) in a single beforeAll with an extended timeout. Under the esbuild CJS
// loader with Vite's inline-everything config this first import can exceed the
// default 30s hook timeout; subsequent tests reuse the cached module.
beforeAll(async () => {
	await importHookChainsHarness()
}, 90_000)

beforeEach(async () => {
	process.env.CLAUDE_CODE_ENABLE_HOOK_CHAINS = '1'
	const { mod } = await importHookChainsHarness()
	mod.resetHookChainsRuntimeStateForTests()
})

afterEach(async () => {
	vi.restoreAllMocks()

	if (originalHookChainsEnabled === undefined) {
		delete process.env.CLAUDE_CODE_ENABLE_HOOK_CHAINS
	} else {
		process.env.CLAUDE_CODE_ENABLE_HOOK_CHAINS = originalHookChainsEnabled
	}

	await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })))
})

describe('hookChains integration dispatch', () => {
	test('end-to-end rule evaluation + action dispatch on TaskCompleted failure', async () => {
		const { mod } = await importHookChainsHarness({
			teamName: 'mesh-team',
			senderName: 'mesh-lead',
			teamFile: {
				name: 'mesh-team',
				members: [{ name: 'mesh-lead' }, { name: 'worker-a' }, { name: 'worker-b' }],
			},
		})

		const configPath = await createConfigFile({
			version: 1,
			enabled: true,
			maxChainDepth: 3,
			defaultCooldownMs: 0,
			defaultDedupWindowMs: 0,
			rules: [
				{
					id: 'task-failure-recovery',
					trigger: { event: 'TaskCompleted', outcome: 'failed' },
					actions: [{ type: 'spawn_fallback_agent' }, { type: 'notify_team' }],
				},
			],
		})

		const spawnSpy = vi.fn(async () => ({ launched: true, agentId: 'agent-e2e-1' }))
		const notifySpy = vi.fn(async () => ({ sent: true, recipientCount: 2 }))

		const result = await mod.dispatchHookChainsForEvent({
			configPathOverride: configPath,
			event: {
				eventName: 'TaskCompleted',
				outcome: 'failed',
				payload: {
					task_id: 'task-001',
					task_subject: 'Patch flaky build',
					error: 'CI timeout',
				},
			},
			runtime: {
				onSpawnFallbackAgent: spawnSpy,
				onNotifyTeam: notifySpy,
			},
		})

		expect(result.enabled).toBe(true)
		expect(result.matchedRuleIds).toEqual(['task-failure-recovery'])
		expect(result.actionResults).toHaveLength(2)
		expect(result.actionResults[0]?.status).toBe('executed')
		expect(result.actionResults[1]?.status).toBe('executed')
		expect(spawnSpy).toHaveBeenCalledTimes(1)
		expect(notifySpy).toHaveBeenCalledTimes(1)
	})

	test('fallback spawn injects failure context into generated prompt', async () => {
		const { mod, agentToolCallSpy } = await importHookChainsHarness()

		const configPath = await createConfigFile({
			version: 1,
			enabled: true,
			maxChainDepth: 3,
			defaultCooldownMs: 0,
			defaultDedupWindowMs: 0,
			rules: [
				{
					id: 'fallback-context',
					trigger: { event: 'TaskCompleted', outcome: 'failed' },
					actions: [
						{
							type: 'spawn_fallback_agent',
							description: 'Fallback for failed task',
						},
					],
				},
			],
		})

		const result = await mod.dispatchHookChainsForEvent({
			configPathOverride: configPath,
			event: {
				eventName: 'TaskCompleted',
				outcome: 'failed',
				payload: {
					task_id: 'task-ctx-1',
					task_subject: 'Repair migration guard',
					task_description: 'Fix regression in check ordering',
					error: 'Task failed after retry budget exhausted',
				},
			},
			runtime: {
				onSpawnFallbackAgent: async (request) => {
					const { AgentTool } = await import('../tools/AgentTool/AgentTool.js')
					await (AgentTool.call as unknown as (...args: unknown[]) => Promise<unknown>)({
						prompt: request.prompt,
						description: request.description,
						run_in_background: request.runInBackground,
						subagent_type: request.agentType,
						model: request.model,
					})
					return { launched: true, agentId: 'agent-fallback-ctx' }
				},
			},
		})

		expect(result.actionResults[0]?.status).toBe('executed')
		expect(agentToolCallSpy).toHaveBeenCalledTimes(1)

		const callInput = agentToolCallSpy.mock.calls[0]?.[0] as {
			prompt: string
			description: string
			run_in_background: boolean
		}

		expect(callInput.description).toBe('Fallback for failed task')
		expect(callInput.run_in_background).toBe(true)
		expect(callInput.prompt).toContain('Event: TaskCompleted')
		expect(callInput.prompt).toContain('Outcome: failed')
		expect(callInput.prompt).toContain('Task subject: Repair migration guard')
		expect(callInput.prompt).toContain('Failure details: Task failed after retry budget exhausted')
	})

	test('notify_team dispatches mailbox writes when team exists and skips when absent', async () => {
		const withTeam = await importHookChainsHarness({
			teamName: 'mesh-a',
			senderName: 'lead-a',
			teamFile: {
				name: 'mesh-a',
				members: [{ name: 'lead-a' }, { name: 'worker-1' }, { name: 'worker-2' }],
			},
		})

		const configPathWithTeam = await createConfigFile({
			version: 1,
			enabled: true,
			maxChainDepth: 3,
			defaultCooldownMs: 0,
			defaultDedupWindowMs: 0,
			rules: [
				{
					id: 'notify-existing-team',
					trigger: { event: 'TaskCompleted', outcome: 'failed' },
					actions: [{ type: 'notify_team' }],
				},
			],
		})

		const withTeamResult = await withTeam.mod.dispatchHookChainsForEvent({
			configPathOverride: configPathWithTeam,
			event: {
				eventName: 'TaskCompleted',
				outcome: 'failed',
				payload: { task_id: 'task-team-ok', error: 'boom' },
			},
		})

		expect(withTeamResult.actionResults[0]?.status).toBe('executed')
		expect(withTeam.writeToMailboxSpy).toHaveBeenCalledTimes(2)

		const recipients = withTeam.writeToMailboxSpy.mock.calls.map((call) => call[0] as string)
		expect(recipients.sort()).toEqual(['worker-1', 'worker-2'])

		const withoutTeam = await importHookChainsHarness({
			teamName: 'mesh-missing',
			senderName: 'lead-missing',
			teamFile: null,
		})

		const configPathWithoutTeam = await createConfigFile({
			version: 1,
			enabled: true,
			maxChainDepth: 3,
			defaultCooldownMs: 0,
			defaultDedupWindowMs: 0,
			rules: [
				{
					id: 'notify-missing-team',
					trigger: { event: 'TaskCompleted', outcome: 'failed' },
					actions: [{ type: 'notify_team' }],
				},
			],
		})

		const withoutTeamResult = await withoutTeam.mod.dispatchHookChainsForEvent({
			configPathOverride: configPathWithoutTeam,
			event: {
				eventName: 'TaskCompleted',
				outcome: 'failed',
				payload: { task_id: 'task-team-missing', error: 'boom' },
			},
		})

		expect(withoutTeamResult.actionResults[0]?.status).toBe('skipped')
		expect(withoutTeamResult.actionResults[0]?.reason).toContain('Team file not found')
		expect(withoutTeam.writeToMailboxSpy).not.toHaveBeenCalled()
	})

	test('warm_remote_capacity is a safe no-op when bridge is inactive', async () => {
		const { mod } = await importHookChainsHarness({
			allowRemoteSessions: true,
			replBridgeHandle: null,
		})

		const configPath = await createConfigFile({
			version: 1,
			enabled: true,
			maxChainDepth: 3,
			defaultCooldownMs: 0,
			defaultDedupWindowMs: 0,
			rules: [
				{
					id: 'bridge-warmup-noop',
					trigger: { event: 'TaskCompleted', outcome: 'failed' },
					actions: [{ type: 'warm_remote_capacity' }],
				},
			],
		})

		const result = await mod.dispatchHookChainsForEvent({
			configPathOverride: configPath,
			event: {
				eventName: 'TaskCompleted',
				outcome: 'failed',
				payload: { task_id: 'task-warm-1' },
			},
		})

		expect(result.actionResults).toHaveLength(1)
		expect(result.actionResults[0]?.status).toBe('skipped')
		expect(result.actionResults[0]?.reason).toContain('Bridge is not active')
	})
})
