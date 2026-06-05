<p align="center">
  <img src="https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Runtime-Bun-000000?logo=bun&logoColor=white" alt="Bun" />
  <img src="https://img.shields.io/badge/License-MIT-green" alt="License" />
  <img src="https://img.shields.io/badge/Providers-10%2B-orange" alt="10+ Providers" />
  <img src="https://img.shields.io/badge/Zero_Telemetry-100%25-success" alt="Zero Telemetry" />
  <img src="https://img.shields.io/badge/Quantum_Simulator-12_files-blueviolet" alt="Quantum" />
</p>

<h1 align="center">Olympuz Coder</h1>

<p align="center"><strong>Quantum Supreme AI Coding Agent</strong></p>

<p align="center">
  Open-source, multi-provider AI coding agent with quantum-inspired reasoning,<br/>
  autonomous intelligence, and zero telemetry.
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> &bull;
  <a href="#features">Features</a> &bull;
  <a href="#comparison">Comparison</a> &bull;
  <a href="#architecture">Architecture</a> &bull;
  <a href="#install">Install</a> &bull;
  <a href="#usage">Usage</a>
</p>

---

## Why Olympuz Coder

- **One CLI, any provider** — Anthropic, OpenAI, Gemini, DeepSeek, Ollama, Bedrock, Vertex, Codex, and more
- **Quantum-inspired reasoning** — Real quantum circuit simulator (complex amplitudes, Born rule, Bell states)
- **Zero degradation** — Every module uses real algorithms, no hardcoded stubs or placeholder text
- **Zero telemetry** — No data collection, no tracking, no analytics. Your code stays yours
- **Autonomous evolution** — Prompts evolve via genetic algorithms, patterns learn from interactions
- **Multi-dimensional analysis** — Security, performance, architecture, UX, design, business, accessibility

## Quick Start

```bash
# Install globally
npm install -g olympuz-coder

# Start (first run launches provider setup)
olympuz

# Or set up a specific provider
export CLAUDE_CODE_USE_OPENAI=1
export OPENAI_API_KEY=sk-your-key-here
olympuz
```

Inside Olympuz:

- `/provider` — guided provider setup with saved profiles
- `/onboard-github` — GitHub Models onboarding

## Features

### Multi-Provider LLM Support

| Provider | Setup | Notes |
|----------|-------|-------|
| OpenAI-compatible | `/provider` or env vars | OpenAI, OpenRouter, DeepSeek, Groq, Mistral, LM Studio |
| Anthropic Claude | `/provider` | Native Anthropic SDK |
| Gemini | `/provider` or env vars | API key support |
| GitHub Models | `/onboard-github` | Interactive onboarding |
| Codex OAuth | `/provider` | Browser sign-in flow |
| Ollama | `/provider`, env vars, or `ollama launch` | Local inference, zero config |
| Bedrock / Vertex / Foundry | env vars | Enterprise cloud deployments |
| Atomic Chat | `/provider` or env vars | Local model provider |
| xAI Grok | env vars | Grok API support |
| Alibaba DashScope | `/provider` | DashScope provider |

### Quantum Reasoning Engine

Real quantum circuit simulator with 12 modules implementing actual quantum mechanics:

- **Superposition** — Evaluate multiple solution states simultaneously across dimensions
- **Entanglement** — Cross-reference patterns across projects/dimensions via Bell states (H+CNOT)
- **Collapse** — Born rule projective measurement to converge on optimal solutions
- **Tunneling** — Quantum walks with coin qubit + position register to bypass barriers

Pipeline: `PERCEIVE -> SUPERPOSE -> ENTANGLE -> EVALUATE -> COLLAPSE`

### Reasoning Strategies

| Strategy | Description |
|----------|-------------|
| **Chain of Thought** | Structured step-by-step reasoning with template-based analysis |
| **Tree of Thought** | Branch generation, evaluation scoring, pruning (threshold 0.4), best-path expansion |
| **Self-Reflection** | Multi-iteration critique loop with convergence check (threshold 0.9) |
| **Ensemble** | Merges CoT + ToT + Self-Reflection with weighted scoring and deduplication |
| **Quantum** | Full QuantumEngine pipeline — real quantum math, not keyword matching |
| **Auto** | Keyword-based heuristic auto-selects optimal strategy per query |

### Meta-Cognition & Verification

- **Flesch-Kincaid readability** scoring
- **Shannon entropy** of word distribution
- **TF-IDF domain classification** across 8 domains
- **NLI contradiction detection** with cosine similarity
- **Cross-model verification** — primary vs. verification model output comparison
- **Zero-trust pipeline** — every output passes adversarial verification

