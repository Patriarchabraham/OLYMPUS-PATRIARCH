# Changelog

All notable changes to Olympuz Coder will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [1.1.0] - 2026-05-23

### Added — "Make Everything Real" Initiative

Zero degradation across all modules. Every claimed capability now uses real algorithms.

#### Quantum Module (NEW — 12 files)

- Real quantum circuit simulator with complex amplitudes and Born rule sampling
- `complex.ts` — Complex number arithmetic (a+bi) for quantum amplitudes
- `stateVector.ts` — N-qubit state vectors with 2^n complex amplitudes in Hilbert space
- `gates.ts` — Standard unitary gates: Hadamard, Pauli X/Y/Z, CNOT, SWAP, CZ, Rx/Ry/Rz
- `circuit.ts` — Quantum circuit builder with fluent API + preset circuits (Bell, GHZ, W, QFT)
- `measurement.ts` — Born rule sampling, shot-based histograms, projective collapse
- `superposition.ts` — Real superposition via Hadamard/Ry gates encoding confidence
- `entanglement.ts` — Real Bell states via H+CNOT, concurrence measurement, von Neumann entropy
- `collapse.ts` — Born rule projective measurement on state vectors
- `tunneling.ts` — Discrete-time quantum walks with coin qubit + position register
- `quantumEngine.ts` — Full pipeline: PERCEIVE -> SUPERPOSE -> ENTANGLE -> EVALUATE -> COLLAPSE

#### Reasoning Module (Rewritten)

- Smart template-based `defaultGenerateFn` — analyzes actual query instead of hardcoded text
- **Ensemble strategy** — Merges CoT + ToT + Self-Reflection with weighted scoring and deduplication
- **Quantum strategy** — Full QuantumEngine pipeline (not just alias to CoT)
- `generateFnFactory.ts` — Provider-aware factory that wires to real LLM with template fallback

#### Multimodal Module (Rewritten)

- **STT** — Real audio capture via ffmpeg/sox/PowerShell SAPI (no more placeholder messages)
- **TTS Windows** — PowerShell SAPI fallback (`System.Speech.SpeechSynthesizer`)
- **Language detection** — 8 languages via Unicode script analysis + word frequency profiles (en, pt, es, fr, de, it, nl, ru)
- **Image comparison** — Perceptual hash (dHash) with Hamming distance + 64-bin color histogram
- **DOCX parsing** — ZIP extraction + XML parsing for paragraphs, tables, core properties
- **XLSX parsing** — ZIP extraction + shared strings + cell reference decoding + type-aware output

#### Evolution Module (Rewritten)

- **Critical bug fix** — `promptEvolver.ts` line 169 `return evolved` -> `return evolvedPromptText`
- **Auto-evolution** — Underperforming prompt sections evolve automatically (success rate < 0.4 threshold)
- **Time decay** — Exponential weighting with 7-day half-life for interaction records and patterns
- **CortexEngine persistence** — State saved to `cortex/state.json` (strategy effectiveness, confidence averages)
- **Cross-module data flow** — Cortex meta-cognition insights feed into evolution fitness function
- **Staleness detection** — `getStalenessReport()` tracks prompt freshness per section
- **Provider-aware verification** — `callVerificationModel()` routes to real LLM when available

#### Cortex Module (Rewritten)

- **metaCognition.ts** — Flesch-Kincaid readability, Shannon entropy, TF-IDF domain classification (8 domains)
- **crossModelVerifier.ts** — NLI contradiction detection, cosine similarity, coherence scoring
- **Self-hosted runner** — HTTP job server with queue, process execution, streaming output

### Changed

- Reasoning strategies produce query-aware output even without LLM connection
- Prompt evolution runs on a 30-interaction cycle with automatic section identification
- Interaction records include cortex analysis metadata (complexity, domain, confidence)
- Pattern matching weights recent interactions exponentially higher

### Technical

- Build passes with 0 TypeScript errors
- 2065 tests passing, 0 new regressions
- Biome lint clean across all changed files
- 29 files changed, +5132/-262 lines

## [1.0.0] - 2026-05-21

### Added

- Zero TypeScript errors initiative — resolved 1850->0 errors
- Root cause fix: global.d.ts shadowing @types/react
- 4 parallel agents fixed all errors across 100+ files

## [0.10.0] - 2026-05-11

### Added

- Startup logo palette picker
- Honor --model flag without requiring --provider
- Incremental and cached token counting
- Local Orama persistence (feature-flagged)
- First-class Brave adapter for web search

### Fixed

- Agent subagent completion wait
- Nested heredoc security hardening
- Plugin component path validation

## [0.9.0] - 2026-05-05

### Added

- Context partitioning and relevance-based pruning
- SDK Runtime — Query Engine, Sessions, and Build Pipeline
- Self-hosted Firecrawl support via FIRECRAWL_API_URL

## [0.8.0] - 2026-05-02

### Added

- Opus 4.7 as default model
- Streaming token counter
- LSP code intelligence setup
- SDK Foundation — Type Declarations, Errors, and Utilities

## [0.7.0] - 2026-04-26

### Added

- Model-specific tokenizers and compression ratio detection
- xAI as official provider
- Persistent project-level Knowledge Graph and RAG
- Hook Chains runtime integration

## [0.6.0] - 2026-04-22

### Added

- Smart model routing primitive (cheap-for-simple, strong-for-hard)
- Zero-config provider autodetection
- Thinking token extraction

## [0.5.0] - 2026-04-20

### Added

- Docker image build and push to GHCR
- Monitor tool for streaming shell output
- /loop command with fixed and dynamic scheduling

## [0.4.0] - 2026-04-17

### Added

- Alibaba Coding Plan (DashScope) provider support
- NVIDIA NIM and MiniMax provider support
- Full chat interface in VS Code extension

## [0.3.0] - 2026-04-14

### Added

- Coordinator mode
- Local team memory
- Message actions
- Allow bypass permissions mode setting

## [0.2.0] - 2026-04-12

### Added

- Gemini support with thought_signature fix
- Headless gRPC server for external agent integration
- Auto-fix service — auto-lint and test after AI file edits
- /cache-probe diagnostic command

## [0.1.0] - 2026-04-10

### Added

- Initial release of Olympuz Coder
- Multi-provider LLM support
- Terminal-first REPL interface
- MCP (Model Context Protocol) support
- Web search with DuckDuckGo fallback
- Provider profiles and saved configurations

[1.1.0]: https://github.com/Gitlawb/Olympuz Coder/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/Gitlawb/Olympuz Coder/compare/v0.10.0...v1.0.0
[0.10.0]: https://github.com/Gitlawb/Olympuz Coder/compare/v0.9.2...v0.10.0
[0.9.0]: https://github.com/Gitlawb/Olympuz Coder/compare/v0.8.0...v0.9.0
[0.8.0]: https://github.com/Gitlawb/Olympuz Coder/compare/v0.7.0...v0.8.0
[0.7.0]: https://github.com/Gitlawb/Olympuz Coder/compare/v0.6.0...v0.7.0
[0.6.0]: https://github.com/Gitlawb/Olympuz Coder/compare/v0.5.2...v0.6.0
[0.5.0]: https://github.com/Gitlawb/Olympuz Coder/compare/v0.4.0...v0.5.0
[0.4.0]: https://github.com/Gitlawb/Olympuz Coder/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/Gitlawb/Olympuz Coder/compare/v0.2.3...v0.3.0
[0.2.0]: https://github.com/Gitlawb/Olympuz Coder/compare/v0.1.8...v0.2.0
[0.1.0]: https://github.com/Gitlawb/Olympuz Coder/releases/tag/v0.1.0
