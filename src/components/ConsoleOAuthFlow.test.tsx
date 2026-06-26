import { PassThrough } from 'node:stream'
import type React from 'react'
import stripAnsi from 'strip-ansi'
import { expect, test } from 'vitest'
import { sleep } from '../__tests__/_bunCompat.js'
import { createRoot } from '../ink.js'
import { KeybindingSetup } from '../keybindings/KeybindingProviderSetup.js'
import { AppStateProvider } from '../state/AppState.js'
import { ConsoleOAuthFlow } from './ConsoleOAuthFlow.js'

const SYNC_START = '\x1B[?2026h'
const SYNC_END = '\x1B[?2026l'

function extractLastFrame(output: string): string {
	let lastFrame: string | null = null
	let cursor = 0

	while (cursor < output.length) {
		const start = output.indexOf(SYNC_START, cursor)
		if (start === -1) {
			break
		}

		const contentStart = start + SYNC_START.length
		const end = output.indexOf(SYNC_END, contentStart)
		if (end === -1) {
			break
		}

		const frame = output.slice(contentStart, end)
		if (frame.trim().length > 0) {
			lastFrame = frame
		}
		cursor = end + SYNC_END.length
	}

	return lastFrame ?? output
}

function createTestStreams(): {
	stdout: PassThrough
	stdin: PassThrough & {
		isTTY: boolean
		setRawMode: (mode: boolean) => void
		ref: () => void
		unref: () => void
	}
	getOutput: () => string
} {
	let output = ''
	const stdout = new PassThrough()
	const stdin = new PassThrough() as PassThrough & {
		isTTY: boolean
		setRawMode: (mode: boolean) => void
		ref: () => void
		unref: () => void
	}

	stdin.isTTY = true
	stdin.setRawMode = () => {}
	stdin.ref = () => {}
	stdin.unref = () => {}
	;(stdout as unknown as { columns: number }).columns = 120
	stdout.on('data', (chunk) => {
		output += chunk.toString()
	})

	return {
		stdout,
		stdin,
		getOutput: () => output,
	}
}

async function renderFrame(node: React.ReactNode): Promise<string> {
	const { stdout, stdin, getOutput } = createTestStreams()
	const root = await createRoot({
		stdout: stdout as unknown as NodeJS.WriteStream,
		stdin: stdin as unknown as NodeJS.ReadStream,
		patchConsole: false,
	})

	root.render(
		<AppStateProvider>
			<KeybindingSetup>{node}</KeybindingSetup>
		</AppStateProvider>,
	)

	await sleep(50)
	root.unmount()
	stdin.end()
	stdout.end()
	await sleep(25)

	return stripAnsi(extractLastFrame(getOutput()))
}

// TODO(systemic): skipped because of a Vite SSR TDZ
// ("Cannot access '__vite_ssr_import_N__' before initialization" at
// getDefaultAppState in AppStateStore) that ONLY manifests under the full
// suite, never in isolation. Root cause: the codebase has thousands of circular
// imports (madge reports 2583) and vitest runs with singleFork
// (vitest.config.ts, set to avoid OOM across forks), so the collect phase
// imports every test file into one shared module graph and leaves a binding in
// the TDZ by the time AppStateProvider renders. These tests PASS in isolation
// (`vitest run src/components/ConsoleOAuthFlow.test.tsx`), so the component is
// correct. Unblock by untangling the circular deps around AppStateStore/AppState
// (notably the settings/provider/inference modules) or by removing singleFork
// once OOM is otherwise solved.
test.skip('login picker shows the third-party platform option', async () => {
	const output = await renderFrame(<ConsoleOAuthFlow onDone={() => {}} />)

	expect(output).toContain('Select login method:')
	expect(output).toContain('3rd-party platform')
})

// See TODO(systemic) above — same TDZ-under-full-suite blocker.
test.skip('third-party provider branch opens the first-run provider manager', async () => {
	const output = await renderFrame(
		<ConsoleOAuthFlow initialStatus={{ state: 'platform_setup' }} onDone={() => {}} />,
	)

	expect(output).toContain('Set up provider')
	// Anthropic is pinned first and the remaining presets stay near
	// description order, so these sentinel labels should remain visible
	// in the 13-row test frame.
	expect(output).toContain('Anthropic')
	expect(output).toContain('Azure OpenAI')
	expect(output).toContain('DeepSeek')
	expect(output).toContain('Google Gemini')
})
