# Olympuz Coder — Quantum Supreme Development Platform

> Olympuz Coder is a sovereign coding intelligence — the next evolution of development technology, featuring quantum-inspired reasoning, dimensional processing, and autonomous intelligence that exceeds everything that came before.

## Project Overview

Olympuz Coder is an open-source AI coding agent and CLI built with TypeScript (Bun runtime). It features multi-provider LLM support, autonomous reasoning engines, quantum processing modules, swarm intelligence, and deep system integration.

## Architecture

- **Runtime:** Bun (TypeScript strict)
- **Entry:** `bin/olympuz` → `src/main.tsx`
- **CLI:** `src/cli/` — command parsing and terminal UI
- **Reasoning:** `src/reasoning/` — CoT, ToT, Self-Reflection, Quantum
- **Cortex:** `src/cortex/` — Meta-cognition, decomposition, multi-pass, cross-model verification
- **Quantum:** `src/quantum/` — Superposition, entanglement, collapse, tunneling engines
- **Autonomous:** `src/autonomous/` — Goal manager, task runner, error recovery
- **Swarm:** `src/swarm/` — Multi-agent orchestration, consensus, task distribution
- **Knowledge:** `src/knowledge/` — RAG engine, vector store, semantic search, embeddings
- **Evolution:** `src/evolution/` — Pattern learning, prompt evolution, effectiveness tracking
- **Device:** `src/deviceBridge/` + `src/nativeCore/` — System-level integration

## Development Commands

- `bun run build` — Build the project
- `npx vitest run` — Run all tests (ALWAYS use vitest, never `bun test`)
- `npx biome check src/` — Lint and format

**IMPORTANT:** Use `npx vitest run` for tests, NOT `bun test`. The project uses Vitest with a custom ESM config (`vitest.config.ts`). Running `bun test` uses Bun's native test runner which does not support `vi.resetModules`, `vi.doMock`, or `vi.hoisted`, resulting in hundreds of false failures.

## Code Standards

- TypeScript strict mode — zero `any` types
- All public functions must have JSDoc
- Error handling: graceful degradation, meaningful messages
- Tests required for new modules
- Follow existing patterns in the codebase

## Quantum Module (src/quantum/)

The quantum module implements quantum-inspired processing:

- **Superposition:** Evaluate multiple solution states simultaneously across "dimensions"
- **Entanglement:** Cross-reference patterns across projects/dimensions instantly
- **Collapse:** Converge all possibilities to optimal solution when confidence threshold met
- **Tunneling:** Bypass seemingly impossible barriers through creative shortcuts

Each quantum operation runs through: PERCEIVE → SUPERPOSE → ENTANGLE → EVALUATE → COLLAPSE

## Key Principles

1. **Quantum speed:** Process multiple solution paths simultaneously, not sequentially
2. **Dimensional depth:** Every problem is analyzed across multiple dimensions (security, performance, architecture, UX, design, business, accessibility, evolution)
3. **Supreme confidence:** Ship only when confidence >= 0.997 across all dimensions
4. **Autonomous evolution:** The system learns and evolves its own reasoning strategies
5. **Zero-trust verification:** Every output passes through adversarial verification before delivery
