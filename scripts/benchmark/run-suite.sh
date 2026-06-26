#!/usr/bin/env bash
# Olympuz Coder — Universal Benchmark Runner
#
# Usage:
#   ./scripts/benchmark/run-suite.sh --suite swe-bench-verified --preset claude-opus
#   ./scripts/benchmark/run-suite.sh --suite humaneval --model gpt-4o --max-tasks 10
#   ./scripts/benchmark/run-suite.sh --list
#
# All options are forwarded to the TypeScript runner.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUNNER="$SCRIPT_DIR/core/runner.ts"

# Check for bun or node+tsx
if command -v bun &>/dev/null; then
    exec bun run "$RUNNER" "$@"
elif command -v npx &>/dev/null; then
    exec npx tsx "$RUNNER" "$@"
else
    echo "Error: bun or npx (with tsx) is required."
    exit 1
fi
