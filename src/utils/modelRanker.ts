/**
 * Cross-Provider Model Ranking System.
 *
 * Ranks all available LLM models across configured providers by capability,
 * selecting the best model for a given task complexity. Integrates with
 * the existing provider auto-detection and Ollama recommendation systems.
 *
 * Ranking factors:
 *   - Reasoning capability (coding, architecture, debugging)
 *   - Speed (latency for simple tasks)
 *   - Cost efficiency (cheaper models for trivial tasks)
 *   - Context window size
 *   - Task complexity matching
 */

import type { DetectedProvider } from './providerAutoDetect.js'
import type { RecommendationGoal } from './providerRecommendation.js'

// ============================================================
// Model capability database
// ============================================================

export interface ModelCapabilities {
	/** Provider that serves this model. */
	provider: ModelProvider
	/** Reasoning quality 1-10 (architecture, debugging, complex logic). */
	reasoning: number
	/** Response speed 1-10 (higher = faster). */
	speed: number
	/** Cost efficiency 1-10 (higher = cheaper). */
	cost: number
	/** Maximum context window in tokens. */
	contextWindow: number
	/** Whether this model supports tool/function calling. */
	toolUse: boolean
	/** Whether this model supports vision/image inputs. */
	vision: boolean
	/** Whether this model supports extended/reasoning thinking. */
	extendedThinking: boolean
}

export type ModelProvider =
	| 'anthropic'
	| 'openai'
	| 'codex'
	| 'gemini'
	| 'mistral'
	| 'xai'
	| 'ollama'
	| 'github'
	| 'bedrock'
	| 'vertex'
	| 'minimax'
	| 'nvidia'
	| 'deepseek'
	| 'amazon'
	| 'meta'
	| 'cohere'
	| 'qwen'
	| 'local'

export type TaskComplexity = 'trivial' | 'simple' | 'moderate' | 'complex' | 'extreme'

export interface RankedModel {
	modelId: string
	provider: ModelProvider
	capabilities: ModelCapabilities
	score: number
	reasons: string[]
}

// ============================================================
// Known model capabilities
// ============================================================

