import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/messages.mjs'
import type { Command } from '../../commands.js'
import { getOlympusEngine } from '../../olympus/index.js'

const command: Command = {
	type: 'prompt',
	name: 'olympus',
	description:
		'Olympus Industries — spawn companies from 17 industry templates, manage agentic employees, run tasks, consensus, and verification',
	isEnabled: () => true,
	progressMessage: 'managing olympus industries',
	contentLength: 0,
	source: 'builtin',
	async getPromptForCommand(args?: string): Promise<ContentBlockParam[]> {
		const action = args?.trim() || 'help'

		const helpText = `[Olympus Industries]
Company orchestration engine with 17 industry templates and agentic employees.

Available actions:
- /olympus help — Show this help
- /olympus spawn <segment> <company-name> — Spawn a company from an industry template
- /olympus list — List active companies
- /olympus status <company-id> — Show company state (agents, departments, tasks)
- /olympus agents <company-id> — List agents in a company
- /olympus task <company-id> <title> — Submit a task to a company
- /olympus templates — List all 17 industry templates
- /olympus verify <company-id> <content> — Run verification on content
- /olympus performance <company-id> <agent-id> — Show agent performance score

Industry templates: legal, healthcare, finance, tech, retail, realestate, education, marketing, consulting, manufacturing, logistics, tourism, food, energy, entertainment, government, ngo

Each company gets departments with agentic employees (managers, workers, verifiers) that communicate via message bus, run consensus voting, and verify output quality.`

		if (action === 'help' || action === '') {
			return [{ type: 'text', text: helpText }]
		}

		const engine = getOlympusEngine()

		if (!engine) {
			return [{ type: 'text', text: '[Olympus Industries] Engine not initialized.' }]
		}

		const parts = action.split(' ')
		const subcommand = parts[0]
		const _rest = parts.slice(1).join(' ')

		if (subcommand === 'templates') {
			const templates = engine.getTemplates()
			const templateList = templates.map((t) => `- ${t}`).join('\n')
			return [
				{
					type: 'text',
					text: `[Olympus Industries] Available templates (${templates.length}):\n${templateList}`,
				},
			]
		}

		if (subcommand === 'spawn') {
			const segment = parts[1]
			const companyName = parts.slice(2).join(' ') || `${segment || 'Unknown'} Corp`

			if (!segment) {
				return [
					{
						type: 'text',
						text: '[Olympus Industries] Usage: /olympus spawn <segment> <company-name>',
					},
				]
			}

			try {
				const output = engine.spawnCompanyFromTemplate({
					name: companyName,
					description: `Auto-spawned ${segment} company`,
					segmentSlug: segment,
					plan: 'starter',
					primaryColor: '#F59E0B',
				})

				const totalAgents = output.departments.reduce((sum, d) => sum + d.agents.length, 0)
				const deptList = output.departments
					.map((d) => `  - ${d.name} (${d.agents.length} agents)`)
					.join('\n')

				return [
					{
						type: 'text',
						text: `[Olympus Industries] Company spawned!

Name: ${companyName}
Segment: ${segment}
Departments: ${output.departments.length}
Agents: ${totalAgents} (+ ${output.verifierAgents.length} verifiers)

${deptList}

Use /olympus list to see all active companies.`,
					},
				]
			} catch (e) {
				const msg = e instanceof Error ? e.message : String(e)
				return [{ type: 'text', text: `[Olympus Industries] Error: ${msg}` }]
			}
		}

		if (subcommand === 'list') {
			const companies = engine.listCompanies()
			if (companies.length === 0) {
				return [
					{
						type: 'text',
						text: '[Olympus Industries] No active companies. Use /olympus spawn to create one.',
					},
				]
			}

			const companyList = companies
				.map(
					(c) =>
						`- ${c.companyId}: ${c.state.agents.length} agents, ${c.state.departments.length} departments`,
				)
				.join('\n')

			return [
				{
					type: 'text',
					text: `[Olympus Industries] Active companies (${companies.length}):\n${companyList}`,
				},
			]
		}

		if (subcommand === 'status' || subcommand === 'agents') {
			const companyId = parts[1]
			if (!companyId) {
				return [
					{ type: 'text', text: `[Olympus Industries] Usage: /olympus ${subcommand} <company-id>` },
				]
			}

			const company = engine.getCompany(companyId)
			if (!company) {
				return [{ type: 'text', text: `[Olympus Industries] Company not found: ${companyId}` }]
			}

			const state = company.getState()

			if (subcommand === 'agents') {
				const agentList = state.agents
					.slice(0, 20)
					.map((a) => `  - ${a.name} (${a.role}, ${a.agentType}) [${a.departmentName}]`)
					.join('\n')
				const more = state.agents.length > 20 ? `\n  ... and ${state.agents.length - 20} more` : ''

				return [
					{
						type: 'text',
						text: `[Olympus Industries] Agents in ${companyId}:\n${agentList}${more}`,
					},
				]
			}

			return [
				{
					type: 'text',
					text: `[Olympus Industries] Company: ${companyId}
Departments: ${state.departments.join(', ')}
Agents: ${state.agents.length}
Tasks: ${state.tasks.length}
Pending Decisions: ${state.pendingDecisions.length}
Verification Results: ${state.verificationResults.length}`,
				},
			]
		}

		if (subcommand === 'task') {
			const companyId = parts[1]
			const title = parts.slice(2).join(' ')
			if (!companyId || !title) {
				return [
					{ type: 'text', text: '[Olympus Industries] Usage: /olympus task <company-id> <title>' },
				]
			}

			const success = engine.submitTask(companyId, {
				id: `task_${Date.now().toString(36)}`,
				title,
				description: title,
				assignedToId: 'auto',
				priority: 1,
				status: 'pending',
				dependencies: [],
				qualityScore: 0,
			})

			if (success) {
				return [
					{ type: 'text', text: `[Olympus Industries] Task submitted to ${companyId}: "${title}"` },
				]
			}
			return [{ type: 'text', text: `[Olympus Industries] Company not found: ${companyId}` }]
		}

		if (subcommand === 'verify') {
			const companyId = parts[1]
			const content = parts.slice(2).join(' ')
			if (!companyId || !content) {
				return [
					{
						type: 'text',
						text: '[Olympus Industries] Usage: /olympus verify <company-id> <content>',
					},
				]
			}

			const results = engine.verify(companyId, content, 'content', 'cli-verify')
			if (!results) {
				return [{ type: 'text', text: `[Olympus Industries] Company not found: ${companyId}` }]
			}

			const resultList = results
				.map((r) => `  ${r.checkType}: ${r.result} (${(r.score * 100).toFixed(0)}%)`)
				.join('\n')

			return [{ type: 'text', text: `[Olympus Industries] Verification results:\n${resultList}` }]
		}

		if (subcommand === 'performance') {
			const companyId = parts[1]
			const agentId = parts[2]
			if (!companyId || !agentId) {
				return [
					{
						type: 'text',
						text: '[Olympus Industries] Usage: /olympus performance <company-id> <agent-id>',
					},
				]
			}

			const score = engine.getPerformance(companyId, agentId)
			if (!score) {
				return [{ type: 'text', text: `[Olympus Industries] Not found: ${companyId} / ${agentId}` }]
			}

			return [
				{
					type: 'text',
					text: `[Olympus Industries] Performance for ${agentId}:
Overall: ${(score.overall * 100).toFixed(1)}%
Quality: ${(score.dimensions.quality * 100).toFixed(1)}% | Speed: ${(score.dimensions.speed * 100).toFixed(1)}%
Accuracy: ${(score.dimensions.accuracy * 100).toFixed(1)}% | Collaboration: ${(score.dimensions.collaboration * 100).toFixed(1)}%
Initiative: ${(score.dimensions.initiative * 100).toFixed(1)}%`,
				},
			]
		}

		return [
			{
				type: 'text',
				text: `[Olympus Industries] Unknown action: "${subcommand}". Type /olympus help for available actions.`,
			},
		]
	},
}

export default command
