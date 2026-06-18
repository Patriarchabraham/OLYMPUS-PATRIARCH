import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/messages.mjs'
import type { Command } from '../../commands.js'
import { auditUIUX, renderAuditReport } from '../../audit/index.js'
import { getSuperAgentOrchestrator } from '../../services/superAgent/index.js'

const helpText = `[UI/UX Multi-Agent Audit]

Usage:
- /audit-ui <project-path>   Audit a UI/UX project: parallel specialist agents
                               (visual, accessibility, code, layout, interaction)
                               + measured pixel-vision on screenshots + structural
                               design-token checks. Returns a scored report.
- /audit-ui help              Show this help.

5 specialist agents run in parallel via the swarm. Each audits one dimension.
Structural checks (WCAG contrast, spacing grid, hardcoded colors, screenshot
pixel analysis) run measured — even without an API key.`

const command = {
	type: 'prompt',
	name: 'audit-ui',
	description: 'Multi-agent UI/UX audit: visual + accessibility + code + layout + interaction',
	isEnabled: () => true,
	progressMessage: 'auditing UI/UX',
	contentLength: 0,
	source: 'builtin',
	async getPromptForCommand(args?: string): Promise<ContentBlockParam[]> {
		const target = args?.trim() || ''
		if (!target || target === 'help') return [{ type: 'text', text: helpText }]
		try {
			await getSuperAgentOrchestrator().initialize()
			const result = await auditUIUX(target)
			return [{ type: 'text', text: renderAuditReport(result) }]
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e)
			return [{ type: 'text', text: `[UI/UX Audit] failed: ${msg}` }]
		}
	},
} satisfies Command

export default command