const MODEL_DATABASE: Record<string, ModelCapabilities> = {
	// --- Anthropic Claude ---
	'claude-opus-4': {
		provider: 'anthropic',
		reasoning: 10,
		speed: 4,
		cost: 2,
		contextWindow: 200_000,
		toolUse: true,
		vision: true,
		extendedThinking: true,
	},
	'claude-opus-4.5': {
		provider: 'anthropic',
		reasoning: 10,
		speed: 4,
		cost: 2,
		contextWindow: 200_000,
		toolUse: true,
		vision: true,
		extendedThinking: true,
	},
	'claude-opus-4.7': {
		provider: 'anthropic',
		reasoning: 10,
		speed: 4,
		cost: 2,
		contextWindow: 1_000_000,
		toolUse: true,
		vision: true,
		extendedThinking: true,
	},
	'claude-sonnet-4': {
		provider: 'anthropic',
		reasoning: 8,
		speed: 7,
		cost: 5,
		contextWindow: 200_000,
		toolUse: true,
		vision: true,
		extendedThinking: true,
	},
	'claude-sonnet-4.5': {
		provider: 'anthropic',
		reasoning: 8,
		speed: 7,
		cost: 5,
		contextWindow: 200_000,
		toolUse: true,
		vision: true,
		extendedThinking: true,
	},
	'claude-haiku-4': {
		provider: 'anthropic',
		reasoning: 6,
		speed: 9,
		cost: 9,
		contextWindow: 200_000,
		toolUse: true,
		vision: true,
		extendedThinking: false,
	},
	'claude-haiku-4.5': {
		provider: 'anthropic',
		reasoning: 6,
		speed: 9,
		cost: 9,
		contextWindow: 200_000,
		toolUse: true,
		vision: true,
		extendedThinking: false,
	},

	// --- OpenAI ---
	'gpt-5.5': {
		provider: 'openai',
		reasoning: 10,
		speed: 4,
		cost: 2,
		contextWindow: 256_000,
		toolUse: true,
		vision: true,
		extendedThinking: true,
	},
	'gpt-5.4': {
		provider: 'openai',
		reasoning: 9,
		speed: 5,
		cost: 3,
		contextWindow: 256_000,
		toolUse: true,
		vision: true,
		extendedThinking: true,
	},
	'gpt-5.5-mini': {
		provider: 'openai',
		reasoning: 7,
		speed: 8,
		cost: 7,
		contextWindow: 128_000,
		toolUse: true,
		vision: true,
		extendedThinking: false,
	},
	'gpt-5.4-mini': {
		provider: 'openai',
		reasoning: 7,
		speed: 8,
		cost: 7,
		contextWindow: 128_000,
		toolUse: true,
		vision: true,
		extendedThinking: false,
	},
	'gpt-4o': {
		provider: 'openai',
		reasoning: 9,
		speed: 6,
		cost: 4,
		contextWindow: 128_000,
		toolUse: true,
		vision: true,
		extendedThinking: false,
	},
	'gpt-4o-mini': {
		provider: 'openai',
		reasoning: 5,
		speed: 10,
		cost: 10,
		contextWindow: 128_000,
		toolUse: true,
		vision: true,
		extendedThinking: false,
	},
	o3: {
		provider: 'openai',
		reasoning: 10,
		speed: 3,
		cost: 2,
		contextWindow: 200_000,
		toolUse: true,
		vision: true,
		extendedThinking: true,
	},
	'o4-mini': {
		provider: 'openai',
		reasoning: 8,
		speed: 7,
		cost: 6,
		contextWindow: 200_000,
		toolUse: true,
		vision: true,
		extendedThinking: true,
	},

	// --- Codex ---
	'gpt-5.3-codex': {
		provider: 'codex',
		reasoning: 9,
		speed: 5,
		cost: 3,
		contextWindow: 256_000,
		toolUse: true,
		vision: false,
		extendedThinking: true,
	},
	'gpt-5.2-codex': {
		provider: 'codex',
		reasoning: 8,
		speed: 6,
		cost: 4,
		contextWindow: 128_000,
		toolUse: true,
		vision: false,
		extendedThinking: true,
	},
	'gpt-5.3-codex-spark': {
		provider: 'codex',
		reasoning: 7,
		speed: 8,
		cost: 7,
		contextWindow: 128_000,
		toolUse: true,
		vision: false,
		extendedThinking: false,
	},
	'gpt-5.1-codex-max': {
		provider: 'codex',
		reasoning: 9,
		speed: 4,
		cost: 3,
		contextWindow: 256_000,
		toolUse: true,
		vision: false,
		extendedThinking: true,
	},
	'gpt-5.1-codex-mini': {
		provider: 'codex',
		reasoning: 6,
		speed: 9,
		cost: 8,
		contextWindow: 128_000,
		toolUse: true,
		vision: false,
		extendedThinking: false,
	},

	// --- Google Gemini ---
	'gemini-3-pro': {
		provider: 'gemini',
		reasoning: 9,
		speed: 5,
		cost: 4,
		contextWindow: 1_000_000,
		toolUse: true,
		vision: true,
		extendedThinking: true,
	},
	'gemini-3-flash': {
		provider: 'gemini',
		reasoning: 7,
		speed: 8,
		cost: 8,
		contextWindow: 1_000_000,
		toolUse: true,
		vision: true,
		extendedThinking: false,
	},
	'gemini-3-flash-preview': {
		provider: 'gemini',
		reasoning: 7,
		speed: 8,
		cost: 8,
		contextWindow: 1_000_000,
		toolUse: true,
		vision: true,
		extendedThinking: false,
	},
	'gemini-2.5-pro': {
		provider: 'gemini',
		reasoning: 9,
		speed: 5,
		cost: 4,
		contextWindow: 1_000_000,
		toolUse: true,
		vision: true,
		extendedThinking: true,
	},
	'gemini-2.5-flash': {
		provider: 'gemini',
		reasoning: 6,
		speed: 9,
		cost: 10,
		contextWindow: 1_000_000,
		toolUse: true,
		vision: true,
		extendedThinking: false,
	},

	// --- Mistral ---
	'devstral-latest': {
		provider: 'mistral',
		reasoning: 7,
		speed: 7,
		cost: 6,
		contextWindow: 128_000,
		toolUse: true,
		vision: false,
		extendedThinking: false,
	},
	'mistral-large-latest': {
		provider: 'mistral',
		reasoning: 8,
		speed: 5,
		cost: 4,
		contextWindow: 128_000,
		toolUse: true,
		vision: true,
		extendedThinking: false,
	},
	'codestral-latest': {
		provider: 'mistral',
		reasoning: 7,
		speed: 7,
		cost: 6,
		contextWindow: 256_000,
		toolUse: true,
		vision: false,
		extendedThinking: false,
	},

	// --- xAI Grok ---
	'grok-4': {
		provider: 'xai',
		reasoning: 9,
		speed: 5,
		cost: 3,
		contextWindow: 256_000,
		toolUse: true,
		vision: true,
		extendedThinking: true,
	},
	'grok-4.3': {
		provider: 'xai',
		reasoning: 9,
		speed: 5,
		cost: 3,
		contextWindow: 1_000_000,
		toolUse: true,
		vision: true,
		extendedThinking: true,
	},
	'grok-code-fast-1': {
		provider: 'xai',
		reasoning: 7,
		speed: 8,
		cost: 7,
		contextWindow: 256_000,
		toolUse: true,
		vision: false,
		extendedThinking: false,
	},

	// --- DeepSeek ---
	'deepseek-r1': {
		provider: 'deepseek',
		reasoning: 9,
		speed: 4,
		cost: 8,
		contextWindow: 128_000,
		toolUse: true,
		vision: false,
		extendedThinking: true,
	},
	'deepseek-v3': {
		provider: 'deepseek',
		reasoning: 8,
		speed: 6,
		cost: 9,
		contextWindow: 128_000,
		toolUse: true,
		vision: false,
		extendedThinking: false,
	},
	'deepseek-coder-v2': {
		provider: 'deepseek',
		reasoning: 7,
		speed: 7,
		cost: 9,
		contextWindow: 128_000,
		toolUse: true,
		vision: false,
		extendedThinking: false,
	},

	// --- Amazon Nova ---
	'nova-pro': {
		provider: 'amazon',
		reasoning: 7,
		speed: 7,
		cost: 6,
		contextWindow: 300_000,
		toolUse: true,
		vision: true,
		extendedThinking: false,
	},
	'nova-lite': {
		provider: 'amazon',
		reasoning: 5,
		speed: 10,
		cost: 10,
		contextWindow: 300_000,
		toolUse: true,
		vision: true,
		extendedThinking: false,
	},

	// --- Meta Llama ---
	'llama-4-maverick': {
		provider: 'meta',
		reasoning: 8,
		speed: 6,
		cost: 9,
		contextWindow: 1_000_000,
		toolUse: true,
		vision: true,
		extendedThinking: false,
	},
	'llama-4-scout': {
		provider: 'meta',
		reasoning: 7,
		speed: 8,
		cost: 10,
		contextWindow: 10_000_000,
		toolUse: true,
		vision: true,
		extendedThinking: false,
	},

	// --- Cohere ---
	'command-r-plus': {
		provider: 'cohere',
		reasoning: 7,
		speed: 6,
		cost: 5,
		contextWindow: 128_000,
		toolUse: true,
		vision: false,
		extendedThinking: false,
	},
	'command-r': {
		provider: 'cohere',
		reasoning: 6,
		speed: 8,
		cost: 7,
		contextWindow: 128_000,
		toolUse: true,
		vision: false,
		extendedThinking: false,
	},

	// --- Qwen ---
	'qwen3-235b': {
		provider: 'qwen',
		reasoning: 8,
		speed: 6,
		cost: 8,
		contextWindow: 128_000,
		toolUse: true,
		vision: false,
		extendedThinking: true,
	},
	'qwen3-coder': {
		provider: 'qwen',
		reasoning: 7,
		speed: 7,
		cost: 9,
		contextWindow: 128_000,
		toolUse: true,
		vision: false,
		extendedThinking: false,
	},

	// --- Ollama (local) ---
	'ollama-codellama': {
		provider: 'ollama',
		reasoning: 6,
		speed: 7,
		cost: 10,
		contextWindow: 16_000,
		toolUse: false,
		vision: false,
		extendedThinking: false,
	},
	'ollama-deepseek-coder-v2': {
		provider: 'ollama',
		reasoning: 7,
		speed: 6,
		cost: 10,
		contextWindow: 128_000,
		toolUse: false,
		vision: false,
		extendedThinking: false,
	},
}

