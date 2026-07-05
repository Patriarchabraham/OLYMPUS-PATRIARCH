import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getOpsEngine, isOpsActive, resetOpsEngine } from '../../ops/opsEngine.js'
import { OPS_BUILD_TOOL_NAME, OpsBuildTool } from './OpsBuildTool.js'

describe('OpsBuild tool (RISK-3)', () => {
	beforeEach(() => {
		resetOpsEngine()
	})

	afterEach(() => {
		resetOpsEngine()
	})

	it('is named OpsBuild and is dormant under vitest by default', () => {
		expect(OPS_BUILD_TOOL_NAME).toBe('OpsBuild')
		expect(OpsBuildTool.name).toBe('OpsBuild')
		expect(isOpsActive()).toBe(false)
		expect(OpsBuildTool.isEnabled()).toBe(false)
		expect(OpsBuildTool.isReadOnly()).toBe(true)
		expect(OpsBuildTool.isConcurrencySafe()).toBe(true)
	})

	it('becomes enabled when the engine is forced active', () => {
		getOpsEngine().__setTestForceActive(true)
		expect(OpsBuildTool.isEnabled()).toBe(true)
	})

	it('call() produces an intent + delegation plan for a browser task', async () => {
		const out = (await OpsBuildTool.call({
			task: 'open the browser and find the cheapest flight to Lisbon',
		} as never)) as {
			data: import('./OpsBuildTool.js').OpsBuildOutput
		}
		const d = out.data
		expect(d.intent.surface).toBe('browser')
		expect(d.intent.isOpsRequest).toBe(true)
		expect(d.intent.confidence).toBeGreaterThan(0)
		expect(d.delegationInstructions).toContain('ops-browser-operator')
		expect(d.principlesRef).toContain('Ops PRD')
	})

	it('call() routes a PC task to the computer operator', async () => {
		const out = (await OpsBuildTool.call({
			task: 'control my pc and open notepad',
		} as never)) as { data: import('./OpsBuildTool.js').OpsBuildOutput }
		expect(out.data.intent.surface).toBe('computer')
		expect(out.data.delegationInstructions).toContain('ops-computer-operator')
	})

	it('call() surfaces governance notes when set', async () => {
		getOpsEngine().applyAdmin('browser.scope=example.com')
		const out = (await OpsBuildTool.call({
			task: 'open the browser and scrape',
		} as never)) as { data: import('./OpsBuildTool.js').OpsBuildOutput }
		expect(out.data.governanceNotes.some((n) => n.includes('browser.scope'))).toBe(true)
	})

	it('mapToolResultToToolResultBlockParam renders a readable text block', async () => {
		const out = (await OpsBuildTool.call({ task: 'click the save button' } as never)) as {
			data: import('./OpsBuildTool.js').OpsBuildOutput
		}
		const block = OpsBuildTool.mapToolResultToToolResultBlockParam(out.data, 'use_1')
		expect(block.tool_use_id).toBe('use_1')
		expect(block.type).toBe('tool_result')
		const content = block.content as string
		expect(content).toContain('Ops Department')
		expect(content).toContain('Ops PRD')
	})
})
