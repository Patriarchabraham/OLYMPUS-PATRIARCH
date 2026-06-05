# SWE-bench Evaluation for Olympuz Coder

Benchmark Olympuz against the SWE-bench dataset to measure code resolution accuracy.

## Quick Start

```bash
# Evaluate with default settings (SWE-bench Lite, Claude Sonnet)
./scripts/benchmark/run-eval.sh

# Evaluate with a specific model preset
./scripts/benchmark/run-eval.sh --preset claude-opus --parallel 8

# Quick test with 10 tasks
./scripts/benchmark/run-eval.sh --preset gpt4o --max-tasks 10 --no-docker

# Run directly with bun
bun run scripts/benchmark/runner.ts --preset claude-opus --dataset lite
```

## Datasets

| Dataset | Tasks | Description |
|---------|-------|-------------|
| `lite` | ~300 | Curated subset, good for quick evaluation |
| `verified` | ~500 | Human-verified subset |
| `full` | ~2,294 | Complete SWE-bench dataset |

You can also pass a URL or local file path to `--dataset`.

## Model Presets

| Preset | Model | Provider |
|--------|-------|----------|
| `claude-opus` | Claude Opus 4.7 | Anthropic |
| `claude-sonnet` | Claude Sonnet 4.5 | Anthropic |
| `claude-haiku` | Claude Haiku 4.5 | Anthropic |
| `gpt4o` | GPT-4o | OpenAI |
| `gpt4o-mini` | GPT-4o Mini | OpenAI |
| `gemini-flash` | Gemini 2.5 Flash | Google |
| `gemini-pro` | Gemini 2.5 Pro | Google |
| `deepseek-v3` | DeepSeek V3 | DeepSeek |
| `ollama-codellama` | CodeLlama 34B | Ollama |

## Docker-based Test Validation

By default, the runner uses Docker to validate generated patches by running the actual test suites. This requires:

- Docker installed and running
- The `swebench/eval:latest` image (auto-pulled on first use)

To skip Docker validation (uses patch similarity as proxy):

```bash
./scripts/benchmark/run-eval.sh --no-docker
```

## Output

Results are saved to `./benchmark-results/` (configurable with `--output-dir`):

- `results-*.json` — Full JSON result data
- `report-*.md` — Human-readable Markdown report

The report includes:
- Overall pass@1 score
- Per-repository breakdown
- Per-difficulty breakdown
- Comparison table with other tools
- Token usage and timing statistics

## Interpreting Results

- **pass@1**: Percentage of tasks where the generated patch fully resolves the issue (all tests pass). This is the primary metric.
- **FAIL→PASS rate**: Fraction of previously-failing tests that now pass.
- **PASS→PASS rate**: Fraction of previously-passing tests that still pass (regression check).
- **Patch similarity**: Line-level Jaccard similarity between generated and gold patches.

## Adding New Model Configurations

Edit `scripts/benchmark/config.ts` to add presets:

```typescript
export const MODEL_PRESETS = {
  // ... existing presets ...
  "my-model": { model: "my-model-id", provider: "my-provider" },
};
```

## Architecture

```
scripts/benchmark/
  runner.ts     — Main evaluation orchestrator + CLI
  agent.ts      — Olympuz CLI wrapper (runs headless, captures patches)
  scorer.ts     — Patch comparison + Docker test validation
  report.ts     — Markdown/JSON report generation
  config.ts     — Default config + model presets
  types.ts      — TypeScript type definitions
  Dockerfile    — Docker evaluation environment
  run-eval.sh   — Shell entry point
```
