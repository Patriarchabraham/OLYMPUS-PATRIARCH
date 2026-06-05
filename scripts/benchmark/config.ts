/**
 * Default benchmark configuration and model presets.
 */

import type { BenchmarkConfig } from "./types";

/** Default configuration for a benchmark run. */
export const DEFAULT_CONFIG: BenchmarkConfig = {
	dataset: "https://huggingface.co/datasets/princeton-nlp/SWE-bench_Lite/resolve/main/swe-bench-lite.jsonl",
	model: "claude-sonnet-4-5-20250514",
	provider: "anthropic",
	concurrency: 4,
	task_timeout_ms: 600_000, // 10 minutes
	repo_filter: [],
	difficulty_filter: [],
	language_filter: [],
	max_tasks: 0,
	output_dir: "./benchmark-results",
	run_docker_tests: true,
	olympuz_binary: "olympuz",
};

/** Pre-configured model combinations for evaluation. */
export const MODEL_PRESETS: Record<string, Pick<BenchmarkConfig, "model" | "provider">> = {
	"claude-opus": { model: "claude-opus-4-7", provider: "anthropic" },
	"claude-sonnet": { model: "claude-sonnet-4-5-20250514", provider: "anthropic" },
	"claude-haiku": { model: "claude-haiku-4-5-20251001", provider: "anthropic" },
	"gpt4o": { model: "gpt-4o", provider: "openai" },
	"gpt4o-mini": { model: "gpt-4o-mini", provider: "openai" },
	"gemini-flash": { model: "gemini-2.5-flash", provider: "google" },
	"gemini-pro": { model: "gemini-2.5-pro", provider: "google" },
	"deepseek-v3": { model: "deepseek-chat", provider: "deepseek" },
	"ollama-codellama": { model: "codellama:34b", provider: "ollama" },
};

/** Available dataset sources. */
export const DATASETS: Record<string, string> = {
	lite: "https://huggingface.co/datasets/princeton-nlp/SWE-bench_Lite/resolve/main/swe-bench-lite.jsonl",
	verified: "https://huggingface.co/datasets/princeton-nlp/SWE-bench_Verified/resolve/main/swe-bench-verified.jsonl",
	full: "https://huggingface.co/datasets/princeton-nlp/SWE-bench/resolve/main/swe-bench.jsonl",
};

/**
 * Resolve a preset name to a partial config.
 * Returns null if the preset is not found.
 */
export function resolvePreset(name: string): Pick<BenchmarkConfig, "model" | "provider"> | null {
	return MODEL_PRESETS[name] ?? null;
}

/**
 * Build a BenchmarkConfig from CLI arguments.
 */
export function buildConfig(overrides: Partial<BenchmarkConfig>): BenchmarkConfig {
	return { ...DEFAULT_CONFIG, ...overrides };
}
