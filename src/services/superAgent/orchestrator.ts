import { existsSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import {
	type AutonomousRunner,
	createAutonomousRunner,
	type StepExecutor,
} from '../../autonomous/index.js'
import { executePipeline, matchOperation } from '../../composition/index.js'
import type { ToolExecutor as CompositionToolExecutor } from '../../composition/toolChain.js'
import { runWithEscalation } from '../../cortex/depthEscalator.js'
import { type CortexEngine, getCortexEngine } from '../../cortex/index.js'
import { getSessionContextManager } from '../../cortex/sessionContext.js'
import type { CortexAnalysis } from '../../cortex/types.js'
import { getDeviceBridgeManager } from '../../deviceBridge/index.js'
import type { DeviceInfo, LocalDeviceSnapshot } from '../../deviceBridge/types.js'
import { type EvolutionEngine, getEvolutionEngine } from '../../evolution/index.js'
import type { InteractionRecord, Pattern, ToolRecommendation } from '../../evolution/types.js'
import { type GovernanceEngine, getGovernanceEngine } from '../../governance/index.js'
import type { GovernanceReport } from '../../governance/types.js'
import { getRAGEngine } from '../../knowledge/ragEngine.js'
import { getHotPathCache } from '../../nativeCore/hotPathCache.js'
import { getNativeCallBridge } from '../../nativeCore/nativeCallBridge.js'
import type { PerformanceReport } from '../../nativeCore/types.js'
import { setDataDir as setADRDataDir } from '../../planning/architectureDecisions.js'
import {
	generatePlanFromDescription,
	listPlans,
	suggestNextSteps,
} from '../../planning/projectPlanner.js'
import { getProofEngine, type ProofEngine } from '../../proofEngine/index.js'
import { runReasoning } from '../../reasoning/index.js'
import type { GenerateFn, ReasoningChain, ReasoningStrategy } from '../../reasoning/types.js'
import { createLlmAgentExecutor } from '../../swarm/llmExecutor.js'
import { getSwarmOrchestrator } from '../../swarm/orchestrator.js'
import type {
	AgentRole,
	SwarmAgentInfo,
	SwarmConfig,
	SwarmTask,
	SwarmTaskResult,
} from '../../swarm/types.js'
import { DEFAULT_SWARM_CONFIG } from '../../swarm/types.js'
import { logForDebugging } from '../../utils/debug.js'
import { research } from '../../webintel/deepResearch.js'
import type { FetchFn, ResearchResult, SearchFn } from '../../webintel/types.js'
import type { SuperAgentConfig, SuperAgentState } from './types.js'
import { DEFAULT_SUPER_AGENT_CONFIG } from './types.js'

/**
 * SuperAgentOrchestrator — the central hub that wires all 9 subsystem modules
 * into the Olympuz query flow. Each subsystem is lazily initialized and
 * integrated through well-defined callback surfaces.
 */
export class SuperAgentOrchestrator {
	private config: SuperAgentConfig
	private state: SuperAgentState
	private evolutionEngine: EvolutionEngine | null = null
	private autonomousRunner: AutonomousRunner | null = null
	private cortexEngine: CortexEngine | null = null
	private governanceEngine: GovernanceEngine | null = null
	private proofEngine: ProofEngine | null = null

	constructor(config?: Partial<SuperAgentConfig>) {
		this.config = { ...DEFAULT_SUPER_AGENT_CONFIG, ...config }
		this.state = {
			activeReasoningChain: null,
			reasoningHistory: [],
			evolutionReport: null,
			ragStats: null,
			lastRAGContext: null,
			activeGoals: [],
			goalProgress: new Map(),
			activeSwarms: [],
			recentPipelines: [],
			lastResearchResult: null,
			activePlans: [],
			activeRisks: [],
			activeCortexAnalysis: null,
			cortexState: null,
			discoveredDevices: [],
			localDeviceSnapshot: null,
			performanceReport: null,
			governanceReport: null,
			proofReport: null,
			lastProofConfidence: null,
			satPathsChecked: 0,
			satInfeasiblePaths: 0,
			aiSoundnessScore: null,
			aiFindingsCount: 0,
			fuzzCrashesFound: 0,
			sessionContext: null,
			enabledModules: [],
			initialized: false,
		}
	}

	// ─── Initialization ───────────────────────────────────────────────

	async initialize(): Promise<void> {
		if (this.state.initialized) return

		const dataDir = this.config.dataDir
		if (dataDir) {
			if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true })
		}

		// Initialize each enabled module
		const enabled: string[] = []

		if (this.config.evolutionEnabled) {
			try {
				this.evolutionEngine = await getEvolutionEngine(dataDir)
				enabled.push('evolution')
			} catch (e) {
				logForDebugging(`[SuperAgent] evolution init failed: ${e}`)
			}
		}

		if (this.config.ragEnabled) {
			try {
				// RAG engine initializes lazily — just verify it's accessible
				getRAGEngine()
				enabled.push('knowledge')
			} catch (e) {
				logForDebugging(`[SuperAgent] knowledge init failed: ${e}`)
			}
		}

		if (this.config.autonomousEnabled) {
			try {
				// Wire a REAL step executor so milestones do actual work instead of the
				// placeholder 'Executed' default (see taskRunner.executeMilestone).
				// When no model is configured (createGenerateFn() → null), the executor
				// returns an empty object — an honest no-op rather than fake success.
				const { createGenerateFn } = await import('../../reasoning/generateFnFactory.js')
				const generateFn = await createGenerateFn()
				const executeStep: StepExecutor = async (step, _context) => {
					if (!generateFn) return {}
					const text = await generateFn(
						`Execute this step and return ONLY a JSON object with keys "result" and "notes".\n\n${step}`,
					)
					try {
						return JSON.parse(text) as Record<string, unknown>
					} catch {
						return { result: text }
					}
				}
				this.autonomousRunner = createAutonomousRunner(undefined, { executeStep })
				enabled.push('autonomous')
			} catch (e) {
				logForDebugging(`[SuperAgent] autonomous init failed: ${e}`)
			}
		}

		if (this.config.planningEnabled && dataDir) {
			try {
				setADRDataDir(join(dataDir, 'adrs'))
				enabled.push('planning')
			} catch (e) {
				logForDebugging(`[SuperAgent] planning init failed: ${e}`)
			}
		}

		// ─── Cortex Intelligence Amplifier ──────────────────────────
		if (this.config.cortexEnabled) {
			try {
				this.cortexEngine = getCortexEngine(dataDir)
				enabled.push('cortex')
				// Gap 5: Wire cross-model verification provider
				try {
					const { setVerificationProvider } = await import('../../cortex/crossModelVerifier.js')
					const { createGenerateFn } = await import('../../reasoning/generateFnFactory.js')
					const generateFn = await createGenerateFn()
					setVerificationProvider(generateFn)
				} catch {
					// Non-critical — verification works in self-verification mode
				}
			} catch (e) {
				logForDebugging(`[SuperAgent] cortex init failed: ${e}`)
			}
		}

		// ─── Device Bridge ───────────────────────────────────────────
		if (this.config.deviceBridgeEnabled) {
			try {
				// Device bridge initializes lazily — just verify it's accessible
				getDeviceBridgeManager()
				enabled.push('deviceBridge')
			} catch (e) {
				logForDebugging(`[SuperAgent] deviceBridge init failed: ${e}`)
			}
		}

		// ─── Native Core Performance Engine ──────────────────────────
		if (this.config.nativeCoreEnabled) {
			try {
				const bridge = getNativeCallBridge()
				// Pre-warm the persistent PowerShell session and cache
				void bridge.prewarm().catch(() => {})
				enabled.push('nativeCore')
			} catch (e) {
				logForDebugging(`[SuperAgent] nativeCore init failed: ${e}`)
			}
		}

		// Lightweight modules — always available when enabled
		if (this.config.reasoningEnabled) enabled.push('reasoning')
		if (this.config.swarmEnabled) enabled.push('swarm')
		if (this.config.compositionEnabled) enabled.push('composition')
		if (this.config.webintelEnabled) enabled.push('webintel')

		// ─── 100x Governance Engine ────────────────────────────────
		if (this.config.governanceEnabled) {
			try {
				this.governanceEngine = await getGovernanceEngine(dataDir)
				enabled.push('governance')
			} catch (e) {
				logForDebugging(`[SuperAgent] governance init failed: ${e}`)
			}
		}

		// ─── Proof Engine ───────────────────────────────────────
		if (this.config.proofEnabled) {
			try {
				this.proofEngine = getProofEngine()
				enabled.push('proof')
			} catch (e) {
				logForDebugging(`[SuperAgent] proof init failed: ${e}`)
			}
		}

		// ─── SAT Solver & Design by Contract ──────────────────
		if (this.config.satEnabled) {
			enabled.push('sat')
		}

		// ─── Abstract Interpretation & Fuzzing Engine ─────────
		if (this.config.abstractInterpretationEnabled) {
			enabled.push('abstract-interpretation')
		}
		if (this.config.fuzzingEnabled) {
			enabled.push('fuzzing')
		}

		// Gap 6: Wire AI-driven goal decomposition
		if (this.config.autonomousEnabled) {
			try {
				const { setDecomposeFn } = await import('../../autonomous/goalManager.js')
				const { createGenerateFn } = await import('../../reasoning/generateFnFactory.js')
				const generateFn = await createGenerateFn()
				if (generateFn) {
					setDecomposeFn(async (description: string) => {
						const response = await generateFn(
							`Decompose this goal into 3-7 specific, actionable sub-tasks. Return ONLY a JSON array of strings, no other text:\n\n${description}`,
						)
						try {
							return JSON.parse(response)
						} catch {
							return response
								.split('\n')
								.filter((l: string) => l.trim().startsWith('-'))
								.map((l: string) => l.replace(/^-\s*/, ''))
						}
					})
				}
			} catch {
				// Non-critical — falls back to heuristic decomposition
			}
		}

		this.state.enabledModules = enabled
		this.state.initialized = true

		logForDebugging(`[SuperAgent] initialized with modules: ${enabled.join(', ')}`)
	}

	// ─── Reasoning Integration ────────────────────────────────────────

	/**
	 * Run a reasoning chain before/alongside the model call.
	 * Uses depth escalation (Gap 2), evolution feedback (Gap 3),
	 * and session context (Gap 9) for deeper multi-layered reasoning.
	 * Returns the reasoning chain for system prompt augmentation.
	 */
	async runReasoning(
		query: string,
		strategy?: ReasoningStrategy,
		context?: string,
		generateFn?: GenerateFn,
	): Promise<ReasoningChain | null> {
		if (!this.config.reasoningEnabled) return null

		try {
			// Gap 9: Inject session context as additional reasoning context
			const sessionMgr = getSessionContextManager()
			const sessionContext = sessionMgr.buildContextString()
			const enrichedContext = [context, sessionContext].filter(Boolean).join('\n\n') || undefined

			// Gap 2: Use depth escalation for deeper reasoning
			const resolvedStrategy = strategy ?? this.config.defaultStrategy ?? 'auto'

			let chain: ReasoningChain | null = null

			// Quantum strategy removed in v1.1 — falls through to standard reasoning

			if (!chain) {
				chain = await runWithEscalation(
					query,
					resolvedStrategy === 'auto' ? 'cot' : resolvedStrategy,
					async (q: string, s: ReasoningStrategy, genFn?: GenerateFn) =>
						runReasoning(q, s, enrichedContext, genFn ?? generateFn),
					{ minConfidence: 0.7, maxEscalations: 3 },
					generateFn,
				)
			}

			this.state.activeReasoningChain = chain
			this.state.reasoningHistory.push(chain)
			// Keep last 20 chains
			if (this.state.reasoningHistory.length > 20) {
				this.state.reasoningHistory.shift()
			}

			// Gap 9: Update session context with new chain
			sessionMgr.updateFromChain(chain)

			return chain
		} catch (e) {
			logForDebugging(`[SuperAgent] reasoning failed: ${e}`)
			return null
		}
	}

	getActiveReasoningChain(): ReasoningChain | null {
		return this.state.activeReasoningChain
	}

	// ─── Evolution Integration ────────────────────────────────────────

	/**
	 * Track a query interaction for pattern learning and tool optimization.
	 * Called after each query turn via post-sampling hook.
	 */
	trackInteraction(record: Omit<InteractionRecord, 'id'>): void {
		if (!this.config.evolutionEnabled || !this.evolutionEngine) return

		try {
			this.evolutionEngine.trackInteraction(record)
			// Periodically save (dirty check is internal)
			void this.evolutionEngine.save()
		} catch (e) {
			logForDebugging(`[SuperAgent] evolution track failed: ${e}`)
		}
	}

	/**
	 * Get recommendations for the current query based on learned patterns.
	 */
	getRecommendations(query: string): {
		strategy: string | null
		tools: ToolRecommendation[]
		pattern: Pattern | null
	} | null {
		if (!this.config.evolutionEnabled || !this.evolutionEngine) return null

		try {
			return this.evolutionEngine.getRecommendations(query)
		} catch (e) {
			logForDebugging(`[SuperAgent] evolution recommendations failed: ${e}`)
			return null
		}
	}

	/**
	 * Trigger evolution cycle — learn patterns, analyze tools, evolve prompts.
	 */
	async evolve(): Promise<{
		patternsLearned: number
		promptEvolutions: number
		toolInsights: string[]
	} | null> {
		if (!this.config.evolutionEnabled || !this.evolutionEngine) return null

		try {
			const result = await this.evolutionEngine.evolve()
			this.state.evolutionReport = this.evolutionEngine.getEvolutionReport()
			return result
		} catch (e) {
			logForDebugging(`[SuperAgent] evolution failed: ${e}`)
			return null
		}
	}

	getEvolutionReport() {
		return this.state.evolutionReport
	}

	// ─── Knowledge / RAG Integration ──────────────────────────────────

	/**
	 * Get RAG-augmented context for the given query.
	 * Returns a context string ready for injection into the system prompt.
	 */
	async getRAGContext(query: string, maxTokens?: number): Promise<string | null> {
		if (!this.config.ragEnabled) return null

		try {
			const ragEngine = getRAGEngine()
			const context = await ragEngine.getContext(
				query,
				maxTokens ?? this.config.maxRAGTokens ?? 2000,
			)
			// getContext returns a string directly
			const stats = ragEngine.getStats()
			this.state.ragStats = {
				documents: stats.documentCount,
				chunks: stats.chunkCount,
				indexedDirs: [],
			}
			return context
		} catch (e) {
			logForDebugging(`[SuperAgent] RAG context failed: ${e}`)
			return null
		}
	}

	/**
	 * Index a directory for RAG retrieval.
	 */
	async indexDirectory(dir: string): Promise<{ documents: number; chunks: number } | null> {
		if (!this.config.ragEnabled) return null

		try {
			const ragEngine = getRAGEngine()
			await ragEngine.index(dir)
			const stats = ragEngine.getStats()
			this.state.ragStats = {
				documents: stats.documentCount,
				chunks: stats.chunkCount,
				indexedDirs: [dir],
			}
			return { documents: stats.documentCount, chunks: stats.chunkCount }
		} catch (e) {
			logForDebugging(`[SuperAgent] RAG index failed: ${e}`)
			return null
		}
	}

	// ─── Autonomous Integration ───────────────────────────────────────

	/**
	 * Create and optionally execute an autonomous goal.
	 */
	createGoal(title: string, description: string, priority?: number) {
		if (!this.config.autonomousEnabled || !this.autonomousRunner) return null
		const goal = this.autonomousRunner.createGoal(title, description, priority)
		this.state.activeGoals = this.autonomousRunner.listGoals()
		return goal
	}

	async executeGoal(goalId: string): Promise<boolean> {
		if (!this.config.autonomousEnabled || !this.autonomousRunner) return false

		const goal = this.autonomousRunner.getGoal(goalId)
		if (!goal) return false

		try {
			await this.autonomousRunner.execute(goal)
			this.state.activeGoals = this.autonomousRunner.listGoals()
			return true
		} catch (e) {
			logForDebugging(`[SuperAgent] autonomous goal failed: ${e}`)
			return false
		}
	}

	getAutonomousRunner(): AutonomousRunner | null {
		return this.autonomousRunner
	}

	// ─── Swarm Integration ────────────────────────────────────────────

	/**
	 * Execute a swarm of tasks with parallel agent coordination.
	 * Automatically registers default AgentTool-backed agents so the swarm
	 * has executors available from the start.
	 */
	async executeSwarm(
		tasks: string[],
		executor?: (task: SwarmTask, agent: SwarmAgentInfo) => Promise<SwarmTaskResult>,
		config?: Partial<SwarmConfig>,
	) {
		if (!this.config.swarmEnabled) return null

		try {
			const orchestrator = getSwarmOrchestrator()
			// Default to the real LLM-backed executor so callers get working agents
			// without knowing about createLlmAgentExecutor (src/swarm/llmExecutor.ts).
			const resolvedExecutor = executor ?? createLlmAgentExecutor()
			const fullConfig: SwarmConfig = { ...DEFAULT_SWARM_CONFIG, ...config }
			const swarmId = orchestrator.createSwarm(config)

			// Register default agents backed by AgentTool built-in agent types
			const defaultRoles: { role: AgentRole; capabilities: string[] }[] = [
				{ role: 'researcher', capabilities: ['search', 'web', 'analysis'] },
				{ role: 'coder', capabilities: ['implementation', 'refactoring', 'debugging'] },
				{ role: 'tester', capabilities: ['testing', 'verification', 'quality'] },
				{ role: 'reviewer', capabilities: ['code-review', 'quality', 'feedback'] },
				{ role: 'architect', capabilities: ['design', 'planning', 'architecture'] },
			]

			const agentCount = Math.min(fullConfig.maxAgents, defaultRoles.length)
			for (let i = 0; i < agentCount; i++) {
				const def = defaultRoles[i]!
				const agentInfo: SwarmAgentInfo = {
					id: `agent-${def.role}-${i}`,
					role: def.role,
					capabilities: def.capabilities,
					status: 'idle',
				}
				orchestrator.registerAgent(swarmId, agentInfo)
			}

			for (const task of tasks) {
				orchestrator.submitTask(swarmId, task)
			}

			const swarmState = orchestrator.getSwarmStatus(swarmId)
			this.state.activeSwarms.push(swarmState)
			if (this.state.activeSwarms.length > 10) {
				this.state.activeSwarms.shift()
			}

			const results = await orchestrator.executeSwarm(swarmId, resolvedExecutor)
			return results
		} catch (e) {
			logForDebugging(`[SuperAgent] swarm execution failed: ${e}`)
			return null
		}
	}

	// ─── Composition Integration ──────────────────────────────────────

	/**
	 * Match a user query to a composite operation and execute the pipeline.
	 */
	async executeCompositeOperation(
		query: string,
		toolExecutor: CompositionToolExecutor,
	): Promise<{ matched: boolean; execution?: unknown } | null> {
		if (!this.config.compositionEnabled) return null

		try {
			const operation = matchOperation(query)
			if (!operation) return { matched: false }

			// Use the pipeline from the operation directly
			const execution = await executePipeline(operation.pipeline, toolExecutor)
			this.state.recentPipelines.push(execution)
			if (this.state.recentPipelines.length > 10) this.state.recentPipelines.shift()
			return { matched: true, execution }
		} catch (e) {
			logForDebugging(`[SuperAgent] composition failed: ${e}`)
			return null
		}
	}

	// ─── WebIntel Integration ─────────────────────────────────────────

	/**
	 * Run deep research on a topic using the web intelligence module.
	 */
	async deepResearch(
		query: string,
		depth: number = 2,
		searchFn?: SearchFn,
		fetchFn?: FetchFn,
	): Promise<ResearchResult | null> {
		if (!this.config.webintelEnabled) return null

		try {
			const result = await research(query, depth, { searchFn, fetchFn })
			this.state.lastResearchResult = result
			return result
		} catch (e) {
			logForDebugging(`[SuperAgent] webintel research failed: ${e}`)
			return null
		}
	}

	// ─── Planning Integration ─────────────────────────────────────────

	/**
	 * Generate a project plan from a text description.
	 */
	async createPlan(description: string) {
		if (!this.config.planningEnabled) return null

		try {
			const plan = await generatePlanFromDescription(description)
			this.state.activePlans = listPlans()
			return plan
		} catch (e) {
			logForDebugging(`[SuperAgent] planning failed: ${e}`)
			return null
		}
	}

	/**
	 * Get suggested next steps from active plans.
	 */
	getPlanSuggestions(planId?: string): string[] {
		if (!this.config.planningEnabled) return []

		try {
			const plans = planId ? [planId] : listPlans().map((p) => p.id)
			const suggestions: string[] = []
			for (const id of plans) {
				const objectives = suggestNextSteps(id)
				for (const obj of objectives) {
					suggestions.push(`${obj.title}: ${obj.description}`)
				}
			}
			return suggestions
		} catch {
			return []
		}
	}

	// ─── Cortex Integration ──────────────────────────────────────────

	/**
	 * Run a deep cortex analysis on the query to amplify intelligence.
	 * Returns a CortexAnalysis with augmented context for the system prompt.
	 */
	async runCortexAnalysis(query: string): Promise<CortexAnalysis | null> {
		if (!this.config.cortexEnabled || !this.cortexEngine) return null

		try {
			const analysis = await this.cortexEngine.analyze(query)
			this.state.activeCortexAnalysis = analysis
			// Update cortex state
			this.state.cortexState = this.cortexEngine.getState()
			return analysis
		} catch (e) {
			logForDebugging(`[SuperAgent] cortex analysis failed: ${e}`)
			return null
		}
	}

	getCortexEngine(): CortexEngine | null {
		return this.cortexEngine
	}

	// ─── Device Bridge Integration ──────────────────────────────────

	/**
	 * Scan for connected devices (network, USB, Bluetooth).
	 */
	async scanDevices(): Promise<DeviceInfo[]> {
		if (!this.config.deviceBridgeEnabled) return []

		try {
			const manager = getDeviceBridgeManager()
			const devices = await manager.scan()
			this.state.discoveredDevices = manager.listDevices()
			return devices
		} catch (e) {
			logForDebugging(`[SuperAgent] device scan failed: ${e}`)
			return []
		}
	}

	/**
	 * Get a snapshot of the local device (CPU, RAM, GPU, peripherals, etc).
	 */
	async getLocalDeviceSnapshot(): Promise<LocalDeviceSnapshot | null> {
		if (!this.config.deviceBridgeEnabled) return null

		try {
			const manager = getDeviceBridgeManager()
			const snapshot = await manager.getLocalSnapshot()
			this.state.localDeviceSnapshot = snapshot
			return snapshot
		} catch (e) {
			logForDebugging(`[SuperAgent] local device snapshot failed: ${e}`)
			return null
		}
	}

	getDiscoveredDevices(): DeviceInfo[] {
		return this.state.discoveredDevices
	}

	// ─── Native Core Integration ────────────────────────────────────

	/**
	 * Get performance metrics from the native core engine.
	 */
	getPerformanceReport(): PerformanceReport | null {
		return this.state.performanceReport
	}

	/**
	 * Refresh the performance report from the native core.
	 */
	async refreshPerformanceReport(): Promise<PerformanceReport | null> {
		if (!this.config.nativeCoreEnabled) return null

		try {
			const cache = getHotPathCache()
			const stats = cache.getStats()
			this.state.performanceReport = {
				timestamp: Date.now(),
				avgLatencyMs: 0,
				p50LatencyMs: 0,
				p95LatencyMs: 0,
				p99LatencyMs: 0,
				totalCalls: 0,
				cacheHitRate: stats.hitRate,
				bottlenecks: [],
				recommendations: [],
			}
			return this.state.performanceReport
		} catch (e) {
			logForDebugging(`[SuperAgent] performance report failed: ${e}`)
			return null
		}
	}

	// ─── State ────────────────────────────────────────────────────────

	/**
	 * Run a full governance scan on a project directory.
	 * Returns a GovernanceReport with scores, findings, and auto-fixes.
	 */
	async runGovernanceScan(rootDir: string): Promise<GovernanceReport | null> {
		if (!this.config.governanceEnabled || !this.governanceEngine) return null

		try {
			const report = await this.governanceEngine.analyzeProject(rootDir)
			this.state.governanceReport = report
			return report
		} catch (e) {
			logForDebugging(`[SuperAgent] governance scan failed: ${e}`)
			return null
		}
	}

	/**
	 * Get the last governance report.
	 */
	getGovernanceReport(): GovernanceReport | null {
		return this.state.governanceReport
	}

	/**
	 * Get the governance engine instance.
	 */
	getGovernanceEngine(): GovernanceEngine | null {
		return this.governanceEngine
	}

	/** Get the Proof Engine instance */
	getProofEngine(): ProofEngine | null {
		return this.proofEngine
	}

	/** Update the last proof confidence (called from hooks) */
	setLastProofConfidence(confidence: number): void {
		this.state.lastProofConfidence = confidence
	}

	/** Update SAT solver statistics (called from hooks) */
	incrementSATStats(pathsChecked: number, infeasible: number): void {
		this.state.satPathsChecked = (this.state.satPathsChecked ?? 0) + pathsChecked
		this.state.satInfeasiblePaths = (this.state.satInfeasiblePaths ?? 0) + infeasible
	}

	/** Update AI soundness score (called from hooks) */
	setAISoundnessScore(score: number, findings: number): void {
		this.state.aiSoundnessScore = score
		this.state.aiFindingsCount = findings
	}

	/** Increment fuzzing crash count (called from hooks) */
	incrementFuzzCrashes(count: number): void {
		this.state.fuzzCrashesFound += count
	}

	getState(): Readonly<SuperAgentState> {
		return this.state
	}

	getConfig(): Readonly<SuperAgentConfig> {
		return this.config
	}

	isModuleEnabled(module: string): boolean {
		return this.state.enabledModules.includes(module)
	}

	/**
	 * Persist evolution state and other durable data.
	 */
	async shutdown(): Promise<void> {
		if (this.evolutionEngine?.isDirty()) {
			await this.evolutionEngine.save()
		}
		// Persist cortex state on shutdown
		if (this.cortexEngine) {
			this.cortexEngine.save()
		}
		// Persist governance state on shutdown
		if (this.governanceEngine) {
			await this.governanceEngine.save()
		}
		// Clean up native bridge
		if (this.config.nativeCoreEnabled) {
			try {
				const { disposeNativeCallBridge } = await import('../../nativeCore/nativeCallBridge.js')
				disposeNativeCallBridge()
			} catch {
				// Non-critical
			}
		}
		this.state.initialized = false
	}
}

// ─── Singleton ────────────────────────────────────────────────────

let _instance: SuperAgentOrchestrator | null = null

export function getSuperAgentOrchestrator(
	config?: Partial<SuperAgentConfig>,
): SuperAgentOrchestrator {
	if (!_instance) {
		_instance = new SuperAgentOrchestrator(config)
	}
	return _instance
}

export function resetSuperAgentOrchestrator(): void {
	_instance = null
}