### Autonomous Evolution

- **Genetic algorithm prompt evolution** — population, crossover, mutation, tournament selection
- **Time-decay pattern weighting** — 7-day half-life, recent interactions matter more
- **Auto-evolution trigger** — underperforming prompt sections evolve automatically
- **Effectiveness tracking** — per-strategy success rates, per-tool performance, trend analysis
- **Staleness detection** — freshness scoring with configurable thresholds

### Swarm Intelligence

- Multi-agent orchestration with topological sort
- Weighted consensus across agents
- Task distribution and error recovery
- Parallel agent execution

### Multimodal

- **Vision** — Image analysis with perceptual hash (dHash) comparison + provider vision
- **STT** — Real audio capture via ffmpeg/sox/PowerShell SAPI
- **TTS** — Cross-platform including Windows SAPI fallback
- **Language detection** — 8 languages via Unicode + word frequency analysis
- **DOCX/XLSX** — Native ZIP+XML parsing (zero dependencies)
- **Code visualization** — Mermaid flowcharts, sequence diagrams, class diagrams

### System Integration

- **Device Bridge** — arp-a, adb, SSH device scanning
- **Native Core** — Persistent PowerShell bridge with WMI queries, LRU cache
- **OOM Prevention** — 4-layer heap protection (4GB/8GB floor)
- **RAG Engine** — Vector store, semantic search, knowledge graph, OpenAI/Ollama embeddings

## Comparison

| Feature | Olympuz | Claude Code | Gemini CLI | Grok CLI |
|---------|--------|-------------|------------|----------|
| Open Source | :white_check_mark: | :x: | :white_check_mark: | :x: |
| Multi-Provider | :white_check_mark: 10+ | :x: Anthropic only | :x: Gemini only | :x: Grok only |
| Zero Telemetry | :white_check_mark: | :x: | :x: | :x: |
| Quantum Reasoning | :white_check_mark: | :x: | :x: | :x: |
| Tree of Thought | :white_check_mark: | :x: | :x: | :x: |
| Self-Reflection | :white_check_mark: | :x: | :x: | :x: |
| Ensemble Strategy | :white_check_mark: | :x: | :x: | :x: |
| Meta-Cognition | :white_check_mark: | :x: | :x: | :x: |
| Cross-Model Verification | :white_check_mark: | :x: | :x: | :x: |
| Prompt Auto-Evolution | :white_check_mark: | :x: | :x: | :x: |
| Swarm Intelligence | :white_check_mark: | :x: | :white_check_mark: (sub-agents) | :white_check_mark: (Arena) |
| RAG / Vector Store | :white_check_mark: | :x: | :x: | :x: |
| Knowledge Graph | :white_check_mark: | :x: | :x: | :x: |
| Device Bridge | :white_check_mark: | :x: | :x: | :x: |
| OOM Prevention | :white_check_mark: | :x: | :x: | :x: |
| STT (voice input) | :white_check_mark: | :x: | :x: | :x: |
| DOCX/XLSX Parsing | :white_check_mark: | :x: | :x: | :x: |
| Code Visualization | :white_check_mark: | :x: | :x: | :x: |
| MCP Support | :white_check_mark: | :white_check_mark: | :white_check_mark: | :white_check_mark: |
| Computer Use | :x: | :white_check_mark: | :x: | :white_check_mark: (macOS) |
| IDE Integration | CLI + VS Code | VS Code + JetBrains + Web + iOS | CLI | CLI |
| Free Tier | :white_check_mark: (BYO key) | :x: ($20/mo min) | :white_check_mark: (1000 req/day) | :x: ($300/mo) |
| Context Window | Provider-dependent | 1M tokens | 1M tokens | 2M tokens |

## Architecture

```
olympuz/
  src/
    cli/              Terminal UI and command parsing
    reasoning/        CoT, ToT, Self-Reflection, Quantum, Ensemble strategies
    cortex/           Meta-cognition, decomposition, multi-pass, cross-model verification
    quantum/          Quantum circuit simulator (12 files, real quantum math)
    autonomous/       Goal manager, task runner, error recovery
    swarm/            Multi-agent orchestration, consensus, task distribution
    knowledge/        RAG engine, vector store, semantic search, embeddings
    evolution/        Pattern learning, prompt evolution, effectiveness tracking
    multimodal/       Vision, STT, TTS, document parsing, code visualization
    deviceBridge/     System-level device scanning (arp-a, adb, SSH)
    nativeCore/       PowerShell bridge, WMI queries, LRU cache
    self-hosted-runner/ HTTP job server with queue and process execution
```