// ============================================================
// Fuzzy model matching
// ============================================================

/**
 * Finds the closest known model entry for a given model ID string.
 * Handles version suffixes, date stamps, and naming variants.
 */
export function findClosestModel(modelId: string): ModelCapabilities | null {
	const normalized = modelId.toLowerCase().trim()

	// Exact match
	if (MODEL_DATABASE[normalized]) {
		return MODEL_DATABASE[normalized]
	}

	// Prefix match (e.g., "claude-opus-4-20250514" matches "claude-opus-4")
	const sortedKeys = Object.keys(MODEL_DATABASE).sort((a, b) => b.length - a.length)
	for (const key of sortedKeys) {
		if (normalized.startsWith(key)) {
			return MODEL_DATABASE[key]
		}
	}

	// Keyword-based fuzzy matching
	const patterns: [RegExp, string][] = [
		[/claude.*opus/i, 'claude-opus-4'],
		[/claude.*sonnet/i, 'claude-sonnet-4'],
		[/claude.*haiku/i, 'claude-haiku-4'],
		[/gpt-?5\.?5/i, 'gpt-5.5'],
		[/gpt-?5\.?4/i, 'gpt-5.4'],
		[/gpt-?4o(?!\s*mini)/i, 'gpt-4o'],
		[/gpt-?4o.*mini/i, 'gpt-4o-mini'],
		[/\bo3\b/i, 'o3'],
		[/\bo4.*mini/i, 'o4-mini'],
		[/codex/i, 'gpt-5.3-codex'],
		[/gemini.*pro/i, 'gemini-3-pro'],
		[/gemini.*flash/i, 'gemini-3-flash'],
		[/devstral/i, 'devstral-latest'],
		[/codestral/i, 'codestral-latest'],
		[/mistral.*large/i, 'mistral-large-latest'],
		[/grok-?4/i, 'grok-4'],
		[/grok.*code.*fast/i, 'grok-code-fast-1'],
	]

	for (const [pattern, fallbackKey] of patterns) {
		if (pattern.test(normalized)) {
			return MODEL_DATABASE[fallbackKey] ?? null
		}
	}

	return null
}

