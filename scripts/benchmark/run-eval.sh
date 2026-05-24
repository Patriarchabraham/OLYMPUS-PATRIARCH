#!/usr/bin/env bash
# SWE-bench Evaluation Runner for Mythos Patriarch
#
# Usage:
#   ./run-eval.sh --dataset lite --model claude-opus-4-7 --parallel 4
#   ./run-eval.sh --preset gpt4o --max-tasks 50 --no-docker

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Defaults
DATASET="lite"
MODEL=""
PROVIDER=""
PRESET=""
PARALLEL=4
TIMEOUT=600000
MAX_TASKS=0
OUTPUT_DIR="./benchmark-results"
NO_DOCKER=false
MYTHOS_BINARY="mythos"
USE_CONTAINER=false

usage() {
    cat <<EOF
SWE-bench Evaluation Runner for Mythos Patriarch

Usage: $0 [options]

Options:
  --dataset <lite|verified|full|url>   Dataset to evaluate (default: lite)
  --model <model>                      Model to evaluate
  --provider <provider>                Provider to use
  --preset <name>                      Model preset (claude-opus, gpt4o, etc.)
  --parallel <n>                       Max concurrent tasks (default: 4)
  --timeout <ms>                       Per-task timeout in ms (default: 600000)
  --max-tasks <n>                      Limit number of tasks (default: 0 = all)
  --output-dir <path>                  Output directory (default: ./benchmark-results)
  --no-docker                          Skip Docker-based test validation
  --mythos-binary <path>               Path to mythos binary (default: mythos)
  --container                          Run inside Docker container
  --help                               Show this help
EOF
    exit 0
}

while [[ $# -gt 0 ]]; do
    case "$1" in
        --dataset)     DATASET="$2"; shift 2 ;;
        --model)       MODEL="$2"; shift 2 ;;
        --provider)    PROVIDER="$2"; shift 2 ;;
        --preset)      PRESET="$2"; shift 2 ;;
        --parallel)    PARALLEL="$2"; shift 2 ;;
        --timeout)     TIMEOUT="$2"; shift 2 ;;
        --max-tasks)   MAX_TASKS="$2"; shift 2 ;;
        --output-dir)  OUTPUT_DIR="$2"; shift 2 ;;
        --no-docker)   NO_DOCKER=true; shift ;;
        --mythos-binary) MYTHOS_BINARY="$2"; shift 2 ;;
        --container)   USE_CONTAINER=true; shift ;;
        --help)        usage ;;
        *)             echo "Unknown option: $1"; usage ;;
    esac
done

echo "=== Mythos Patriarch SWE-bench Evaluation ==="
echo ""

if [ "$USE_CONTAINER" = true ]; then
    echo "Building Docker image..."
    docker build -t mythos-swebench -f "$SCRIPT_DIR/Dockerfile" "$PROJECT_ROOT"

    echo "Running evaluation in Docker..."
    docker run --rm \
        -v "$OUTPUT_DIR:/eval/results" \
        mythos-swebench \
        --dataset "$DATASET" \
        ${MODEL:+--model "$MODEL"} \
        ${PROVIDER:+--provider "$PROVIDER"} \
        ${PRESET:+--preset "$PRESET"} \
        --concurrency "$PARALLEL" \
        --timeout "$TIMEOUT" \
        ${MAX_TASKS:+--max-tasks "$MAX_TASKS"} \
        --output-dir /eval/results \
        ${NO_DOCKER:+--no-docker}
else
    echo "Running evaluation locally..."
    ARGS=(
        --dataset "$DATASET"
        --concurrency "$PARALLEL"
        --timeout "$TIMEOUT"
        --output-dir "$OUTPUT_DIR"
        --mythos-binary "$MYTHOS_BINARY"
    )

    [ -n "$MODEL" ] && ARGS+=(--model "$MODEL")
    [ -n "$PROVIDER" ] && ARGS+=(--provider "$PROVIDER")
    [ -n "$PRESET" ] && ARGS+=(--preset "$PRESET")
    [ "$MAX_TASKS" -gt 0 ] && ARGS+=(--max-tasks "$MAX_TASKS")
    [ "$NO_DOCKER" = true ] && ARGS+=(--no-docker)

    bun run "$SCRIPT_DIR/runner.ts" "${ARGS[@]}"
fi

echo ""
echo "Evaluation complete. Results in: $OUTPUT_DIR"
