/**
 * Pure-heuristic task classifier.
 *
 * Categorizes an incoming query into one of eight {@link TaskType}s in <5ms.
 * Used by the router to pick the optimal provider per call. No LLM call.
 *
 * Rules are intentionally simple — keyword presence + size/file-count thresholds.
 * False-positive classifications are non-fatal: the router falls back to the
 * default profile when no rule matches the classified type.
 */

import type { TaskType } from './types.js'

/** Keyword → task type map. Order matters: more specific first. */
const KEYWORD_RULES: ReadonlyArray<{ readonly type: TaskType; readonly pattern: RegExp }> = [
	// Most specific first — these can be detected with high confidence.
	{
		type: 'trivial_fix',
		pattern: /\b(fix\s+typo|rename|spelling|whitespace|format(ing)?\s+fix)\b/i,
	},
	{
		type: 'docstring',
		pattern: /\b(docstring|jsdoc|comment|document(?:ation)?|readme|changelog)\b/i,
	},
	{ type: 'verification', pattern: /\b(verify|review|check|audit|lint|validate|inspect)\b/i },
	{
		type: 'debugging',
		pattern: /\b(debug|crash|error|stack\s?trace|exception|fail(?:ure|ed)?|broken|bug)\b/i,
	},
	{
		type: 'architecture',
		pattern: /\b(architect(?:ure)?|design|plan|strateg(?:y|ic)|blueprint|skeleton|spec)\b/i,
	},
	{
		type: 'deep_refactor',
		pattern: /\b(refactor|restructure|reorganize|modernize|migrat(?:e|ion)|rewrite|overhaul)\b/i,
	},
	{
		type: 'boilerplate',
		pattern: /\b(scaffold|stub|generate\s+(test|boilerplate)|bootstrap|starter|template)\b/i,
	},
] as const

/** Result returned by {@link classifyTask}. */
export interface Classification {
	taskType: TaskType
	/** Hint that the caller should prefer a fast/cheap model. */
	preferFast: boolean
	/** Hint that the caller should prefer a strong/costly model. */
	preferStrong: boolean
	/** Heuristic confidence in the classification, [0, 1]. */
	confidence: number
}

/**
 * Inputs used for classification. All fields optional except `queryText`.
 */
export interface ClassifyInput {
	queryText: string
	/** Number of tool_use blocks in flight (pending tool calls). */
	toolUseCount?: number
	/** Number of distinct files referenced in the query or pending tools. */
	fileCount?: number
	/** Estimated tokens already in the conversation context. */
	contextTokenEstimate?: number
}

/**
 * Classify a query heuristically. Always <5ms. No LLM call.
 *
 * @param input - Query and optional context signals.
 * @returns Classification with task type and routing hints.
 */
export function classifyTask(input: ClassifyInput): Classification {
	const text = input.queryText ?? ''
	const fileCount = input.fileCount ?? 0
	const toolUseCount = input.toolUseCount ?? 0
	const len = text.length

	// 1. Keyword match — first rule wins.
	for (const rule of KEYWORD_RULES) {
		if (rule.pattern.test(text)) {
			return finalize(rule.type, fileCount)
		}
	}

	// 2. Structural signals — file count is a strong indicator of scope.
	// Trivial classification requires VERY short query AND no tool activity.
	if (fileCount === 0 && len < 20 && toolUseCount === 0) {
		return finalize('trivial_fix', fileCount)
	}
	if (fileCount > 5) {
		return finalize('deep_refactor', fileCount)
	}

	// 3. Default — feature implementation is the safest assumption.
	return finalize('feature_impl', fileCount)
}

/**
 * Attach routing hints and confidence based on the resolved type.
 * Strong-preference types need large models; fast-preference types can run
 * on small/local models.
 */
function finalize(taskType: TaskType, fileCount: number): Classification {
	switch (taskType) {
		case 'trivial_fix':
		case 'boilerplate':
		case 'docstring':
			return { taskType, preferFast: true, preferStrong: false, confidence: 0.85 }
		case 'verification':
			return { taskType, preferFast: false, preferStrong: false, confidence: 0.7 }
		case 'feature_impl':
			return { taskType, preferFast: false, preferStrong: true, confidence: 0.55 }
		case 'debugging':
		case 'architecture':
			return { taskType, preferFast: false, preferStrong: true, confidence: 0.75 }
		case 'deep_refactor':
			// Confidence scales with file count — more files = stronger signal.
			return {
				taskType,
				preferFast: false,
				preferStrong: true,
				confidence: Math.min(0.95, 0.6 + fileCount * 0.05),
			}
	}
}
