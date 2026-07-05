import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getStudioEngine, isStudioActive, resetStudioEngine } from '../../studio/studioEngine.js'
import { STUDIO_BUILD_TOOL_NAME, StudioBuildTool } from './StudioBuildTool.js'

describe('StudioBuild tool (RISK-3)', () => {
	beforeEach(() => {
		resetStudioEngine()
	})

	afterEach(() => {
		resetStudioEngine()
	})

	it('is named StudioBuild and is dormant under vitest by default', () => {
		expect(STUDIO_BUILD_TOOL_NAME).toBe('StudioBuild')
		expect(StudioBuildTool.name).toBe('StudioBuild')
		expect(isStudioActive()).toBe(false)
		expect(StudioBuildTool.isEnabled()).toBe(false)
		expect(StudioBuildTool.isReadOnly()).toBe(true)
		expect(StudioBuildTool.isConcurrencySafe()).toBe(true)
	})

	it('becomes enabled when the engine is forced active', () => {
		getStudioEngine().__setTestForceActive(true)
		expect(StudioBuildTool.isEnabled()).toBe(true)
	})

	it('call() produces a WCAG-verified web token digest + web delegation plan', async () => {
		const out = (await StudioBuildTool.call({
			brief: 'build a landing page for a fintech',
		} as never)) as {
			data: import('./StudioBuildTool.js').StudioBuildOutput
		}
		const d = out.data
		expect(d.intent.isBuildRequest).toBe(true)
		expect(d.tokensDigest.platform).toBe('web')
		expect(d.tokensDigest.contrastVerified).toBe(true)
		expect(d.tokensDigest.bg).toMatch(/^#?[0-9a-f]{6}$/i)
		expect(d.tokensDigest.fontFamily.length).toBeGreaterThan(0)
		expect(d.delegationInstructions).toContain('studio-web')
		expect(d.principlesRef).toContain('Studio PRD')
	})

	it('call() routes to the Windows engineer + Windows tokens when platform is windows', async () => {
		const out = (await StudioBuildTool.call({
			brief: 'inventory app',
			platform: 'windows',
		} as never)) as { data: import('./StudioBuildTool.js').StudioBuildOutput }
		expect(out.data.tokensDigest.platform).toBe('windows')
		expect(out.data.delegationInstructions).toContain('studio-windows')
		expect(out.data.delegationInstructions).not.toContain('studio-android')
	})

	it('call() honors an explicit Android platform', async () => {
		const out = (await StudioBuildTool.call({
			brief: 'tracker',
			platform: 'android',
		} as never)) as { data: import('./StudioBuildTool.js').StudioBuildOutput }
		expect(out.data.tokensDigest.platform).toBe('android')
		expect(out.data.delegationInstructions).toContain('studio-android')
	})

	it('call() honors an explicit base color', async () => {
		const out = (await StudioBuildTool.call({
			brief: 'a site',
			baseColor: '#b91c1c',
		} as never)) as { data: import('./StudioBuildTool.js').StudioBuildOutput }
		expect(out.data.tokensDigest.baseColor).toBe('#b91c1c')
	})

	it('mapToolResultToToolResultBlockParam renders a readable text block', async () => {
		const out = (await StudioBuildTool.call({ brief: 'a website' } as never)) as {
			data: import('./StudioBuildTool.js').StudioBuildOutput
		}
		const block = StudioBuildTool.mapToolResultToToolResultBlockParam(out.data, 'use_1')
		expect(block.tool_use_id).toBe('use_1')
		expect(block.type).toBe('tool_result')
		const content = block.content as string
		expect(content).toContain('Studio Department')
		expect(content).toContain('Studio PRD')
		expect(content.toLowerCase()).toContain('contrastaa=true')
	})
})
