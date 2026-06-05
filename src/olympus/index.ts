/**
 * Olympus Industries Engine — headless company orchestration engine.
 * Manages in-memory company instances, agent spawning, task scheduling,
 * consensus voting, performance tracking, and output verification.
 *
 * This is the main entry point for the Olympus module in Olympuz.
 * No external dependencies — pure TypeScript with Node.js built-ins.
 */

export type { AgentType, AgentVote, CompanyState, ConsensusResult, DecisionMethod,
	DepartmentTemplate, DepartmentType, IndustryTemplate, AgentMessage, MessageType,
	OlympusEngineConfig, OlympusEngineState, PerformanceDimensions, PerformanceScore,
	ScheduledTask, TaskStatus, VerificationResult, WorkflowTemplate, AgentTemplate,
	TaskDependency } from './types.js'
export type { SpawnedAgent } from './agentFactory.js'
export type { CompanyFactoryInput, CompanyFactoryOutput } from './companyFactory.js'

export { AgentMessageBus } from './communication.js'
export { calculateConsensus, createVoteCollector } from './consensus.js'
export { spawnDepartmentAgents, spawnCompanyWorkforce, spawnVerificationAgents } from './agentFactory.js'
export { spawnCompany } from './companyFactory.js'
export { CompanyOrchestrator } from './companyOrchestrator.js'
export { PerformanceTracker } from './performanceTracker.js'
export { topologicalSort, findReadyTasks, prioritizeTasks, executeBatch } from './taskScheduler.js'
export { verifyOutput, autoFixContent } from './verificationLayer.js'
export { COMPANY_TEMPLATES, getTemplateSlugs, getTemplate } from './templates/index.js'

import { AgentMessageBus } from './communication.js'
import { CompanyOrchestrator } from './companyOrchestrator.js'
import { PerformanceTracker } from './performanceTracker.js'
import { COMPANY_TEMPLATES, getTemplateSlugs } from './templates/index.js'
import type { CompanyState, OlympusEngineConfig, OlympusEngineState, VerificationResult, AgentVote, PerformanceDimensions } from './types.js'
import { CompanyFactoryInput, CompanyFactoryOutput, spawnCompany } from './companyFactory.js'

/** Default engine configuration */
const DEFAULT_CONFIG: OlympusEngineConfig = {
	defaultScale: 1,
	consensusThreshold: 0.6,
	maxParallelTasks: 3,
	maxMessageHistory: 1000,
}

/**
 * OlympusEngine — the main engine class that manages all active companies.
 * Provides a high-level API for company lifecycle, task management,
 * consensus, verification, and performance tracking.
 */
export class OlympusEngine {
	private config: OlympusEngineConfig
	private companies: Map<string, CompanyOrchestrator> = new Map()
	private buses: Map<string, AgentMessageBus> = new Map()
	private tracker: PerformanceTracker
	private state: OlympusEngineState
	private initialized = false

	constructor(config?: Partial<OlympusEngineConfig>) {
		this.config = { ...DEFAULT_CONFIG, ...config }
		this.tracker = new PerformanceTracker()
		this.state = {
			activeCompanies: new Map(),
			templateRegistry: getTemplateSlugs(),
			totalAgentsSpawned: 0,
			totalTasksExecuted: 0,
		}
	}

	/**
	 * Initialize the engine. Safe to call multiple times.
	 */
	initialize(): void {
		if (this.initialized) return
		this.initialized = true
	}

	/**
	 * Spawn a new company from an industry template.
	 * Returns the factory output with all departments and agents.
	 */
	spawnCompanyFromTemplate(input: CompanyFactoryInput): CompanyFactoryOutput {
		const output = spawnCompany(input)

		// Create orchestrator for the company
		const companyId = `company_${Date.now().toString(36)}`
		const bus = new AgentMessageBus(this.config.maxMessageHistory)
		this.buses.set(companyId, bus)

		const orchestrator = new CompanyOrchestrator(companyId, bus, this.tracker)

		// Find the template and initialize the orchestrator
		const template = COMPANY_TEMPLATES[input.segmentSlug]
		if (template) {
			const state = orchestrator.initialize(template)
			this.state.totalAgentsSpawned += state.agents.length
			this.state.activeCompanies.set(companyId, state)
		}

		this.companies.set(companyId, orchestrator)
		return output
	}

	/**
	 * Get an orchestrator for a specific company.
	 */
	getCompany(companyId: string): CompanyOrchestrator | undefined {
		return this.companies.get(companyId)
	}

	/**
	 * List all active companies with their state.
	 */
	listCompanies(): Array<{ companyId: string; state: CompanyState }> {
		return Array.from(this.companies.entries()).map(([id, orch]) => ({
			companyId: id,
			state: orch.getState(),
		}))
	}

	/**
	 * Submit a task to a specific company.
	 */
	submitTask(companyId: string, task: Parameters<CompanyOrchestrator['submitTask']>[0]): boolean {
		const company = this.companies.get(companyId)
		if (!company) return false
		company.submitTask(task)
		this.state.totalTasksExecuted++
		return true
	}

	/**
	 * Run consensus for a specific company.
	 */
	runConsensus(
		companyId: string,
		topic: string,
		vote: AgentVote,
	): { decision: string; agreement: number } | null {
		const company = this.companies.get(companyId)
		if (!company) return null
		return company.submitVote(topic, vote)
	}

	/**
	 * Verify content through the verification pipeline.
	 */
	verify(
		companyId: string,
		content: string,
		targetType: VerificationResult['targetType'],
		targetId: string,
	): VerificationResult[] | null {
		const company = this.companies.get(companyId)
		if (!company) return null
		return company.verify(content, targetType, targetId)
	}

	/**
	 * Get performance score for an agent within a company.
	 */
	getPerformance(companyId: string, agentId: string): { overall: number; dimensions: PerformanceDimensions } | null {
		const company = this.companies.get(companyId)
		if (!company) return null
		return company.getPerformance(agentId)
	}

	/**
	 * Get available industry template slugs.
	 */
	getTemplates(): string[] {
		return this.state.templateRegistry
	}

	/**
	 * Prune old performance records (call periodically).
	 */
	prunePerformance(): void {
		this.tracker.prune()
	}

	/**
	 * Get engine state.
	 */
	getState(): OlympusEngineState {
		return { ...this.state }
	}

	/**
	 * Check if engine is initialized.
	 */
	isInitialized(): boolean {
		return this.initialized
	}

	/**
	 * Shutdown the engine and clean up all resources.
	 */
	shutdown(): void {
		for (const company of this.companies.values()) {
			company.shutdown()
		}
		this.companies.clear()
		this.buses.clear()
		this.state.activeCompanies.clear()
		this.initialized = false
	}
}

// ─── Singleton Management ──────────────────────────────────────────

let _instance: OlympusEngine | null = null

/**
 * Get or create the OlympusEngine singleton.
 */
export function getOlympusEngine(config?: Partial<OlympusEngineConfig>): OlympusEngine {
	if (!_instance) {
		_instance = new OlympusEngine(config)
		_instance.initialize()
	}
	return _instance
}

/**
 * Reset the OlympusEngine singleton (for testing).
 */
export function resetOlympusEngine(): void {
	if (_instance) {
		_instance.shutdown()
		_instance = null
	}
}
