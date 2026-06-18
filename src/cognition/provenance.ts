/**
 * Provenance renderer — the HONEST "consciousness report".
 *
 * Instead of AILEX's "Omega consciousness / 0.997 confidence", this shows what
 * the pipeline actually measured: each confidence component, the strategies run,
 * how many escalations/convergence passes, whether it converged, what was
 * verified and what contradicted. Every line is a real signal.
 */
import type { CognitionResult } from './types.js'

const pct = (n: number | null | undefined): string =>
	n == null ? 'n/a' : `${Math.round(n * 100)}%`

/** Human-readable provenance for a CognitionResult (used by /deep). */
export function renderProvenance(result: CognitionResult): string {
	const { intent, conclusion, confidence, verification, provenance: p } = result
	const lines: string[] = []

	lines.push('[Cognition] measured confidence (transparent, not a magic number):')
	lines.push(`  Overall: ${pct(confidence.measured)}`)
	lines.push(`    cortex (Bayes/Dempster-Shafer): ${pct(confidence.cortex)}`)
	lines.push(`    reasoning quality (coherence/completeness/bias): ${pct(confidence.reasoningQuality)}`)
	lines.push(`    cross-model agreement: ${pct(confidence.verification)}`)

	lines.push('')
	lines.push(`[Pipeline] model available: ${p.modelAvailable ? 'yes' : 'NO — reasoning skipped (no API key)'}`)
	lines.push(`  strategies tried: ${p.strategiesTried.length ? p.strategiesTried.join(' → ') : '(none)'}`)
	lines.push(`  depth escalations: ${p.escalations}`)
	lines.push(`  convergence passes: ${p.convergencePasses} ${p.converged ? '(converged)' : '(hit max — did NOT converge)'}`)
	lines.push(`  meta-insights surfaced: ${p.metaInsightsCount}`)

	if (verification) {
		lines.push('')
		lines.push(`[Verification] provider: ${verification.provider}`)
		lines.push(`  agreement: ${pct(verification.agreement)}`)
		if (verification.contradictions.length > 0) {
			lines.push(`  contradictions (${verification.contradictions.length}):`)
			for (const c of verification.contradictions.slice(0, 5)) lines.push(`    - ${c.slice(0, 160)}`)
		} else {
			lines.push('  contradictions: none detected')
		}
	}

	if (p.blindSpots.length > 0) {
		lines.push('')
		lines.push(`[Blind spots] ${p.blindSpots.slice(0, 5).join('; ')}`)
	}

	if (intent.implicit || intent.predictive || intent.constraints.length > 0) {
		lines.push('')
		lines.push('[Intent]')
		if (intent.implicit) lines.push(`  implicit: ${intent.implicit}`)
		if (intent.predictive) lines.push(`  next likely need: ${intent.predictive}`)
		if (intent.constraints.length > 0) lines.push(`  constraints: ${intent.constraints.join(', ')}`)
	}

	if (conclusion) {
		lines.push('')
		const c = conclusion.length > 400 ? `${conclusion.slice(0, 400)}…` : conclusion
		lines.push(`[Conclusion] ${c}`)
	}

	lines.push('')
	lines.push(`[Meta] duration: ${p.durationMs}ms — every number above is measured, not asserted.`)
	return lines.join('\n')
}
