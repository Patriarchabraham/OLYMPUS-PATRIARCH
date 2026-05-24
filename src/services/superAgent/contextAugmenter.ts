import { getSessionContextManager } from '../../cortex/sessionContext.js'
import { getSuperAgentOrchestrator } from './orchestrator.js'
import type { SuperAgentConfig } from './types.js'

/**
 * Augment the system prompt with context from super-agent modules.
 * This is the main integration point for the RAG engine, reasoning
 * chains, and evolution recommendations.
 *
 * Called from getUserContext() to inject additional context into the
 * system prompt before each query.
 */
export async function augmentSystemPrompt(
	query: string,
	config?: Partial<SuperAgentConfig>,
): Promise<{ [k: string]: string }> {
	const orchestrator = getSuperAgentOrchestrator(config)
	if (!orchestrator.getState().initialized) {
		await orchestrator.initialize()
	}

	const parts: { [k: string]: string } = {}

	// ─── RAG Context ──────────────────────────────────────────────
	if (orchestrator.isModuleEnabled('knowledge') && query) {
		try {
			const ragContext = await orchestrator.getRAGContext(query)
			if (ragContext) {
				parts.superAgentRAG = ragContext
			}
		} catch {
			// Non-critical — RAG failure shouldn't block the query
		}
	}

	// ─── Evolution Recommendations ────────────────────────────────
	if (orchestrator.isModuleEnabled('evolution') && query) {
		try {
			const recommendations = orchestrator.getRecommendations(query)
			if (recommendations) {
				const hints: string[] = []
				if (recommendations.strategy) {
					hints.push(`Recommended strategy: ${recommendations.strategy}`)
				}
				if (recommendations.pattern) {
					hints.push(
						`Pattern matched (${(recommendations.pattern.successRate * 100).toFixed(0)}% success): ${recommendations.pattern.triggerConditions.join(', ')}`,
					)
				}
				if (recommendations.tools.length > 0) {
					const topTools = recommendations.tools
						.slice(0, 3)
						.map((t) => `${t.toolName} (${(t.confidence * 100).toFixed(0)}%)`)
						.join(', ')
					hints.push(`Recommended tools: ${topTools}`)
				}
				if (hints.length > 0) {
					parts.superAgentEvolution = `[Evolution System Hints]\n${hints.join('\n')}`
				}
			}
		} catch {
			// Non-critical
		}
	}

	// ─── Reasoning Context ────────────────────────────────────────
	const activeChain = orchestrator.getActiveReasoningChain()
	if (activeChain) {
		const reasoningParts: string[] = [
			`[Reasoning Chain: ${activeChain.strategy}]`,
			`Query: ${activeChain.query}`,
			`Confidence: ${(activeChain.confidence * 100).toFixed(0)}%`,
		]
		if (activeChain.conclusion) {
			reasoningParts.push(`Conclusion: ${activeChain.conclusion}`)
		}
		parts.superAgentReasoning = reasoningParts.join('\n')
	}

	// ─── Planning Suggestions ─────────────────────────────────────
	if (orchestrator.isModuleEnabled('planning')) {
		try {
			const suggestions = orchestrator.getPlanSuggestions()
			if (suggestions.length > 0) {
				parts.superAgentPlanning = `[Plan Suggestions]\n${suggestions.slice(0, 5).join('\n')}`
			}
		} catch {
			// Non-critical
		}
	}

	// ─── Cortex Deep Analysis ─────────────────────────────────────
	if (orchestrator.isModuleEnabled('cortex') && query) {
		try {
			const analysis = await orchestrator.runCortexAnalysis(query)
			if (analysis?.augmentedContext) {
				parts.superAgentCortex = analysis.augmentedContext
			}
		} catch {
			// Non-critical — cortex failure shouldn't block the query
		}
	}

	// ─── Device Context ───────────────────────────────────────────
	if (orchestrator.isModuleEnabled('deviceBridge')) {
		try {
			const snapshot = await orchestrator.getLocalDeviceSnapshot()
			if (snapshot) {
				const deviceLines: string[] = [
					`[Local Device Context]`,
					`Host: ${snapshot.hostname} | ${snapshot.platform} ${snapshot.osVersion} | ${snapshot.arch}`,
					`CPU: ${snapshot.cpu.model} (${snapshot.cpu.cores}C/${snapshot.cpu.logicalProcessors}T @ ${snapshot.cpu.clockSpeedMhz}MHz)`,
					`RAM: ${(snapshot.memory.totalBytes / 1024 / 1024 / 1024).toFixed(1)} GB (${snapshot.memory.usagePercent.toFixed(0)}% used)`,
				]
				if (snapshot.gpu.length > 0) {
					deviceLines.push(
						`GPU: ${snapshot.gpu.map((g) => `${g.name} (${(g.vramBytes / 1024 / 1024).toFixed(0)} MB)`).join(', ')}`,
					)
				}
				if (snapshot.connectedPeripherals.length > 0) {
					const peripheralNames = snapshot.connectedPeripherals.slice(0, 10).map((p) => p.name)
					deviceLines.push(
						`Peripherals (${snapshot.connectedPeripherals.length}): ${peripheralNames.join(', ')}`,
					)
				}
				const devices = orchestrator.getDiscoveredDevices()
				if (devices.length > 0) {
					deviceLines.push(`Network Devices: ${devices.length} discovered`)
				}
				parts.deviceContext = deviceLines.join('\n')
			}
		} catch {
			// Non-critical
		}
	}

	// ─── Performance Context ──────────────────────────────────────
	if (orchestrator.isModuleEnabled('nativeCore')) {
		try {
			const report = await orchestrator.refreshPerformanceReport()
			if (report) {
				parts.nativePerformance = `[Native Performance]\nCache hit rate: ${(report.cacheHitRate * 100).toFixed(0)}% | Bottlenecks: ${report.bottlenecks.length}`
			}
		} catch {
			// Non-critical
		}
	}

	// ─── Governance Context ───────────────────────────────────────
	if (orchestrator.isModuleEnabled('governance')) {
		try {
			const report = orchestrator.getGovernanceReport()
			if (report) {
				const govLines: string[] = [
					`[Code Governance]`,
					`Overall score: ${(report.overallScore * 100).toFixed(0)}% | Files: ${report.filesAnalyzed} | Findings: ${report.allFindings.length}`,
				]
				if (report.violations.length > 0) {
					govLines.push(`Architecture violations: ${report.violations.length}`)
				}
				if (report.regressions.length > 0) {
					govLines.push(`Regressions: ${report.regressions.join(', ')}`)
				}
				if (report.autoFixes.length > 0) {
					govLines.push(`Auto-fixes available: ${report.autoFixes.length}`)
				}
				parts.governanceContext = govLines.join('\n')
			}
		} catch {
			// Non-critical
		}
	}

	// ─── Session Context (Temporal Reasoning) ─────────────────────
	try {
		const sessionMgr = getSessionContextManager()
		const sessionStr = sessionMgr.buildContextString()
		if (sessionStr) {
			parts.sessionContext = sessionStr
		}
	} catch {
		// Non-critical
	}

	return parts
}
