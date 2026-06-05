/**
 * Agent Factory — spawns agentic employees from industry templates.
 * Role-based agent spawning with capabilities, expertise weights, and Portuguese names.
 */

import type { AgentType, DepartmentTemplate } from './types.js'

/** First name pool for generating realistic agent names (Portuguese) */
const FIRST_NAMES = [
	'Ana', 'Carlos', 'Maria', 'João', 'Fernanda', 'Ricardo', 'Camila', 'André',
	'Juliana', 'Marcos', 'Patricia', 'Lucas', 'Beatriz', 'Thiago', 'Isabela',
	'Rafael', 'Larissa', 'Gustavo', 'Amanda', 'Diego', 'Luiza', 'Pedro',
	'Natalia', 'Felipe', 'Daniela', 'Bruno', 'Carolina', 'Mateus', 'Gabriela', 'Leo',
]

const LAST_NAMES = [
	'Silva', 'Santos', 'Oliveira', 'Souza', 'Lima', 'Costa', 'Ferreira', 'Rodrigues',
	'Almeida', 'Nascimento', 'Pereira', 'Araujo', 'Barbosa', 'Moraes', 'Ribeiro',
]

/** Generate a random realistic Portuguese name */
function generateName(): string {
	const first = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)]
	const last = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)]
	return `${first} ${last}`
}

/** Generate unique agent ID */
function generateId(): string {
	return `agent_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

/** Base capabilities granted by agent type */
const TYPE_CAPABILITIES: Record<AgentType, string[]> = {
	worker: ['task_execution', 'reporting', 'communication'],
	manager: ['task_assignment', 'team_coordination', 'performance_review', 'decision_making'],
	executive: [
		'strategic_planning',
		'resource_allocation',
		'cross_department_coordination',
		'goal_setting',
	],
	verifier: ['quality_assurance', 'error_detection', 'compliance_check', 'auto_fix'],
}

/** Agent data produced by the factory */
export interface SpawnedAgent {
	id: string
	name: string
	role: string
	agentType: AgentType
	capabilities: string[]
	expertiseWeight: number
	departmentName: string
}

/**
 * Spawn agents for a department based on templates.
 * @param department - Department template with agent definitions
 * @param count - Number of agents to spawn (default: from template)
 */
export function spawnDepartmentAgents(department: DepartmentTemplate, count?: number): SpawnedAgent[] {
	const agents: SpawnedAgent[] = []
	const targetCount = count ?? department.agents.length

	for (let i = 0; i < targetCount; i++) {
		const template = department.agents[i % department.agents.length]
		const baseCapabilities = TYPE_CAPABILITIES[template.agentType]

		agents.push({
			id: generateId(),
			name: generateName(),
			role: template.role,
			agentType: template.agentType,
			capabilities: [...new Set([...baseCapabilities, ...template.capabilities])],
			expertiseWeight: template.expertiseWeight,
			departmentName: department.name,
		})
	}

	return agents
}

/**
 * Spawn a complete company workforce from department templates.
 * Returns agents organized by department name.
 */
export function spawnCompanyWorkforce(
	departments: DepartmentTemplate[],
): Map<string, SpawnedAgent[]> {
	const result = new Map<string, SpawnedAgent[]>()

	for (const dept of departments) {
		result.set(dept.name, spawnDepartmentAgents(dept))
	}

	return result
}

/**
 * Spawn hidden verification agents for a company.
 * These run in the background monitoring all outputs.
 */
export function spawnVerificationAgents(): SpawnedAgent[] {
	const verifierRoles = [
		{
			role: 'Code Quality Verifier',
			capabilities: ['syntax_check', 'logic_validation', 'security_scan'],
		},
		{
			role: 'Content Quality Verifier',
			capabilities: ['accuracy_check', 'consistency_validation', 'formatting'],
		},
		{
			role: 'Mathematical Verifier',
			capabilities: ['constraint_solving', 'proof_verification', 'checksum_validation'],
		},
	]

	return verifierRoles.map((v) => ({
		id: generateId(),
		name: `Verifier ${v.role.split(' ')[0]}`,
		role: v.role,
		agentType: 'verifier' as const,
		capabilities: [...TYPE_CAPABILITIES.verifier, ...v.capabilities],
		expertiseWeight: 1.8,
		departmentName: '__verification__',
	}))
}
