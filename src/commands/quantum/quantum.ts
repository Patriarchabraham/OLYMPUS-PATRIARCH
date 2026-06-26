import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/messages.mjs'
import type { Command } from '../../commands.js'
import { QuantumEngine } from '../../quantum/quantumEngine.js'
import type { QuantumAnalysis } from '../../quantum/types.js'
import { getSuperAgentOrchestrator } from '../../services/superAgent/index.js'

const helpText = `[Quantum] — REAL multi-dimensional quantum reasoning over an LLM.

Usage:
- /quantum <task>   Run SUPERPOSE → EVALUATE → ENTANGLE → COLLAPSE → TUNNEL over
                    your task. The LLM generates query-specific candidates across
                    10 dimensions, then real quantum math (Hadamard gates, Born
                    rule, entanglement concurrence, projective collapse, quantum
                    walk tunneling) scores and selects the strongest solution.
                    Prints the collapsed solution with measured confidence,
                    dimensions covered, and Born probability.
- /quantum help     Show this help.

This is not prompt theater: the math runs on complex-amplitude state vectors,
and candidates/scores come from a live model. Without an API key it degrades
honestly (no fabricated templates).`

/** Render a quantum analysis into a compact, human-readable result block. */
function renderQuantum(analysis: QuantumAnalysis): string {
	if (analysis.degraded || analysis.states.length === 0) {
		return '[Quantum] produced no usable candidates (LLM unavailable or empty). Skipping — not fabricating.'
	}

	const collapse = analysis.collapseResult
	const confidencePct = (analysis.confidence * 100).toFixed(0)
	const bornPct = collapse ? (collapse.bornProbability * 100).toFixed(0) : 'n/a'
	const dims = analysis.dimensionsCovered.length
	const ent = analysis.entanglements.length

	const lines: string[] = []
	if (collapse?.collapsedState) {
		lines.push('[Quantum] collapsed solution:')
		lines.push(collapse.collapsedState.solution)
	} else {
		const best = analysis.states.reduce((a, b) => (b.confidence > a.confidence ? b : a))
		lines.push('[Quantum] no collapse outcome — best state by confidence:')
		lines.push(best.solution)
	}

	lines.push('')
	lines.push(
		`confidence ${confidencePct}% · born probability ${bornPct}% · ${dims} dimensions covered · ${ent} entanglements`,
	)
	if (collapse?.collapseReason) {
		lines.push(`collapse reason: ${collapse.collapseReason}`)
	}

	const runnerUps = collapse?.runnerUps ?? []
	if (runnerUps.length > 0) {
		lines.push('')
		lines.push('Runner-ups:')
		for (const r of runnerUps.slice(0, 3)) {
			const snippet = r.solution.length > 140 ? `${r.solution.slice(0, 140)}...` : r.solution
			lines.push(`  · [${r.dimension}] ${(r.confidence * 100).toFixed(0)}% — ${snippet}`)
		}
	}

	if (analysis.tunnelResults.length > 0) {
		lines.push('')
		lines.push('Tunnel insights:')
		for (const t of analysis.tunnelResults.slice(0, 2)) {
			lines.push(`  · ${t.tunnelPath} (interference gain ${t.interferenceGain.toFixed(3)})`)
		}
	}

	if (analysis.degraded) {
		lines.push('')
		lines.push('(degraded)')
	}

	return lines.join('\n')
}

const command = {
	type: 'prompt',
	name: 'quantum',
	description:
		'Run the multi-dimensional quantum reasoning pipeline and print the collapsed solution',
	isEnabled: () => true,
	progressMessage: 'running quantum reasoning',
	contentLength: 0,
	source: 'builtin',
	async getPromptForCommand(args?: string): Promise<ContentBlockParam[]> {
		const task = args?.trim() || ''
		if (!task || task === 'help') {
			return [{ type: 'text', text: helpText }]
		}

		try {
			// Initialize the super-agent so the cross-model provider is wired
			// (consistent with the other super-agent commands).
			const orchestrator = getSuperAgentOrchestrator()
			await orchestrator.initialize()
			const { createGenerateFn } = await import('../../reasoning/generateFnFactory.js')
			const generateFn = await createGenerateFn()
			if (!generateFn) {
				return [
					{
						type: 'text',
						text: '[Quantum] needs an LLM (no API key/provider configured). Skipping — not fabricating candidates.',
					},
				]
			}

			const engine = new QuantumEngine()
			engine.setGenerateFn(generateFn)
			const analysis = await engine.process(task)
			return [{ type: 'text', text: renderQuantum(analysis) }]
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e)
			return [{ type: 'text', text: `[Quantum] failed: ${msg}` }]
		}
	},
} satisfies Command

export default command
