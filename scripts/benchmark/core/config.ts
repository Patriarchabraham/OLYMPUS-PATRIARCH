/**
 * Shared configuration and suite registry for the benchmark framework.
 */

import { availableParallelism } from 'node:os'
import type { BenchmarkRunConfig, SuiteDefinition } from './types'

/** Detect safe default concurrency based on available hardware. */
function detectConcurrency(): number {
	const cpus = typeof availableParallelism === 'function' ? availableParallelism() : 2
	return Math.max(1, Math.min(cpus, 4))
}

/** Default configuration for a benchmark run. */
export const DEFAULT_RUN_CONFIG: BenchmarkRunConfig = {
	dataset: '',
	model: 'claude-sonnet-4-5-20250514',
	provider: 'anthropic',
	concurrency: detectConcurrency(),
	task_timeout_ms: 600_000,
	max_tasks: 0,
	output_dir: './benchmark-results',
	use_docker: false,
	olympuz_binary: 'olympuz',
	repo_filter: [],
	difficulty_filter: [],
	language_filter: [],
	superposition_samples: 1,
}

/** Pre-configured model presets. */
export const MODEL_PRESETS: Record<string, Pick<BenchmarkRunConfig, 'model' | 'provider'>> = {
	'claude-opus': { model: 'claude-opus-4-7', provider: 'anthropic' },
	'claude-sonnet': { model: 'claude-sonnet-4-5-20250514', provider: 'anthropic' },
	'claude-haiku': { model: 'claude-haiku-4-5-20251001', provider: 'anthropic' },
	gpt4o: { model: 'gpt-4o', provider: 'openai' },
	'gpt4o-mini': { model: 'gpt-4o-mini', provider: 'openai' },
	'gemini-flash': { model: 'gemini-2.5-flash', provider: 'gemini' },
	'gemini-pro': { model: 'gemini-2.5-pro', provider: 'gemini' },
	'deepseek-v3': { model: 'deepseek-chat', provider: 'openai' },
	'glm-5': { model: 'glm-5.1', provider: 'openai' },
	'ollama-codellama': { model: 'codellama:34b', provider: 'ollama' },
}

/** Suite registry — populated by each adapter's index.ts. */
const suiteRegistry = new Map<string, SuiteDefinition>()

/**
 * Register a benchmark suite adapter.
 */
export function registerSuite(definition: SuiteDefinition): void {
	suiteRegistry.set(definition.key, definition)
}

/**
 * Get a registered suite by key.
 */
export function getSuite(key: string): SuiteDefinition | undefined {
	return suiteRegistry.get(key)
}

/**
 * List all registered suites.
 */
export function listSuites(): SuiteDefinition[] {
	return [...suiteRegistry.values()]
}

/**
 * Resolve a preset name to a partial config.
 */
export function resolvePreset(name: string): Pick<BenchmarkRunConfig, 'model' | 'provider'> | null {
	return MODEL_PRESETS[name] ?? null
}

/**
 * Build a BenchmarkRunConfig from overrides.
 */
export function buildRunConfig(overrides: Partial<BenchmarkRunConfig>): BenchmarkRunConfig {
	return { ...DEFAULT_RUN_CONFIG, ...overrides }
}
