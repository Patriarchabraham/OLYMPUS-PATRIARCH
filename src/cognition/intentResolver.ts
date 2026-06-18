/**
 * Intent resolver — the REAL "intent aggregation".
 *
 * Unlike a prompt label, this calls the model to STRUCTURE the user's intent
 * (explicit / implicit / meta / predictive / constraints), parses defensively,
 * and falls back to an honest heuristic when no model is available.
 */
import type { GenerateFn } from '../reasoning/types.js'
import type { Intent } from './types.js'

const FALLBACK_CONSTRAINTS: string[] = []

/** Heuristic intent when no model is available — honest, not fabricated. */
function heuristicIntent(query: string): Intent {
	const constraints: string[] = []
	const urgent = /\b(asap|urgent|now|quickly|deadline|today|emergency)\b/i
	const careful = /\b(carefully|thoroughly|production|secure|critical|important)\b/i
	if (urgent.test(query)) constraints.push('urgency detected')
	if (careful.test(query)) constraints.push('quality-critical')
	return {
		explicit: query,
		implicit: '',
		meta: '',
		predictive: '',
		constraints: constraints.length > 0 ? constraints : FALLBACK_CONSTRAINTS,
	}
}

/**
 * Resolve intent via the model. Returns a heuristic-only intent when there is
 * no generateFn (no API key) — never fabricates the implicit/meta/predictive
 * fields, which genuinely require a model.
 */
export async function resolveIntent(
	query: string,
	generateFn?: GenerateFn | null,
): Promise<Intent> {
	if (!generateFn) return heuristicIntent(query)

	const prompt = `Analyze the intent behind this request. Return ONLY a JSON object with keys
"explicit" (what they literally asked), "implicit" (what they mean but didn't say),
"meta" (why they are likely asking), "predictive" (what they'll need next), and
"constraints" (array of detected constraints: urgency, scope, quality). No prose.

Request: """${query}"""`

	let raw: string
	try {
		raw = await generateFn(prompt)
	} catch {
		return heuristicIntent(query)
	}

	// Tolerant JSON extraction (the model may wrap in prose or fences).
	const jsonMatch = raw.match(/\{[\s\S]*\}/)
	if (!jsonMatch) return { ...heuristicIntent(query) }
	try {
		const parsed = JSON.parse(jsonMatch[0]) as Partial<Intent>
		const str = (v: unknown): string => (typeof v === 'string' ? v : '')
		const arr = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [])
		return {
			explicit: str(parsed.explicit) || query,
			implicit: str(parsed.implicit),
			meta: str(parsed.meta),
			predictive: str(parsed.predictive),
			constraints: arr(parsed.constraints),
		}
	} catch {
		return { ...heuristicIntent(query) }
	}
}