// ============================================================
// Task complexity estimation
// ============================================================

const TRIVIAL_PATTERNS = [
	/^(list|show|print|echo|cat|ls)\b/i,
	/^(what time|what date|today)\b/i,
	/\b(format|lint|prettier|sort)\b/i,
]

const SIMPLE_PATTERNS = [
	/^(fix typo|rename|refactor)\b/i,
	/\b(add comment|add import|simple|basic)\b/i,
	/^(create|make|new)\s+(file|folder|class|function)\b/i,
]

const EXTREME_PATTERNS = [
	/\b(rewrite|rebuild|migrate|overhaul|redesign)\b/i,
	/\b(full-stack|end-to-end|production|enterprise)\b/i,
	/\b(security|audit|compliance|performance)\b.*\b(review|analysis|optimization)\b/i,
	/\b(microservice|distributed|scalable|high-availability)\b/i,
]

const COMPLEX_PATTERNS = [
	/\b(architect|design|implement|integrate)\b/i,
	/\b(debug|troubleshoot|investigate|root cause)\b/i,
	/\b(optimiz|perform|bottleneck|profiling)\b/i,
	/\b(test suite|coverage|regression)\b/i,
	/\b(api|endpoint|database|schema|migration)\b/i,
]

/**
 * Estimates task complexity from a query string without requiring
 * the full meta-cognition pipeline. Uses fast pattern matching.
 */
export function estimateTaskComplexity(query: string): TaskComplexity {
	const trimmed = query.trim()

	if (trimmed.length < 20) {
		return 'trivial'
	}

	for (const pattern of EXTREME_PATTERNS) {
		if (pattern.test(trimmed)) {
			return 'extreme'
		}
	}

	for (const pattern of COMPLEX_PATTERNS) {
		if (pattern.test(trimmed)) {
			return 'complex'
		}
	}

	for (const pattern of TRIVIAL_PATTERNS) {
		if (pattern.test(trimmed)) {
			return 'trivial'
		}
	}

	for (const pattern of SIMPLE_PATTERNS) {
		if (pattern.test(trimmed)) {
			return 'simple'
		}
	}

	// Word count heuristic
	const words = trimmed.split(/\s+/).length
	if (words > 80) return 'extreme'
	if (words > 40) return 'complex'
	if (words > 15) return 'moderate'
	return 'simple'
}

/**
 * Maps a RecommendationGoal from the existing provider recommendation
 * system to a TaskComplexity level.
 */
export function goalToComplexity(goal: RecommendationGoal): TaskComplexity {
	switch (goal) {
		case 'latency':
			return 'simple'
		case 'coding':
			return 'complex'
		case 'balanced':
			return 'moderate'
	}
}

