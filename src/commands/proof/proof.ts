import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/messages.mjs'
import type { Command } from '../../commands.js'
import { getSuperAgentOrchestrator } from '../../services/superAgent/index.js'

const command: Command = {
	type: 'prompt',
	name: 'proof',
	description:
		'Proof Engine — mathematical, logical, engineering, and typographical verification with Bayesian confidence scoring',
	isEnabled: () => true,
	progressMessage: 'running proof verification',
	contentLength: 0,
	source: 'builtin',
	async getPromptForCommand(args?: string): Promise<ContentBlockParam[]> {
		const action = args?.trim() || 'help'

		const helpText = `[Proof Engine]
Maximum-quality verification across 4 dimensions:
- Mathematical: invariants, numerical correctness, Bayesian confidence, compositional proof
- Logical: propositional consistency, dead code, predicate logic, type soundness
- Engineering: SOLID compliance, Big-O analysis, coupling metrics, error handling
- Typographical: naming consistency, typo detection (Levenshtein), JSDoc accuracy, token efficiency

Available actions:
- /proof help — Show this help
- /proof status — Show proof engine status and recent results
- /proof verify <code> — Verify inline code snippet
- /proof file <path> — Verify a specific file
- /proof scan <dir> — Scan a directory
- /proof tokens — Show token efficiency report

Confidence threshold: 0.997 (99.7%)
All scores use Bayesian posterior computation.`

		if (action === 'help' || action === '') {
			return [{ type: 'text', text: helpText }]
		}

		const orchestrator = getSuperAgentOrchestrator()
		const engine = orchestrator.getProofEngine()

		if (!engine || !orchestrator.isModuleEnabled('proof')) {
			return [{ type: 'text', text: '[Proof Engine] Engine not initialized.' }]
		}

		const parts = action.split(' ')
		const subcommand = parts[0]
		const rest = parts.slice(1).join(' ')

		if (subcommand === 'status') {
			const config = engine.getConfig()
			const recent = engine.getRecentProofs(5)
			const report = engine.getTokenMultiplierReport()

			const lines = [
				`[Proof Engine Status]`,
				`Confidence threshold: ${(config.confidenceThreshold * 100).toFixed(1)}%`,
				`Enabled dimensions: ${config.dimensions.join(', ')}`,
				`Weights: math=${config.dimensionWeights.mathematical}, logic=${config.dimensionWeights.logical}, eng=${config.dimensionWeights.engineering}, typo=${config.dimensionWeights.typographical}`,
				`Total proofs: ${report.totalProofsRun}`,
				`Avg confidence: ${(report.averageConfidence * 100).toFixed(1)}%`,
				`Correct lines/token: ${report.currentCorrectLinesPerToken.toFixed(2)}`,
				`Trend: ${report.trend}`,
			]

			if (recent.length > 0) {
				lines.push(`\nRecent proofs:`)
				for (const p of recent) {
					const status = p.passed ? 'PASS' : 'FAIL'
					lines.push(`  [${status}] ${(p.overallConfidence * 100).toFixed(1)}% (${p.durationMs}ms)`)
				}
			}

			return [{ type: 'text', text: lines.join('\n') }]
		}

		if (subcommand === 'verify') {
			if (!rest) {
				return [{ type: 'text', text: '[Proof Engine] Usage: /proof verify <code>' }]
			}
			const result = await engine.prove(rest, 'inline-code')
			return [{ type: 'text', text: formatProofResult(result) }]
		}

		if (subcommand === 'file') {
			if (!rest) {
				return [{ type: 'text', text: '[Proof Engine] Usage: /proof file <path>' }]
			}
			try {
				const result = await engine.proveFile(rest)
				return [{ type: 'text', text: formatProofResult(result) }]
			} catch {
				return [{ type: 'text', text: `[Proof Engine] Could not read file: ${rest}` }]
			}
		}

		if (subcommand === 'scan') {
			const dir = rest || 'src/'
			try {
				const report = await engine.proveDirectory(dir)
				const lines = [
					`[Proof Engine Directory Scan: ${dir}]`,
					`Files: ${report.filesAnalyzed} (${report.filesPassing} pass, ${report.filesFailing} fail)`,
					`Average confidence: ${(report.averageConfidence * 100).toFixed(1)}%`,
					`Dimension averages:`,
					`  Mathematical: ${(report.dimensionAverages.mathematical * 100).toFixed(1)}%`,
					`  Logical: ${(report.dimensionAverages.logical * 100).toFixed(1)}%`,
					`  Engineering: ${(report.dimensionAverages.engineering * 100).toFixed(1)}%`,
					`  Typographical: ${(report.dimensionAverages.typographical * 100).toFixed(1)}%`,
					`Total findings: ${report.allFindings.length}`,
				]

				const errors = report.allFindings.filter((f) => f.severity === 'error' || f.severity === 'critical')
				if (errors.length > 0) {
					lines.push(`\nTop errors:`)
					for (const err of errors.slice(0, 10)) {
						lines.push(`  [${err.ruleId}] ${err.message}`)
					}
				}

				return [{ type: 'text', text: lines.join('\n') }]
			} catch {
				return [{ type: 'text', text: `[Proof Engine] Could not scan directory: ${dir}` }]
			}
		}

		if (subcommand === 'tokens') {
			const report = engine.getTokenMultiplierReport()
			const lines = [
				`[Proof Engine Token Efficiency]`,
				`Current correct-lines/token: ${report.currentCorrectLinesPerToken.toFixed(3)}`,
				`Baseline: ${report.baselineCorrectLinesPerToken.toFixed(3)}`,
				`Improvement rate: ${report.improvementRate.toFixed(4)}/entry`,
				`Trend: ${report.trend}`,
				`Total proofs: ${report.totalProofsRun}`,
				`Total tokens analyzed: ${report.totalTokensAnalyzed}`,
				`Average confidence: ${(report.averageConfidence * 100).toFixed(1)}%`,
			]
			if (report.recommendations.length > 0) {
				lines.push(`\nRecommendations:`)
				for (const rec of report.recommendations) {
					lines.push(`  - ${rec}`)
				}
			}
			return [{ type: 'text', text: lines.join('\n') }]
		}

		return [{ type: 'text', text: `[Proof Engine] Unknown action: ${subcommand}\n${helpText}` }]
	},
}

