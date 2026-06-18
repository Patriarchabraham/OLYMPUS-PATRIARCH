/**
 * Self-Reflection reasoning — LLM-backed.
 *
 * Iteratively critiques and improves a response until convergence
 * or max iterations. Requires a real GenerateFn.
 */

import { randomUUID } from 'node:crypto'
import type { GenerateFn, ReasoningChain, ReasoningStep, ReflectionResult } from './types.js'

const INITIAL_RESPONSE_PROMPT = `Provide a thorough and well-reasoned response to the following:

`

const CRITIQUE_PROMPT = `Critique the following response from FOUR perspectives:

1. **Technical Accuracy** — Are all technical claims correct? Any errors, outdated info, or misattributions?
2. **Logical Coherence** — Is the reasoning valid? Any gaps, circular logic, or unsupported leaps?
3. **Practical Applicability** — Would this actually work in practice? Any overlooked constraints, edge cases, or integration issues?
4. **Adversarial** — How could a skeptic attack this? What's the weakest argument?

For each issue found, assign a severity: [CRITICAL], [MAJOR], or [MINOR].
Format as a numbered list with severity labels.

Original question:
"""
{query}
"""

Response to critique:
"""
{response}
"""

List of issues:`

const IMPROVEMENT_PROMPT = `Based on this critique, provide an improved response to the original question.

Original question:
"""
{query}
"""

Previous response:
"""
{response}
"""

Critique:
"""
{critique}
"""

Provide the improved response:`

const CONVERGENCE_CHECK_PROMPT = `Compare these two versions of a response. Rate their similarity on a scale of 0.0 to 1.0, where 1.0 means they are essentially identical.

Version A:
"""
{versionA}
"""

Version B:
"""
{versionB}
"""

Similarity score (0.0-1.0):`

const DEFAULT_MAX_ITERATIONS = 3
const CONVERGENCE_THRESHOLD = 0.9

function parseSimilarity(raw: string): number {
	const match = raw.match(/(\d+\.?\d*)/)
	if (match) {
		return Math.max(0, Math.min(1, parseFloat(match[1]!)))
	}
	return 0.5
}

function extractCritiquePoints(
	raw: string,
): { text: string; severity: 'CRITICAL' | 'MAJOR' | 'MINOR' }[] {
	const lines = raw.split('\n').filter((l) => l.trim())
	return lines
		.map((l) => {
			const cleaned = l.replace(/^\d+[.)]\s*/, '').trim()
			if (cleaned.length < 10) return null
			// Extract severity label
			let severity: 'CRITICAL' | 'MAJOR' | 'MINOR' = 'MINOR'
			if (cleaned.includes('[CRITICAL]')) severity = 'CRITICAL'
			else if (cleaned.includes('[MAJOR]')) severity = 'MAJOR'
			const text = cleaned.replace(/\[(CRITICAL|MAJOR|MINOR)\]\s*/g, '').trim()
			return { text, severity }
		})
		.filter((p): p is NonNullable<typeof p> => p !== null && p.text.length > 10)
}

export async function runSelfReflection(
	query: string,
	context?: string,
	maxIterations?: number,
	generateFn?: GenerateFn,
): Promise<ReasoningChain> {
	if (!generateFn) {
		throw new Error('runSelfReflection requires a real GenerateFn — no LLM available')
	}
	const maxIter = maxIterations ?? DEFAULT_MAX_ITERATIONS
	const startTime = Date.now()

	const fullQuery = context ? `Context: ${context}\n\n${query}` : query

	// Phase 1: Generate initial response
	let currentResponse = await generateFn(INITIAL_RESPONSE_PROMPT + fullQuery)

	const reflectionHistory: ReflectionResult[] = []
	let converged = false

	for (let i = 0; i < maxIter; i++) {
		// Phase 2: Critique the current response
		const critiquePrompt = CRITIQUE_PROMPT.replace('{query}', fullQuery).replace(
			'{response}',
			currentResponse,
		)
		const critique = await generateFn(critiquePrompt)
		const _critiquePoints = extractCritiquePoints(critique)

		// Phase 3: Generate improved response
		const improvementPrompt = IMPROVEMENT_PROMPT.replace('{query}', fullQuery)
			.replace('{response}', currentResponse)
			.replace('{critique}', critique)
		const improved = await generateFn(improvementPrompt)

		// Phase 4: Check convergence
		const convergencePrompt = CONVERGENCE_CHECK_PROMPT.replace(
			'{versionA}',
			currentResponse,
		).replace('{versionB}', improved)
		const similarityRaw = await generateFn(convergencePrompt)
		const similarity = parseSimilarity(similarityRaw)

		reflectionHistory.push({
			originalOutput: currentResponse,
			critique,
			improvedOutput: improved,
			iterationCount: i + 1,
			converged: similarity >= CONVERGENCE_THRESHOLD,
		})

		currentResponse = improved

		if (similarity >= CONVERGENCE_THRESHOLD) {
			converged = true
			break
		}
	}

	// Build reasoning chain from reflection history
	const steps: ReasoningStep[] = [
		{
			id: randomUUID(),
			type: 'analysis',
			content: `Generated initial response (${currentResponse.length} chars) and applied ${reflectionHistory.length} critique-improvement iterations`,
			confidence: converged ? 0.9 : 0.7,
		},
		{
			id: randomUUID(),
			type: 'verification',
			content: reflectionHistory
				.map((r) => {
					const critical = r.critique.match(/\[CRITICAL\]/g)?.length ?? 0
					const major = r.critique.match(/\[MAJOR\]/g)?.length ?? 0
					return `Iteration ${r.iterationCount}: ${critical} critical, ${major} major issues, similarity ${(parseSimilarity(r.improvedOutput) * 100).toFixed(0)}%`
				})
				.join('\n'),
			confidence: converged ? 0.85 : 0.65,
		},
		{
			id: randomUUID(),
			type: 'synthesis',
			content: currentResponse.slice(0, 500),
			confidence: converged ? 0.92 : 0.72,
		},
	]

	const avgConfidence = steps.reduce((sum, s) => sum + s.confidence, 0) / steps.length

	return {
		id: randomUUID(),
		strategy: 'reflect',
		query,
		steps,
		conclusion: currentResponse.slice(0, 200),
		confidence: avgConfidence,
		durationMs: Date.now() - startTime,
		timestamp: Date.now(),
		metadata: {
			iterations: reflectionHistory.length,
			converged,
			finalSimilarity: reflectionHistory[reflectionHistory.length - 1]?.converged ? 1.0 : 0.5,
		},
	}
}