/**
 * Maps TaskComplexity to a RecommendationGoal for backward compatibility.
 */
export function complexityToGoal(complexity: TaskComplexity): RecommendationGoal {
	switch (complexity) {
		case 'trivial':
			return 'latency'
		case 'simple':
			return 'latency'
		case 'moderate':
			return 'balanced'
		case 'complex':
			return 'coding'
		case 'extreme':
			return 'coding'
	}
}

// ============================================================
// Scoring weights per complexity level
// ============================================================

type ScoringWeights = {
	reasoning: number
	speed: number
	cost: number
	context: number
}

const COMPLEXITY_WEIGHTS: Record<TaskComplexity, ScoringWeights> = {
	trivial: { reasoning: 0.1, speed: 0.4, cost: 0.35, context: 0.15 },
	simple: { reasoning: 0.2, speed: 0.3, cost: 0.3, context: 0.2 },
	moderate: { reasoning: 0.4, speed: 0.2, cost: 0.15, context: 0.25 },
	complex: { reasoning: 0.5, speed: 0.15, cost: 0.1, context: 0.25 },
	extreme: { reasoning: 0.55, speed: 0.05, cost: 0.05, context: 0.35 },
}

// ============================================================
// Core ranking functions
// ============================================================

/** Context window score: log-scaled so 1M is not 5x better than 200K. */
function contextScore(contextWindow: number): number {
	if (contextWindow <= 0) return 0
	return Math.min(10, Math.log2(contextWindow / 10_000))
}

/**
 * Scores a single model for a given task complexity.
 * Returns a 0-100 score plus human-readable reasons.
 */
export function scoreModel(
	_modelId: string,
	capabilities: ModelCapabilities,
	complexity: TaskComplexity,
): { score: number; reasons: string[] } {
	const weights = COMPLEXITY_WEIGHTS[complexity]
	const reasons: string[] = []

	const reasoningNorm = capabilities.reasoning / 10
	const speedNorm = capabilities.speed / 10
	const costNorm = capabilities.cost / 10
	const contextNorm = contextScore(capabilities.contextWindow) / 10

	let score =
		reasoningNorm * weights.reasoning * 40 +
		speedNorm * weights.speed * 40 +
		costNorm * weights.cost * 40 +
		contextNorm * weights.context * 40

	// Bonus for tool use (required for agent mode)
	if (capabilities.toolUse) {
		score += 5
		reasons.push('tool use capable')
	} else {
		score -= 10
		reasons.push('no tool use')
	}

	// Bonus for extended thinking on complex tasks
	if (capabilities.extendedThinking && (complexity === 'complex' || complexity === 'extreme')) {
		score += 8
		reasons.push('extended thinking')
	}

	// Bonus for vision on multimodal tasks
	if (capabilities.vision) {
		score += 2
	}

	// Provider reliability bonus (Anthropic/OpenAI most reliable for coding)
	if (capabilities.provider === 'anthropic' || capabilities.provider === 'openai') {
		score += 3
		reasons.push('high-reliability provider')
	}

	// Tier label
	if (capabilities.reasoning >= 9) {
		reasons.push('tier-1 reasoning')
	} else if (capabilities.reasoning >= 7) {
		reasons.push('tier-2 reasoning')
	} else {
		reasons.push('tier-3 reasoning')
	}

	return { score: Math.round(score * 100) / 100, reasons: reasons.slice(0, 4) }
}

/**
 * Ranks all available models by suitability for a given task complexity.
 * Models are scored using the capability database; unknown models get
 * a conservative mid-range score.
 */
export function rankModels(
	availableModels: Array<{ modelId: string; provider: ModelProvider }>,
	complexity: TaskComplexity,
): RankedModel[] {
	const scored = availableModels.map(({ modelId, provider }) => {
		let capabilities = findClosestModel(modelId)

		if (!capabilities) {
			// Unknown model — assign conservative mid-range capabilities
			capabilities = {
				provider,
				reasoning: 5,
				speed: 5,
				cost: 5,
				contextWindow: 64_000,
				toolUse: true,
				vision: false,
				extendedThinking: false,
			}
		}

		const { score, reasons } = scoreModel(modelId, capabilities, complexity)

		return {
			modelId,
			provider,
			capabilities,
			score,
			reasons,
		}
	})

	return scored.sort((a, b) => b.score - a.score)
}

