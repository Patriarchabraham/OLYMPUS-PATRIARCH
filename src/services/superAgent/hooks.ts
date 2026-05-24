import { getSessionContextManager } from '../../cortex/sessionContext.js'
import type { InteractionRecord } from '../../evolution/types.js'
import { logForDebugging } from '../../utils/debug.js'
import { registerPostSamplingHook } from '../../utils/hooks/postSamplingHooks.js'
import type { SuperAgentOrchestrator } from './orchestrator.js'
import { getSuperAgentOrchestrator } from './orchestrator.js'
import type { SuperAgentConfig } from './types.js'

/**
 * Register super-agent hooks into the Mythos lifecycle.
 * This wires:
 * - Evolution tracking (post-sampling)
 * - Periodic evolution cycles
 * - Autonomous goal progress updates
 *
 * Call once at startup (in main.tsx or the REPL init path).
 */
export function registerSuperAgentHooks(config?: Partial<SuperAgentConfig>): void {
	const orchestrator = getSuperAgentOrchestrator(config)

	// ─── Post-sampling hook: track interactions for evolution ──────
	registerPostSamplingHook(async (context) => {
		if (!orchestrator.isModuleEnabled('evolution')) return

		try {
			// Extract the last user message as the query
			const lastUserMsg = [...context.messages]
				.reverse()
				.find((m) => m.type === 'user' && typeof m.message.content === 'string')

			if (!lastUserMsg || lastUserMsg.type !== 'user') return

			const query =
				typeof lastUserMsg.message.content === 'string' ? lastUserMsg.message.content : ''

			if (!query) return

			// Extract the last assistant response for outcome analysis
			const lastAssistantMsg = [...context.messages].reverse().find((m) => m.type === 'assistant')

			// Extract tools used from the assistant message
			const toolsUsed: string[] = []
			let hasToolError = false
			if (lastAssistantMsg?.type === 'assistant') {
				const content = lastAssistantMsg.message.content
				if (Array.isArray(content)) {
					for (const block of content) {
						if (typeof block === 'object' && 'name' in block) {
							toolsUsed.push((block as { name: string }).name)
						}
					}
				}
			}

			// Check for tool errors in user messages after the query (tool_result blocks)
			const toolResultMsg = [...context.messages]
				.reverse()
				.find((m) => m.type === 'user' && m !== lastUserMsg && !m.isMeta)

			if (toolResultMsg?.type === 'user') {
				const content = toolResultMsg.message.content
				if (Array.isArray(content)) {
					for (const block of content) {
						if (
							typeof block === 'object' &&
							'type' in block &&
							block.type === 'tool_result' &&
							'is_error' in block &&
							block.is_error
						) {
							hasToolError = true
							break
						}
					}
				}
			}

			// Determine success from stop_reason and tool errors
			const stopReason = lastAssistantMsg?.message?.stop_reason
			// end_turn and tool_use are successful stop reasons; max_tokens is ambiguous
			const hasGoodStop =
				stopReason === 'end_turn' || stopReason === 'tool_use' || stopReason === 'stop_sequence'
			const success = !hasToolError && (hasGoodStop || stopReason == null)

			// Compute duration from message timestamps
			let durationMs = 0
			const userTimestamp = lastUserMsg?.timestamp
			const assistantTimestamp = lastAssistantMsg?.timestamp
			if (assistantTimestamp && userTimestamp) {
				durationMs = new Date(assistantTimestamp).getTime() - new Date(userTimestamp).getTime()
			}

			// Track the interaction
			orchestrator.trackInteraction({
				query,
				strategy: orchestrator.getActiveReasoningChain()?.strategy ?? 'default',
				toolsUsed,
				success,
				durationMs,
				timestamp: Date.now(),
				// Feed cortex insights into evolution fitness
				cortexMeta: extractCortexMeta(orchestrator),
			})

			// Trigger periodic evolution (every ~30 interactions based on evolution engine config)
			const report = orchestrator.getEvolutionReport()
			if (report && report.totalInteractions % 30 === 0) {
				void orchestrator.evolve()
			}

			// ─── Feed interaction data to cortex confidence calibrator ──
			if (orchestrator.isModuleEnabled('cortex')) {
				try {
					const cortexEngine = orchestrator.getCortexEngine()
					if (cortexEngine) {
						// The cortex engine uses this data to learn which query types
						// benefit most from deep analysis and adjusts confidence thresholds
						cortexEngine.recordOutcome(query, success, durationMs)
					}
				} catch (e) {
					logForDebugging(`[SuperAgent] cortex tracking failed: ${e}`)
				}
			}

			// ─── Update session context for temporal reasoning (Gap 9) ──
			try {
				const activeChain = orchestrator.getActiveReasoningChain()
				if (activeChain) {
					const sessionMgr = getSessionContextManager()
					sessionMgr.updateFromChain(activeChain)
				}
			} catch {
				// Non-critical
			}

			// ─── Periodic governance scan (every 50 interactions) ────
			if (orchestrator.isModuleEnabled('governance')) {
				try {
					const _report = orchestrator.getGovernanceReport()
					const interactionCount = orchestrator.getEvolutionReport()?.totalInteractions ?? 0
					if (interactionCount > 0 && interactionCount % 50 === 0) {
						// Governance scan runs on the project root (src/)
						const governanceEngine = orchestrator.getGovernanceEngine()
						if (governanceEngine) {
							void governanceEngine.analyzeProject('src/').catch(() => {})
						}
					}
				} catch {
					// Non-critical
				}
			}
		} catch (e) {
			logForDebugging(`[SuperAgent] post-sampling hook error: ${e}`)
		}
	})

	logForDebugging('[SuperAgent] hooks registered')
}

/**
 * Extract cortex analysis metadata from the orchestrator for evolution fitness.
 * Feeds complexity, domain, confidence, gaps, and bias data into interaction records.
 */
function extractCortexMeta(orchestrator: SuperAgentOrchestrator): InteractionRecord['cortexMeta'] {
	try {
		const analysis = orchestrator.getState().activeCortexAnalysis
		if (!analysis) return undefined

		// Find the primary meta insight for complexity and domain
		const complexityInsight = analysis.metaInsights.find((i) => i.type === 'query_complexity')
		const domainInsight = analysis.metaInsights.find((i) => i.type === 'domain_detection')
		const biasInsight = analysis.metaInsights.find((i) => i.type === 'bias_detection')

		return {
			complexity: complexityInsight?.confidence ?? 0.5,
			domain: domainInsight?.description?.split(' ').slice(0, 3).join(' ') ?? 'unknown',
			confidence: analysis.finalConfidence,
			gapsCount: analysis.metaInsights.filter((i) => i.type === 'missing_context').length,
			biasDetected: biasInsight !== undefined && biasInsight.confidence > 0.6,
		}
	} catch {
		return undefined
	}
}
