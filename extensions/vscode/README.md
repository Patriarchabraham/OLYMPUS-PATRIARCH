# Olympuz Coder — VS Code Extension

Quantum Supreme AI Coding Agent integration for Visual Studio Code.

## Features

- **Terminal Integration** — Launch Olympuz directly in VS Code's integrated terminal
- **Quick Prompt** — Send prompts to Olympuz via command palette or input box
- **Provider Switching** — Switch between Anthropic, OpenAI, Gemini, DeepSeek, and Ollama
- **Status Bar** — See current provider at a glance in the status bar
- **Chat Panel** — Side panel webview for Olympuz conversations
- **Terminal Profile** — Dedicated Olympuz terminal profile

## Installation

### From VSIX
```bash
# Build the extension
cd extensions/vscode
npm install
npm run compile

# Package (requires vsce)
npx vsce package

# Install
code --install-install olympuz-coder-0.1.0.vsix
```

### From Source
```bash
cd extensions/vscode
npm install
npm run compile
# Then in VS Code: Extensions > ... > Install from VSIX
```

## Usage

| Command | Description |
|---------|-------------|
| `Olympuz: Open Terminal` | Opens a terminal running the Olympuz CLI |
| `Olympuz: Quick Prompt` | Input box to send a prompt to Olympuz |
| `Olympuz: Status` | Shows version, provider, and binary info |
| `Olympuz: Open Chat Panel` | Opens the webview chat panel |
| `Olympuz: Switch Provider` | Quick pick to change LLM provider |

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `olympuz.binaryPath` | `olympuz` | Path to the olympuz CLI binary |
| `olympuz.defaultProvider` | `""` (auto) | Default LLM provider |
| `olympuz.autoStart` | `false` | Auto-start Olympuz terminal on launch |

## Requirements

- VS Code 1.85+
- Olympuz Coder CLI installed (`npm install -g olympuz-coder`)

## Known Issues

- Chat panel currently forwards prompts to the terminal (full streaming integration planned)
- Provider detection is manual (auto-detect from CLI planned)

## Release Notes

### 0.1.0

Initial release:
- Terminal integration with dedicated profile
- Quick prompt command
- Provider switching via status bar
- Chat webview panel
- Configuration settings
