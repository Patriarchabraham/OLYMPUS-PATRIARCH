# Mythos Patriarch — VS Code Extension

Quantum Supreme AI Coding Agent integration for Visual Studio Code.

## Features

- **Terminal Integration** — Launch Mythos directly in VS Code's integrated terminal
- **Quick Prompt** — Send prompts to Mythos via command palette or input box
- **Provider Switching** — Switch between Anthropic, OpenAI, Gemini, DeepSeek, and Ollama
- **Status Bar** — See current provider at a glance in the status bar
- **Chat Panel** — Side panel webview for Mythos conversations
- **Terminal Profile** — Dedicated Mythos terminal profile

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
code --install-install mythos-patriarch-0.1.0.vsix
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
| `Mythos: Open Terminal` | Opens a terminal running the Mythos CLI |
| `Mythos: Quick Prompt` | Input box to send a prompt to Mythos |
| `Mythos: Status` | Shows version, provider, and binary info |
| `Mythos: Open Chat Panel` | Opens the webview chat panel |
| `Mythos: Switch Provider` | Quick pick to change LLM provider |

## Configuration

| Setting | Default | Description |
|---------|---------|-------------|
| `mythos.binaryPath` | `mythos` | Path to the mythos CLI binary |
| `mythos.defaultProvider` | `""` (auto) | Default LLM provider |
| `mythos.autoStart` | `false` | Auto-start Mythos terminal on launch |

## Requirements

- VS Code 1.85+
- Mythos Patriarch CLI installed (`npm install -g mythos-patriarch`)

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
