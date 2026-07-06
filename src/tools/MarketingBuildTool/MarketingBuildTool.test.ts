import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
	getMarketingEngine,
	isMarketingActive,
	resetMarketingEngine,
} from '../../marketing/marketingEngine.js'
import { MARKETING_BUILD_TOOL_NAME, MarketingBuildTool } from './MarketingBuildTool.js'

describe('MarketingBuild tool (RISK-3)', () => {
	beforeEach(() => {
		resetMarketingEngine()
	})

	afterEach(() => {
		resetMarketingEngine()
	})

	it('is named MarketingBuild and is dormant under vitest by default', () => {
		expect(MARKETING_BUILD_TOOL_NAME).toBe('MarketingBuild')
		expect(MarketingBuildTool.name).toBe('MarketingBuild')
		expect(isMarketingActive()).toBe(false)
		expect(MarketingBuildTool.isEnabled()).toBe(false)
		expect(MarketingBuildTool.isReadOnly()).toBe(true)
		expect(MarketingBuildTool.isConcurrencySafe()).toBe(true)
	})

	it('becomes enabled when the engine is forced active', () => {
		getMarketingEngine().__setTestForceActive(true)
		expect(MarketingBuildTool.isEnabled()).toBe(true)
	})

	it('call() produces an intent + delegation plan for a campaign brief', async () => {
		const out = (await MarketingBuildTool.call({
			brief: 'launch campaign for Olympuz Coder on x and linkedin',
		} as never)) as {
			data: import('./MarketingBuildTool.js').MarketingBuildOutput
		}
		const d = out.data
		expect(d.intent.isMarketingRequest).toBe(true)
		expect(d.intent.confidence).toBeGreaterThan(0)
		expect(d.delegationInstructions).toContain('marketing-director')
		expect(d.delegationInstructions.toLowerCase()).toContain('campaign plan')
		expect(d.principlesRef).toContain('Marketing PRD')
	})

	it('call() surfaces governance notes when set', async () => {
		getMarketingEngine().applyAdmin('director.publish.approvalPolicy=ask-always')
		const out = (await MarketingBuildTool.call({
			brief: 'launch campaign',
		} as never)) as { data: import('./MarketingBuildTool.js').MarketingBuildOutput }
		expect(out.data.governanceNotes.some((n) => n.includes('publish.approvalPolicy'))).toBe(true)
	})

	it('mapToolResultToToolResultBlockParam renders a readable text block', async () => {
		const out = (await MarketingBuildTool.call({ brief: 'launch campaign' } as never)) as {
			data: import('./MarketingBuildTool.js').MarketingBuildOutput
		}
		const block = MarketingBuildTool.mapToolResultToToolResultBlockParam(out.data, 'use_1')
		expect(block.tool_use_id).toBe('use_1')
		expect(block.type).toBe('tool_result')
		const content = block.content as string
		expect(content).toContain('Marketing Department')
		expect(content).toContain('Marketing PRD')
	})
})