function formatProofResult(result: import('../../proofEngine/types.js').ProofResult): string {
	const lines = [
		`[Proof Result: ${result.passed ? 'PASS' : 'FAIL'}]`,
		`Overall confidence: ${(result.overallConfidence * 100).toFixed(1)}% (threshold: 99.7%)`,
		`Duration: ${result.durationMs}ms`,
		``,
		`Dimension scores:`,
		`  Mathematical:    ${(result.dimensions.mathematical.value * 100).toFixed(1)}%`,
		`  Logical:         ${(result.dimensions.logical.value * 100).toFixed(1)}%`,
		`  Engineering:     ${(result.dimensions.engineering.value * 100).toFixed(1)}%`,
		`  Typographical:   ${(result.dimensions.typographical.value * 100).toFixed(1)}%`,
	]

	const allFindings = [
		...result.dimensions.mathematical.findings,
		...result.dimensions.logical.findings,
		...result.dimensions.engineering.findings,
		...result.dimensions.typographical.findings,
	]

	if (allFindings.length > 0) {
		lines.push(`\nFindings (${allFindings.length}):`)
		for (const f of allFindings.slice(0, 15)) {
			lines.push(`  [${f.severity.toUpperCase()}] [${f.ruleId}] ${f.message}`)
			if (f.suggestion) lines.push(`    → ${f.suggestion}`)
		}
	}

	if (result.escalationFixes.length > 0) {
		lines.push(`\nEscalation fixes:`)
		for (const fix of result.escalationFixes) {
			lines.push(`  - ${fix}`)
		}
	}

	return lines.join('\n')
}

export default command
