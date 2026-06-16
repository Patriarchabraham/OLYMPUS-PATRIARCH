import { getRoleAddendum } from '../harness/index.js'
import type { AgentRole } from './types.js'

export interface RoleDefinition {
	role: AgentRole
	description: string
	capabilities: string[]
	preferredTools: string[]
	systemPromptAddendum: string
	/** Weight multiplier for consensus votes in this role's domain. */
	expertiseWeight: number
}

const ROLES: Record<AgentRole, RoleDefinition> = {
	researcher: {
		role: 'researcher',
		description:
			'Investigates codebases, documentation, and web resources to gather information and answer questions.',
		capabilities: [
			'web_search',
			'code_exploration',
			'documentation_reading',
			'information_synthesis',
			'pattern_discovery',
		],
		preferredTools: ['WebSearch', 'WebFetch', 'Grep', 'Glob', 'Read'],
		systemPromptAddendum: `You are a research specialist. Focus on thorough investigation:
- Search broadly first, then narrow down
- Cross-reference multiple sources
- Synthesize findings into clear, actionable reports
- Flag uncertainties and contradictions
- Always cite sources for your findings`,
		expertiseWeight: 1.5,
	},
	coder: {
		role: 'coder',
		description:
			'Implements features, fixes bugs, refactors code, and writes production-quality software.',
		capabilities: ['code_writing', 'file_editing', 'bug_fixing', 'refactoring', 'implementation'],
		preferredTools: ['FileEdit', 'FileWrite', 'FileRead', 'Bash', 'Grep'],
		systemPromptAddendum: `You are a coding specialist. Focus on writing clean, correct code:
- Write minimal, precise code — no over-engineering
- Always read existing code before modifying
- Maintain existing code style and conventions
- Test your changes mentally before submitting
- Handle edge cases at system boundaries only`,
		expertiseWeight: 1.0,
	},
	tester: {
		role: 'tester',
		description:
			'Creates and runs tests, verifies correctness, identifies edge cases, and ensures quality.',
		capabilities: [
			'test_writing',
			'test_execution',
			'verification',
			'edge_case_analysis',
			'regression_detection',
		],
		preferredTools: ['Bash', 'FileWrite', 'FileRead', 'Grep', 'Glob'],
		systemPromptAddendum: `You are a testing specialist. Focus on thorough verification:
- Write tests that cover happy paths AND edge cases
- Run existing tests to check for regressions
- Verify both behavior and contracts
- Report failures with clear reproduction steps
- Distinguish between test failures and infrastructure issues`,
		expertiseWeight: 1.2,
	},
	reviewer: {
		role: 'reviewer',
		description:
			'Reviews code for quality, security, performance, and correctness. Identifies risks and suggests improvements.',
		capabilities: [
			'code_review',
			'quality_assessment',
			'security_analysis',
			'performance_review',
			'best_practices',
		],
		preferredTools: ['Read', 'Grep', 'Glob'],
		systemPromptAddendum: `You are a code review specialist. Focus on quality assessment:
- Check for correctness, security, and performance
- Identify potential bugs and vulnerabilities
- Assess code readability and maintainability
- Flag OWASP Top 10 violations
- Provide actionable, specific feedback with line references`,
		expertiseWeight: 1.3,
	},
	architect: {
		role: 'architect',
		description:
			'Designs system architecture, analyzes dependencies, makes technology decisions, and plans implementations.',
		capabilities: [
			'system_design',
			'dependency_analysis',
			'technology_selection',
			'architecture_planning',
			'tradeoff_analysis',
		],
		preferredTools: ['Read', 'Grep', 'Glob', 'Bash'],
		systemPromptAddendum: `You are a software architecture specialist. Focus on system design:
- Analyze existing architecture before proposing changes
- Consider scalability, maintainability, and performance
- Document trade-offs for each design decision
- Identify coupling points and dependency risks
- Propose incremental changes over big rewrites`,
		expertiseWeight: 2.0,
	},
	dataAnalyst: {
		role: 'dataAnalyst',
		description:
			'Processes data, performs analysis, creates visualizations, and extracts insights from datasets.',
		capabilities: [
			'data_processing',
			'statistical_analysis',
			'visualization',
			'data_cleaning',
			'insight_extraction',
		],
		preferredTools: ['Bash', 'FileRead', 'FileWrite', 'NotebookEdit'],
		systemPromptAddendum: `You are a data analysis specialist. Focus on extracting insights:
- Clean and validate data before analysis
- Use appropriate statistical methods
- Visualize results for clarity
- Document methodology and assumptions
- Flag data quality issues`,
		expertiseWeight: 1.2,
	},
	general: {
		role: 'general',
		description: 'General-purpose agent that handles any task type.',
		capabilities: ['general'],
		preferredTools: ['*'],
		systemPromptAddendum: `You are a general-purpose agent. Handle the task as directed.`,
		expertiseWeight: 1.0,
	},
}

export function getRoleDefinition(role: AgentRole): RoleDefinition {
	return ROLES[role]
}

/**
 * Role definition with the harness addendum appended to systemPromptAddendum.
 * Additive: if no harness corpus is available, returns the base definition
 * unchanged (graceful degradation). getRoleDefinition stays unmodified so
 * existing callers are unaffected.
 */
export function getEnrichedRoleDefinition(role: AgentRole): RoleDefinition {
	const base = ROLES[role]
	const addendum = getRoleAddendum(role)
	if (!addendum) return base
	return {
		...base,
		systemPromptAddendum: `${base.systemPromptAddendum}\n\n${addendum}`,
	}
}

export function getAllRoleDefinitions(): Record<AgentRole, RoleDefinition> {
	return { ...ROLES }
}

export function getBestRoleForTask(taskDescription: string): AgentRole {
	const lower = taskDescription.toLowerCase()

	if (lower.includes('test') || lower.includes('verify') || lower.includes('check')) {
		return 'tester'
	}
	if (lower.includes('review') || lower.includes('security') || lower.includes('quality')) {
		return 'reviewer'
	}
	if (
		lower.includes('research') ||
		lower.includes('investigate') ||
		lower.includes('find') ||
		lower.includes('search')
	) {
		return 'researcher'
	}
	if (
		lower.includes('design') ||
		lower.includes('architect') ||
		lower.includes('plan') ||
		lower.includes('structure')
	) {
		return 'architect'
	}
	if (lower.includes('data') || lower.includes('analyz') || lower.includes('visualiz')) {
		return 'dataAnalyst'
	}
	if (
		lower.includes('implement') ||
		lower.includes('fix') ||
		lower.includes('refactor') ||
		lower.includes('code') ||
		lower.includes('write')
	) {
		return 'coder'
	}

	return 'general'
}
