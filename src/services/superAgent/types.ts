import type { AutonomousGoal, TaskProgress } from '../../autonomous/types.js'
import type { PipelineExecution } from '../../composition/types.js'
import type { SessionContext } from '../../cortex/sessionContext.js'
import type { CortexAnalysis, CortexConfig, CortexState } from '../../cortex/types.js'
import type { DeviceInfo, LocalDeviceSnapshot } from '../../deviceBridge/types.js'
import type { EvolutionReport } from '../../evolution/types.js'
import type { GovernanceConfig, GovernanceReport } from '../../governance/types.js'
import type { PerformanceReport } from '../../nativeCore/types.js'
import type { ProjectPlan, Risk } from '../../planning/types.js'
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
	// Session Context (temporal reasoning)
	sessionContext: SessionContext | null
	// General
	enabledModules: string[]
	initialized: boolean
}
