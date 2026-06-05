import type { AutonomousGoal, TaskProgress } from '../../autonomous/types.js'
import type { PipelineExecution } from '../../composition/types.js'
import type { SessionContext } from '../../cortex/sessionContext.js'
import type { CortexAnalysis, CortexConfig, CortexState } from '../../cortex/types.js'
import type { DeviceInfo, LocalDeviceSnapshot } from '../../deviceBridge/types.js'
import type { EvolutionReport } from '../../evolution/types.js'
import type { GovernanceConfig, GovernanceReport } from '../../governance/types.js'
import type { PerformanceReport } from '../../nativeCore/types.js'
import type { ProjectPlan, Risk } from '../../planning/types.js'
import type { ProofReport } from '../../proofEngine/types.js'
import type { ReasoningChain, ReasoningStrategy } from '../../reasoning/types.js'
import type { SwarmState } from '../../swarm/types.js'
import type { ResearchResult } from '../../webintel/types.js'

export type SuperAgentConfig = {
	/** Enable reasoning engine integration */
	reasoningEnabled: boolean
	/** Enable evolution/learning system */
	evolutionEnabled: boolean
	/** Enable RAG/knowledge engine */
	ragEnabled: boolean
	/** Enable autonomous goal execution */
	autonomousEnabled: boolean
	/** Enable swarm multi-agent coordination */
	swarmEnabled: boolean
	/** Enable tool composition pipelines */
	compositionEnabled: boolean
	/** Enable web intelligence deep research */
	webintelEnabled: boolean
	/** Enable multimodal capabilities */
	multimodalEnabled: boolean
	/** Enable planning and ADR system */
	planningEnabled: boolean
	/** Enable cortex deep intelligence amplifier */
	cortexEnabled: boolean
	/** Enable device bridge for universal device discovery and control */
	deviceBridgeEnabled: boolean
	/** Enable native core for DLL inspection and performance optimization */
	nativeCoreEnabled: boolean
	/** Enable 100x code governance engine */
	governanceEnabled: boolean
	/** Enable Olympus Industries company orchestration engine */
	olympusEnabled: boolean
	/** Enable proof engine for mathematical/logical verification */
	proofEnabled: boolean
	/** Enable SAT solver for path feasibility and constraint solving */
	satEnabled: boolean
	/** Enable Design by Contract verification */
	contractEnabled: boolean
	/** Enable Abstract Interpretation for NASA-grade static analysis */
	abstractInterpretationEnabled: boolean
	/** Enable Fuzzing Engine for crash detection */
	fuzzingEnabled: boolean
	/** Enable Symbolic Execution for path-sensitive analysis */
	symbolicExecutionEnabled: boolean
	/** Enable Program Slicing for dependency reduction */
	programSlicingEnabled: boolean
	/** Directory for persistent state (evolution, checkpoints, ADRs) */
	dataDir?: string
	/** Maximum RAG context tokens to inject into system prompt */
	maxRAGTokens?: number
	/** Default reasoning strategy */
	defaultStrategy?: ReasoningStrategy
	/** Cortex configuration override */
	cortexConfig?: Partial<CortexConfig>
	/** Governance configuration override */
	governanceConfig?: Partial<GovernanceConfig>
}

export const DEFAULT_SUPER_AGENT_CONFIG: SuperAgentConfig = {
	reasoningEnabled: true,
	evolutionEnabled: true,
	ragEnabled: true,
	autonomousEnabled: true,
	swarmEnabled: true,
	compositionEnabled: true,
	webintelEnabled: true,
	multimodalEnabled: true,
	planningEnabled: true,
	cortexEnabled: true,
	deviceBridgeEnabled: true,
	nativeCoreEnabled: true,
	governanceEnabled: true,
	olympusEnabled: true,
	proofEnabled: true,
	satEnabled: true,
	contractEnabled: true,
	abstractInterpretationEnabled: true,
	fuzzingEnabled: true,
	symbolicExecutionEnabled: true,
	programSlicingEnabled: true,
	maxRAGTokens: 2000,
	defaultStrategy: 'auto',
}

export type SuperAgentState = {
	// Reasoning
	activeReasoningChain: ReasoningChain | null
	reasoningHistory: ReasoningChain[]
	// Evolution
	evolutionReport: EvolutionReport | null
	// Knowledge
	ragStats: { documents: number; chunks: number; indexedDirs: string[] } | null
	lastRAGContext: string | null
	// Autonomous
	activeGoals: AutonomousGoal[]
	goalProgress: Map<string, TaskProgress>
	// Swarm
	activeSwarms: SwarmState[]
	// Composition
	recentPipelines: PipelineExecution[]
	// WebIntel
	lastResearchResult: ResearchResult | null
	// Planning
	activePlans: ProjectPlan[]
	activeRisks: Risk[]
	// Cortex
	activeCortexAnalysis: CortexAnalysis | null
	cortexState: CortexState | null
	// Device Bridge
	discoveredDevices: DeviceInfo[]
	localDeviceSnapshot: LocalDeviceSnapshot | null
	// Native Core
	performanceReport: PerformanceReport | null
	// Governance
	governanceReport: GovernanceReport | null
	// Olympus
	olympusCompanies: Array<{ companyId: string; agentCount: number; departmentCount: number }>
	olympusTemplates: string[]
	// Proof Engine
	proofReport: ProofReport | null
	lastProofConfidence: number | null
	// SAT Solver
	satPathsChecked: number
	satInfeasiblePaths: number
	// Design by Contract
	contractCompliance: number | null
	// Abstract Interpretation
	aiSoundnessScore: number | null
	aiFindingsCount: number
	// Fuzzing Engine
	fuzzCrashesFound: number
	// Symbolic Execution
	sePathsExplored: number
	seFindingsCount: number
	// Program Slicing
	sliceReductionAvg: number | null
	// Session Context (temporal reasoning)
	sessionContext: SessionContext | null
	// General
	enabledModules: string[]
	initialized: boolean
}
