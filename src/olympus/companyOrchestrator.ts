/**
 * Company Orchestrator — coordinates departments, agents, tasks, and verification
 * for a single company. Each company gets its own orchestrator instance.
 */

import { spawnDepartmentAgents, spawnVerificationAgents, type SpawnedAgent } from './agentFactory.js'
import { AgentMessageBus } from './communication.js'
import { calculateConsensus } from './consensus.js'
import { PerformanceTracker } from './performanceTracker.js'
import { findReadyTasks, topologicalSort } from './taskScheduler.js'
import { verifyOutput } from './verificationLayer.js'
import type {
	AgentType,
	AgentVote,
	CompanyState,
	IndustryTemplate,
	PerformanceScore,
	ScheduledTask,
	VerificationResult,
} from './types.js'

/**
 * Orchestrates all operations for a single company.
 * Manages agent lifecycle, task scheduling, consensus, and verification.
 */
export class CompanyOrchestrator {
	private state: CompanyState
	private bus: AgentMessageBus
	private tracker: PerformanceTracker

	constructor(
		companyId: string,
		bus: AgentMessageBus,
		tracker: PerformanceTracker,
	) {
		this.bus = bus
		this.tracker = tracker
		this.state = {
			companyId,
			agents: [],
			departments: [],
			tasks: [],
			pendingDecisions: [],
			verificationResults: [],
		}
	}

	/**
	 * Initialize the company from an industry template.
	 * Spawns agents for all departments and subscribes them to the message bus.
	 */
	initialize(template: IndustryTemplate): CompanyState {
		this.state.departments = template.departments.map((d) => d.name)

		const allAgents: SpawnedAgent[] = []
		for (const dept of template.departments) {
			const agents = spawnDepartmentAgents(dept)
			allAgents.push(...agents)
		}

		const verifiers = spawnVerificationAgents()
		allAgents.push(...verifiers)

		this.state.agents = allAgents.map((a) => ({
			id: a.id,
			name: a.name,
			role: a.role,
			agentType: a.agentType,
			departmentName: a.departmentName,
			capabilities: a.capabilities,
			expertiseWeight: a.expertiseWeight,
		}))

		// Subscribe all agents to the message bus
		for (const agent of allAgents) {
			this.bus.subscribe(agent.id, (message) => {
				void message
			})
		}

		return { ...this.state }
	}

	/**
	 * Submit a task for execution.
	 */
	submitTask(task: ScheduledTask): void {
		this.state.tasks.push(task)
	}

	/**
	 * Get tasks ready for execution (all dependencies completed).
	 */
	getReadyTasks(): ScheduledTask[] {
		return findReadyTasks(this.state.tasks)
	}

	/**
	 * Get prioritized execution order for all tasks.
	 */
	getTaskQueue(): ScheduledTask[] {
		return topologicalSort(this.state.tasks)
	}

	/**
	 * Submit a vote for a pending decision.
	 * Returns the decision if consensus is reached, null otherwise.
	 */
	submitVote(topic: string, vote: AgentVote): { decision: string; agreement: number } | null {
		let pending = this.state.pendingDecisions.find((d) => d.topic === topic)
		if (!pending) {
			pending = { topic, votes: [] }
			this.state.pendingDecisions.push(pending)
		}

		pending.votes.push(vote)
		const result = calculateConsensus(pending.votes)

		if (result.agreement >= 0.6) {
			return { decision: result.finalDecision, agreement: result.agreement }
		}

		return null
	}

	/**
	 * Verify content through the 5-check verification pipeline.
	 */
	verify(
		content: string,
		targetType: VerificationResult['targetType'],
		targetId: string,
	): VerificationResult[] {
		const results = verifyOutput(targetType, targetId, content)
		this.state.verificationResults.push(...results)
		return results
	}

	/**
	 * Get performance score for a specific agent.
	 */
	getPerformance(agentId: string): PerformanceScore {
		return this.tracker.getScore(agentId)
	}

	/**
	 * Record a performance metric for an agent.
	 */
	recordPerformance(
		agentId: string,
		dimension: 'quality' | 'speed' | 'accuracy' | 'collaboration' | 'initiative',
		value: number,
	): void {
		this.tracker.record(agentId, dimension, value)
	}

	/**
	 * Get current company state (snapshot).
	 */
	getState(): CompanyState {
		return { ...this.state }
	}

	/**
	 * Get the communication bus.
	 */
	getBus(): AgentMessageBus {
		return this.bus
	}

	/**
	 * Get the performance tracker.
	 */
	getTracker(): PerformanceTracker {
		return this.tracker
	}

	/**
	 * Clean up resources.
	 */
	shutdown(): void {
		this.bus.clear()
		this.state = {
			companyId: this.state.companyId,
			agents: [],
			departments: [],
			tasks: [],
			pendingDecisions: [],
			verificationResults: [],
		}
	}
}
