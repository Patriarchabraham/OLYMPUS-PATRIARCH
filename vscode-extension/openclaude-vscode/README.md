# Mythos Patriarch VS Code Extension

A practical VS Code companion for Mythos Patriarch with a project-aware **Control Center**, predictable terminal launch behavior, and quick access to useful Mythos Patriarch workflows.

## Features

- **Real Control Center status** in the Activity Bar:
  - whether the configured `Mythos Patriarch` command is installed
  - the launch command being used
  - whether the launch shim injects `CLAUDE_CODE_USE_OPENAI=1`
  - the current workspace folder
  - the launch cwd that will be used for terminal sessions
  - whether `.Mythos Patriarch-profile.json` exists in the current workspace root
  - a conservative provider summary derived from the workspace profile or known environment flags
- **Project-aware launch behavior**:
  - `Launch Mythos Patriarch` launches from the active editor's workspace when possible
  - falls back to the first workspace folder when needed
  - avoids launching from an arbitrary default cwd when a project is open
- **Practical sidebar actions**:
  - Launch Mythos Patriarch
  - Launch in Workspace Root
  - Open Workspace Profile
  - Open Repository
  - Open Setup Guide
  - Open Command Palette
- **Built-in dark theme**: `Mythos Patriarch Terminal Black`

## Requirements

- VS Code `1.95+`
- `Mythos Patriarch` available in your terminal PATH (`npm install -g @gitlawb/Mythos Patriarch`)

## Commands

- `Mythos Patriarch: Open Control Center`
- `Mythos Patriarch: Launch in Terminal`
- `Mythos Patriarch: Launch in Workspace Root`
- `Mythos Patriarch: Open Repository`
- `Mythos Patriarch: Open Setup Guide`
- `Mythos Patriarch: Open Workspace Profile`

## Settings

- `Mythos Patriarch.launchCommand` (default: `Mythos Patriarch`)
- `Mythos Patriarch.terminalName` (default: `Mythos Patriarch`)
- `Mythos Patriarch.useOpenAIShim` (default: `false`)

`Mythos Patriarch.useOpenAIShim` only injects `CLAUDE_CODE_USE_OPENAI=1` into terminals launched by the extension. It does not guess or configure a provider by itself.

## Notes on Status Detection

- Provider status prefers the real workspace `.Mythos Patriarch-profile.json` file when present.
- If no saved profile exists, the extension falls back to known environment flags available to the VS Code extension host.
- If the source of truth is unclear, the extension shows `unknown` instead of guessing.

## Development

From this folder:

```bash
npm run test
npm run lint
```

To package (optional):

```bash
npm run package
```

