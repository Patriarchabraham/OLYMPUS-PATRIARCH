# Contributing to Olympuz Coder

Thanks for contributing to Olympuz Coder — the open-source, multi-provider AI coding agent with quantum-inspired reasoning.

## Before You Start

- Search [existing issues](https://github.com/Gitlawb/Olympuz Coder/issues) and [discussions](https://github.com/Gitlawb/Olympuz Coder/discussions) before opening a new thread
- Use **issues** for confirmed bugs and actionable feature work
- Use **discussions** for setup help, ideas, and general conversation
- For larger changes, open an issue first so scope is clear before implementation
- For security reports, follow [SECURITY.md](SECURITY.md)

## Development Setup

### Prerequisites

- [Bun](https://bun.sh) runtime
- Node.js 18+ (for some tooling)
- Git

### Install and Build

```bash
git clone https://github.com/Gitlawb/Olympuz Coder.git
cd "Olympuz Coder"
bun install
bun run build
```

### Run Locally

```bash
bun run dev
```

### Useful Commands

| Command | Purpose |
|---------|---------|
| `bun run build` | Build the project |
| `bun test` | Run all tests (2459 tests across 247 files) |
| `bun test path/to/file.test.ts` | Run focused tests |
| `bun run smoke` | Smoke test the build |
| `bun run typecheck` | TypeScript type checking |
| `npx biome check src/` | Lint and format check |
| `bun run doctor:runtime` | Runtime diagnostics |

## Code Standards

### TypeScript

- **Strict mode** — zero `any` types allowed
- **JSDoc** on all public functions
- **No unused variables** — clean imports only
- **Error handling** — graceful degradation with meaningful messages

### Module Standards

Olympuz follows the "tudo deve ser real" principle — every module must implement its claimed capability with real algorithms:

- No keyword counting dressed as intelligence
- No `Math.random()` dressed as reasoning
- No hardcoded placeholder text as default output
- If it claims quantum → real quantum math
- If it claims meta-cognition → real NLP analysis
- If it claims evolution → real genetic algorithms

### Testing

- Tests required for new modules
- Use Bun's built-in test runner (`bun test`)
- Follow existing test patterns in `src/__tests__/`
- Include both unit tests and integration tests where appropriate

### Style

- Follow existing patterns in the codebase
- Use Biome for formatting — `npx biome check src/`
- Keep changes focused — one problem per PR
- Preserve existing repo patterns unless intentionally refactoring

## Pull Request Process

1. **Open an issue first** for any non-trivial change
2. **Create a feature branch** from `main`
3. **Make focused changes** — one problem or feature per PR
4. **Run validation:**

```bash
bun run build
bun test
npx biome check src/
```

5. **Write a clear PR description:**
   - What changed and why
   - User/developer impact
   - Which checks you ran
   - Which provider/model path was tested (if applicable)

6. **Screenshots** for UI/terminal/presentation changes
7. **Provider-specific testing** — if changing provider logic, test the exact provider/model path

## Commit Messages

Follow conventional commit format:

```
feat: add quantum tunneling for barrier bypass
fix: resolve proc.stdin null check in voiceInterface
docs: update README with comparison table
style: biome lint fixes for documentParser
refactor: extract common reasoning patterns
test: add quantum circuit simulator tests
chore: update dependencies
```

## Provider Changes

If you change provider logic:

- Be explicit about which providers are affected
- Avoid breaking third-party providers while fixing first-party behavior
- Test the exact provider/model path you changed
- Document limitations or follow-up work in the PR description
- Reference `docs/integrations/` for descriptor-era integrations

## Architecture Overview

```
src/
  cli/              — Terminal UI, command parsing, transports
  reasoning/        — CoT, ToT, Self-Reflection, Quantum, Ensemble
  cortex/           — Meta-cognition, cross-model verification
  quantum/          — Quantum circuit simulator
  autonomous/       — Goal manager, task runner
  swarm/            — Multi-agent orchestration
  knowledge/        — RAG engine, vector store
  evolution/        — Prompt evolution, pattern learning
  multimodal/       — Vision, STT, TTS, document parsing
  deviceBridge/     — Device scanning
  nativeCore/       — PowerShell bridge
```

## Community Guidelines

- Be respectful and constructive
- Focus on the code, not the person
- Maintainers may ask for narrower scope, follow-up PRs, or stronger validation
- That is normal and helps keep the project reviewable as it grows

## License

By contributing, you agree that your contributions will be licensed under the project's license (see [LICENSE](LICENSE)).
