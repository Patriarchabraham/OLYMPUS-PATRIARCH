/**
 * Core types for the Olympus Industries agentic engine.
 * Migrated from /c/olympus-industries/src/engine/types.ts
 * Adapted for Olympuz strict TypeScript — no optional `nome`, explicit fields.
 */

/** Agent role classification within a company hierarchy */
export type AgentType = 'worker' | 'manager' | 'executive' | 'verifier'

/** Task lifecycle states */
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'blocked'

/** Department classification within a company */
export type DepartmentType = 'core' | 'support' | 'executive'

/** Template for spawning a single agent */
export interface AgentTemplate {
	name: string
	role: string
	agentType: AgentType
	capabilities: string[]
	expertiseWeight: number
}

/** Template for spawning a department with its agents */
export interface DepartmentTemplate {
	name: string
	type: DepartmentType
	agents: AgentTemplate[]
}

/** Workflow template for automated processes */
export interface WorkflowTemplate {
	name: string
	steps: string[]
	triggerCondition: string
}

/** Full industry template containing departments, workflows, and KPIs */
export interface IndustryTemplate {
	segmentId: string
	departments: DepartmentTemplate[]
	workflows: WorkflowTemplate[]
	kpis: string[]
}

/** A single agent's vote in a consensus round */
export interface AgentVote {
	agentId: string
	agentRole: string
	decision: string
	confidence: number
	reasoning: string
}

/** Task dependency declaration */
export interface TaskDependency {
	taskId: string
	dependsOn: string[]
}

/** Performance measurement across 5 dimensions */
export interface PerformanceDimensions {
	quality: number
	speed: number
	accuracy: number
	collaboration: number
	initiative: number
}

/** Message types for inter-agent communication */
export type MessageType = 'task' | 'query' | 'decision' | 'report' | 'alert' | 'consensus'

/** Decision method for consensus calculation */
export type DecisionMethod = 'consensus' | 'executive' | 'democratic'

/** Result of a consensus round */
export interface ConsensusResult {
	topic: string
	votes: AgentVote[]
	finalDecision: string
	agreement: number
	method: DecisionMethod
}

/** Message exchanged between agents */
export interface AgentMessage {
	id: string
	companyId: string
	fromAgentId: string
	toAgentId: string | null
	type: MessageType
	content: string
	timestamp: Date
}

/** A task with scheduling metadata */
export interface ScheduledTask {
	id: string
	title: string
	description: string
	assignedToId: string
	priority: number
	status: TaskStatus
	dependencies: string[]
	qualityScore: number
}

/** Agent performance score with dimensional breakdown */
export interface PerformanceScore {
	overall: number
	dimensions: PerformanceDimensions
}

/** Result of a single verification check */
export interface VerificationResult {
	targetType: 'code' | 'content' | 'decision' | 'agent'
	targetId: string
	checkType: 'syntax' | 'logic' | 'security' | 'quality' | 'mathematical'
	result: 'pass' | 'fail' | 'warning'
	score: number
	details: Record<string, unknown>
	autoFixed: boolean
}

/** Runtime state of a company being orchestrated */
export interface CompanyState {
	companyId: string
	agents: Array<{
		id: string
		name: string
		role: string
		agentType: AgentType
		departmentName: string
		capabilities: string[]
		expertiseWeight: number
	}>
	departments: string[]
	tasks: ScheduledTask[]
	pendingDecisions: Array<{ topic: string; votes: AgentVote[] }>
	verificationResults: VerificationResult[]
}

/** Configuration for the Olympus engine */
export interface OlympusEngineConfig {
	/** Scale multiplier for agent spawning (default: 1) */
	defaultScale: number
	/** Consensus agreement threshold (default: 0.6) */
	consensusThreshold: number
	/** Maximum parallel task execution (default: 3) */
	maxParallelTasks: number
	/** Maximum message history per company bus (default: 1000) */
	maxMessageHistory: number
}

/** Top-level state of the Olympus engine */
export interface OlympusEngineState {
	activeCompanies: Map<string, CompanyState>
	templateRegistry: string[]
	totalAgentsSpawned: number
	totalTasksExecuted: number
}
