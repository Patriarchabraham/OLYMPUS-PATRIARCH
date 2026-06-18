/**
 * Chain-of-Thought reasoning — LLM-backed.
 *
 * Requires a real GenerateFn. Throws if none is provided so callers fail
 * loudly rather than silently producing template-fabricated output.
 */

import { randomUUID } from 'node:crypto'
import type { GenerateFn, ReasoningChain, ReasoningStep } from './types.js'

const DECOMPOSITION_PROMPT = `Decompose the following problem into a sequence of logical reasoning steps.
For each step, provide:
- type: one of "analysis", "decomposition", "hypothesis", "verification", "synthesis"
- content: the reasoning for this step
- confidence: your confidence in this step (0.0 to 1.0)

Format your response as a JSON array of objects with "type", "content", and "confidence" fields.
End with a final conclusion after the array, prefixed with "CONCLUSION: ".

Problem: `

const STEP_REFINEMENT_PROMPT = `Given the previous reasoning step:
"""
{previous}
"""

And the original problem:
"""
{query}
"""

What is the next logical step? Provide a single JSON object with "type", "content", and "confidence" fields.`

/** Detect the domain / query type from free text. Used for metadata only. */
function detectQueryType(text: string): string {
	const lower = text.toLowerCase()
	if (/\b(bug|error|fix|crash|fail|exception|traceback)\b/.test(lower)) return 'debugging'
	if (/\b(secur|vulnerab|auth|encrypt|xss|sql injection|csrf|owasp)\b/.test(lower))
		return 'security'
	if (/\b(design|architect|plan|system|structure|microservice|monolith)\b/.test(lower))
		return 'architecture'
	if (/\b(perform|speed|optim|fast|slow|latency|throughput|bottleneck)\b/.test(lower))
		return 'performance'
	if (/\b(test|verif|valid|assert|property.based|invariant)\b/.test(lower)) return 'verification'
	if (/\b(implement|build|create|add|write|develop)\b/.test(lower)) return 'implementation'
	return 'general'
}

/** TF-IDF-lite keyword extraction. Used for metadata only. */
function extractTopKeywords(text: string): string[] {
	const stopWords = new Set([
		'the',
		'a',
		'an',
		'is',
		'are',
		'was',
		'were',
		'be',
		'been',
		'have',
		'has',
		'had',
		'do',
		'does',
		'did',
		'will',
		'would',
		'could',
		'should',
		'to',
		'of',
		'in',
		'for',
		'on',
		'with',
		'at',
		'by',
		'from',
		'as',
		'into',
		'through',
		'and',
		'or',
		'if',
		'not',
		'this',
		'that',
		'it',
		'i',
		'me',
		'my',
		'we',
		'our',
		'you',
		'your',
		'but',
		'about',
		'what',
		'how',
		'why',
		'when',
		'where',
		'which',
		'who',
		'can',
		'may',
	])

	const words = text
		.toLowerCase()
		.replace(/[^a-z0-9\s_]/g, ' ')
		.split(/\s+/)
	const freq = new Map<string, number>()
	for (const w of words) {
		if (w.length > 2 && !stopWords.has(w)) {
			freq.set(w, (freq.get(w) ?? 0) + 1)
		}
	}

	return [...freq.entries()]
		.sort((a, b) => b[1] - a[1])
		.slice(0, 10)
		.map(([w]) => w)
}

function parseSteps(raw: string): { steps: ReasoningStep[]; conclusion: string } {
	const steps: ReasoningStep[] = []
	let conclusion = ''

	const conclusionMatch = raw.match(/CONCLUSION:\s*(.+)/s)
	if (conclusionMatch) {
		conclusion = conclusionMatch[1]!.trim()
	}

	// Try to extract JSON array
	const jsonMatch = raw.match(/\[[\s\S]*?\]/)
	if (jsonMatch) {
		try {
			const parsed = JSON.parse(jsonMatch[0]) as Array<{
				type?: string
				content?: string
				confidence?: number
			}>
			const validTypes = new Set([
				'analysis',
				'decomposition',
				'hypothesis',
				'verification',
				'synthesis',
			])
			for (const item of parsed) {
				steps.push({
					id: randomUUID(),
					type: validTypes.has(item.type ?? '') ? (item.type as ReasoningStep['type']) : 'analysis',
					content: item.content ?? '',
					confidence: Math.max(0, Math.min(1, item.confidence ?? 0.5)),
				})
			}
		} catch {
			// If JSON parsing fails, create a single step from the raw text
			steps.push({
				id: randomUUID(),
				type: 'analysis',
				content: raw.replace(/CONCLUSION:.*$/s, '').trim(),
				confidence: 0.5,
			})
		}
	}

	if (!conclusion && steps.length > 0) {
		conclusion = steps[steps.length - 1]!.content
	}

	return { steps, conclusion }
}

export async function runChainOfThought(
	query: string,
	context?: string,
	generateFn?: GenerateFn,
): Promise<ReasoningChain> {
	if (!generateFn) {
		throw new Error('runChainOfThought requires a real GenerateFn — no LLM available')
	}
	const startTime = Date.now()

	// Build the prompt with optional context
	const fullQuery = context ? `Context: ${context}\n\n${query}` : query
	const prompt = DECOMPOSITION_PROMPT + fullQuery

	const raw = await generateFn(prompt)
	const { steps, conclusion } = parseSteps(raw)

	// If we got very few steps, try to refine with follow-up
	if (steps.length < 2) {
		const refinementPrompt = STEP_REFINEMENT_PROMPT.replace(
			'{previous}',
			steps[0]?.content ?? 'initial analysis',
		).replace('{query}', fullQuery)
		const refinement = await generateFn(refinementPrompt)
		const refined = parseSteps(refinement)
		steps.push(...refined.steps)
	}

	// Ensure we have a synthesis step at the end
	const hasSynthesis = steps.some((s) => s.type === 'synthesis')
	if (!hasSynthesis && steps.length > 0) {
		steps.push({
			id: randomUUID(),
			type: 'synthesis',
			content: conclusion || 'Synthesizing all reasoning steps into a final answer',
			confidence: Math.max(...steps.map((s) => s.confidence), 0.5),
		})
	}

	// Confidence: type-weighted average (synthesis and verification weight more)
	const TYPE_WEIGHTS: Record<ReasoningStep['type'], number> = {
		synthesis: 1.5,
		verification: 1.3,
		analysis: 1.0,
		hypothesis: 0.9,
		decomposition: 0.8,
	}
	const weightedSum = steps.reduce((sum, s) => sum + s.confidence * (TYPE_WEIGHTS[s.type] ?? 1), 0)
	const totalWeight = steps.reduce((sum, s) => sum + (TYPE_WEIGHTS[s.type] ?? 1), 0)
	const overallConfidence = totalWeight > 0 ? weightedSum / totalWeight : 0.5

	return {
		id: randomUUID(),
		strategy: 'cot',
		query,
		steps,
		conclusion: conclusion || 'Analysis complete through chain-of-thought reasoning.',
		confidence: overallConfidence,
		durationMs: Date.now() - startTime,
		timestamp: Date.now(),
		metadata: {
			domain: detectQueryType(query),
			stepCount: steps.length,
			keywords: extractTopKeywords(query).slice(0, 5),
		},
	}
}