| Module | Lines | Description |
|--------|-------|-------------|
| `quantum/` | ~2,500 | Real quantum circuit simulator (Hilbert space, Born rule, gates) |
| `cortex/` | ~3,000 | Meta-cognition, cross-model verification, multi-pass reasoning |
| `reasoning/` | ~1,500 | 5 reasoning strategies + auto-selector + provider factory |
| `evolution/` | ~2,500 | Genetic algorithm evolution, pattern learning, effectiveness tracking |
| `multimodal/` | ~1,100 | Vision, STT, TTS, DOCX/XLSX, code visualization |
| `autonomous/` | ~2,000 | Goal manager, task runner, checkpointing, retry escalation |
| `swarm/` | ~1,500 | Multi-agent orchestration, topological sort, weighted consensus |
| `knowledge/` | ~2,000 | RAG pipeline, OpenAI/Ollama embeddings, hybrid search |
| `deviceBridge/` | ~800 | arp-a, adb, SSH device scanning |
| `nativeCore/` | ~600 | PowerShell bridge, WMI queries |
| **Total** | **~82,500** | **2602 files across 10+ modules** |

## Install

### From npm

```bash
npm install -g olympuz-coder
```

### From Source

```bash
git clone https://github.com/Gitlawb/Olympuz Coder.git
cd "Olympuz Coder"
bun install
bun run build
node dist/cli.mjs
```

### Provider Setup

**OpenAI (fastest):**

```bash
export CLAUDE_CODE_USE_OPENAI=1
export OPENAI_API_KEY=sk-your-key-here
olympuz
```

**Ollama (local, zero cost):**

```bash
export CLAUDE_CODE_USE_OPENAI=1
export OPENAI_BASE_URL=http://localhost:11434/v1
export OPENAI_MODEL=qwen2.5-coder:7b
olympuz
```

**Guided Setup:**

Launch `olympuz` and run `/provider` for interactive setup with saved profiles.

## Usage

### CLI Commands

```bash
olympuz                          # Start interactive REPL
olympuz -p "fix the auth bug"   # One-shot prompt
olympuz --model gpt-4o           # Override model
olympuz --provider openai        # Override provider
```

### Reasoning Strategies

```bash
# Auto-select strategy (default)
> analyze this architecture for security issues

# Force specific strategy via context
> use tree of thought to evaluate 3 approaches to caching
```

### Quantum Commands

Available via AILEX skills:

- `*quantum` — Full quantum analysis across 10 dimensions
- `*tunnel` — Quantum tunneling for impossible problems
- `*collapse` — Collapse superposition to optimal solution
- `*entangle` — Cross-reference patterns across dimensions
- `*superpose` — Evaluate multiple states simultaneously

### Slash Commands

| Command | Description |
|---------|-------------|
| `/provider` | Guided provider setup and profiles |
| `/onboard-github` | GitHub Models onboarding |
| `/models` | List available models |
| `/loop` | Recurring prompt execution |
| `/help` | Show all commands |

### Agent Routing

Route different agents to different models in `~/.olympuz-coder.json`:

```json
{
  "agentModels": {
    "deepseek-v4-flash": {
      "base_url": "https://api.deepseek.com/v1",
      "api_key": "sk-your-key"
    }
  },
  "agentRouting": {
    "Explore": "deepseek-v4-flash",
    "Plan": "gpt-4o",
    "default": "gpt-4o"
  }
}
```

## Development

```bash
bun install              # Install dependencies
bun run build            # Build the project
bun test                 # Run all tests (2459 tests)
bun run dev              # Development mode
npx biome check src/     # Lint and format
```

## Sponsors

<p align="center">
  <a href="https://gitlawb.com"><strong>GitLawb</strong></a> &bull;
  <a href="https://bankr.bot"><strong>Bankr.bot</strong></a> &bull;
  <a href="https://atomic.chat/"><strong>Atomic Chat</strong></a>
</p>

## Community

- [GitHub Discussions](https://github.com/Gitlawb/Olympuz Coder/discussions) — Q&A, ideas, conversation
- [GitHub Issues](https://github.com/Gitlawb/Olympuz Coder/issues) — Bug reports, feature requests

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, code standards, and PR guidelines.

## Disclaimer

Olympuz Coder is an independent community project and is not affiliated with, endorsed by, or sponsored by Anthropic. Olympuz Coder originated from the Claude Code codebase and has since been substantially modified to support multiple providers and open use. "Claude" and "Claude Code" are trademarks of Anthropic PBC.

## License

See [LICENSE](LICENSE).
