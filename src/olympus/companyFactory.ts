/**
 * Company Factory — spawns entire companies from industry templates.
 * Creates departments, agents, verifiers, KPIs, and workflows.
 * Uses direct template imports instead of dynamic require().
 */

import { spawnDepartmentAgents, spawnVerificationAgents } from './agentFactory.js'
import { COMPANY_TEMPLATES } from './templates/index.js'
import type { IndustryTemplate } from './types.js'

/** Input parameters for company creation */
export interface CompanyFactoryInput {
	name: string
	description: string
	segmentSlug: string
	plan: 'starter' | 'pro' | 'enterprise'
	primaryColor: string
}

/** Output of company factory — full company structure ready for persistence */
export interface CompanyFactoryOutput {
	departments: Array<{
		name: string
		type: string
		agents: Array<{
			id: string
			name: string
			role: string
			agentType: string
			capabilities: string[]
			expertiseWeight: number
		}>
	}>
	verifierAgents: Array<{
		id: string
		name: string
		role: string
		capabilities: string[]
		expertiseWeight: number
	}>
	kpis: string[]
	workflows: IndustryTemplate['workflows']
}

/** Scale multiplier based on plan tier */
function getAgentScale(plan: string): number {
	switch (plan) {
		case 'enterprise':
			return 3
		case 'pro':
			return 2
		default:
			return 1
	}
}

/**
 * Spawn a complete company from input parameters.
 * Looks up the industry template and creates departments with scaled agents.
 * @throws Error if the segment slug is unknown
 */
export function spawnCompany(input: CompanyFactoryInput): CompanyFactoryOutput {
	const template = COMPANY_TEMPLATES[input.segmentSlug]

	if (!template) {
		throw new Error(`Unknown industry segment: ${input.segmentSlug}`)
	}

	const scale = getAgentScale(input.plan)

	const departments = template.departments.map((dept) => {
		const agents = spawnDepartmentAgents(dept, dept.agents.length * scale)

		return {
			name: dept.name,
			type: dept.type,
			agents: agents.map((a) => ({
				id: a.id,
				name: a.name,
				role: a.role,
				agentType: a.agentType,
				capabilities: a.capabilities,
				expertiseWeight: a.expertiseWeight,
			})),
		}
	})

	const verifierAgents = spawnVerificationAgents().map((v) => ({
		id: v.id,
		name: v.name,
		role: v.role,
		capabilities: v.capabilities,
		expertiseWeight: v.expertiseWeight,
	}))

	return {
		departments,
		verifierAgents,
		kpis: template.kpis,
		workflows: template.workflows,
	}
}