/**
 * Selects the single best model for a given task complexity from
 * all available providers.
 */
export function selectBestModel(
	availableModels: Array<{ modelId: string; provider: ModelProvider }>,
	complexity: TaskComplexity,
): RankedModel | null {
	const ranked = rankModels(availableModels, complexity)
	return ranked.length > 0 ? ranked[0] : null
}

// ============================================================
// Provider-to-model resolution
// ============================================================

/** Maps a DetectedProviderKind to a list of known default model IDs. */
function defaultModelsForProvider(
	provider: DetectedProvider,
): Array<{ modelId: string; provider: ModelProvider }> {
	const kind = provider.kind
	const model = provider.model

	if (model) {
		const mappedProvider = detectedKindToModelProvider(kind)
		return [{ modelId: model, provider: mappedProvider }]
	}

	switch (kind) {
		case 'anthropic':
			return [
				{ modelId: 'claude-sonnet-4', provider: 'anthropic' },
				{ modelId: 'claude-haiku-4', provider: 'anthropic' },
			]
		case 'openai':
			return [
				{ modelId: 'gpt-5.5', provider: 'openai' },
				{ modelId: 'gpt-4o', provider: 'openai' },
				{ modelId: 'gpt-4o-mini', provider: 'openai' },
			]
		case 'codex':
			return [
				{ modelId: 'gpt-5.3-codex', provider: 'codex' },
				{ modelId: 'gpt-5.3-codex-spark', provider: 'codex' },
			]
		case 'gemini':
			return [
				{ modelId: 'gemini-3-flash-preview', provider: 'gemini' },
				{ modelId: 'gemini-3-pro', provider: 'gemini' },
			]
		case 'mistral':
			return [
				{ modelId: 'devstral-latest', provider: 'mistral' },
				{ modelId: 'codestral-latest', provider: 'mistral' },
			]
		case 'xai':
			return [
				{ modelId: 'grok-4', provider: 'xai' },
				{ modelId: 'grok-code-fast-1', provider: 'xai' },
			]
		case 'github':
			return [{ modelId: 'gpt-4o', provider: 'github' }]
		case 'ollama':
		case 'lm-studio':
			return [] // Handled separately via Ollama ranking
		case 'minimax':
			return [{ modelId: 'minimax-latest', provider: 'minimax' }]
		default:
			return []
	}
}

function detectedKindToModelProvider(kind: string): ModelProvider {
	const mapping: Record<string, ModelProvider> = {
		anthropic: 'anthropic',
		openai: 'openai',
		codex: 'codex',
		gemini: 'gemini',
		mistral: 'mistral',
		xai: 'xai',
		github: 'github',
		ollama: 'ollama',
		'lm-studio': 'local',
		minimax: 'minimax',
	}
	return mapping[kind] ?? 'local'
}

/**
 * Given a list of detected providers, returns all candidate models
 * across providers ranked for the specified task complexity.
 */
export function rankAllProviders(
	detectedProviders: DetectedProvider[],
	complexity: TaskComplexity,
): RankedModel[] {
	const allModels: Array<{ modelId: string; provider: ModelProvider }> = []

	for (const provider of detectedProviders) {
		const models = defaultModelsForProvider(provider)
		allModels.push(...models)
	}

	return rankModels(allModels, complexity)
}

// ============================================================
// Quick selection helper
// ============================================================

export interface ModelSelection {
	modelId: string
	provider: ModelProvider
	capabilities: ModelCapabilities
	score: number
	reasons: string[]
	complexity: TaskComplexity
}

/**
 * One-call convenience: detect providers, rank models, return the best pick.
 *
 * @param detectedProviders - List of detected providers from providerAutoDetect
 * @param query - Optional user query for complexity estimation
 * @param complexity - Optional explicit complexity override
 */
export function selectBestForQuery(
	detectedProviders: DetectedProvider[],
	query?: string,
	complexity?: TaskComplexity,
): ModelSelection | null {
	const taskComplexity = complexity ?? (query ? estimateTaskComplexity(query) : 'moderate')
	const ranked = rankAllProviders(detectedProviders, taskComplexity)

	if (ranked.length === 0) {
		return null
	}

	const best = ranked[0]!
	return {
		modelId: best.modelId,
		provider: best.provider,
		capabilities: best.capabilities,
		score: best.score,
		reasons: best.reasons,
		complexity: taskComplexity,
	}
}
