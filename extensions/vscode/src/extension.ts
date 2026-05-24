import * as vscode from "vscode";
import { execFile } from "child_process";

/** Active Mythos terminal instance. */
let mythosTerminal: vscode.Terminal | undefined;

/** Status bar item showing the current provider. */
let statusBarItem: vscode.StatusBarItem;

/** Chat panel reference. */
let chatPanel: vscode.WebviewPanel | undefined;

/**
 * Activates the Mythos Patriarch VS Code extension.
 * Registers commands, terminal profile provider, and status bar.
 */
export function activate(context: vscode.ExtensionContext): void {
  // Status bar
  statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    50,
  );
  statusBarItem.text = "$(hubot) Mythos";
  statusBarItem.tooltip = "Mythos Patriarch — Click to switch provider";
  statusBarItem.command = "mythos.switchProvider";
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);

  // Commands
  context.subscriptions.push(
    vscode.commands.registerCommand("mythos.openTerminal", openTerminal),
    vscode.commands.registerCommand("mythos.sendPrompt", sendQuickPrompt),
    vscode.commands.registerCommand("mythos.status", showStatus),
    vscode.commands.registerCommand("mythos.openChat", openChat),
    vscode.commands.registerCommand("mythos.switchProvider", switchProvider),
  );

  // Terminal profile provider
  const terminalProvider = new MythosTerminalProfileProvider();
  context.subscriptions.push(
    vscode.window.registerTerminalProfileProvider(
      "mythos.terminal",
      terminalProvider,
    ),
  );

  // Auto-start if configured
  const config = vscode.workspace.getConfiguration("mythos");
  if (config.get<boolean>("autoStart")) {
    openTerminal();
  }

  // Detect provider on activation
  refreshStatusBar();
}

/**
 * Deactivates the extension. Cleans up resources.
 */
export function deactivate(): void {
  mythosTerminal?.dispose();
  chatPanel?.dispose();
  statusBarItem?.dispose();
}

/**
 * Opens a VS Code terminal running the Mythos CLI.
 * Reuses existing terminal if one is already open.
 */
function openTerminal(): void {
  if (mythosTerminal && !mythosTerminal.exitStatus) {
    mythosTerminal.show();
    return;
  }

  const binaryPath = getBinaryPath();
  mythosTerminal = vscode.window.createTerminal({
    name: "Mythos Patriarch",
    shellPath: binaryPath,
    iconPath: new vscode.ThemeIcon("hubot"),
  });
  mythosTerminal.show();
}

/**
 * Shows an input box for a quick prompt and sends it to Mythos.
 * Opens a terminal if one is not already active.
 */
async function sendQuickPrompt(): Promise<void> {
  const prompt = await vscode.window.showInputBox({
    prompt: "Enter a prompt for Mythos",
    placeHolder: "e.g., Refactor the authentication module",
    ignoreFocusOut: true,
  });

  if (!prompt) {
    return;
  }

  if (!mythosTerminal || mythosTerminal.exitStatus) {
    openTerminal();
    // Small delay to ensure terminal is ready
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  mythosTerminal?.sendText(prompt);
}

/**
 * Shows the current Mythos status: provider, model, version.
 */
async function showStatus(): Promise<void> {
  const binaryPath = getBinaryPath();
  let version = "unknown";
  try {
    version = await runCommand(binaryPath, ["--version"]);
  } catch {
    version = "not installed";
  }

  const config = vscode.workspace.getConfiguration("mythos");
  const provider = config.get<string>("defaultProvider") || "auto-detect";

  const message = [
    `Mythos Patriarch v${version.trim()}`,
    `Provider: ${provider}`,
    `Binary: ${binaryPath}`,
  ].join("\n");

  vscode.window.showInformationMessage(message, { modal: false });
}

/**
 * Opens the Mythos chat webview panel.
 */
function openChat(): void {
  if (chatPanel) {
    chatPanel.reveal();
    return;
  }

  chatPanel = vscode.window.createWebviewPanel(
    "mythos.chat",
    "Mythos Chat",
    vscode.ViewColumn.Beside,
    {
      enableScripts: true,
      retainContextWhenHidden: true,
    },
  );

  chatPanel.webview.html = getChatWebviewHtml();
  chatPanel.onDidDispose(() => {
    chatPanel = undefined;
  });

  // Handle messages from webview
  chatPanel.webview.onDidReceiveMessage(async (message) => {
    if (message.command === "sendPrompt") {
      // Forward to terminal
      if (!mythosTerminal || mythosTerminal.exitStatus) {
        openTerminal();
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
      mythosTerminal?.sendText(message.text);
      // Echo back to webview
      chatPanel?.webview.postMessage({
        command: "response",
        text: `Sent to Mythos terminal: ${message.text}`,
      });
    }
  });
}

/**
 * Switches the active LLM provider via quick pick.
 */
async function switchProvider(): Promise<void> {
  const providers = [
    { label: "Auto-detect", value: "" },
    { label: "Anthropic (Claude)", value: "anthropic" },
    { label: "OpenAI (GPT)", value: "openai" },
    { label: "Google (Gemini)", value: "gemini" },
    { label: "DeepSeek", value: "deepseek" },
    { label: "Ollama (Local)", value: "ollama" },
  ];

  const selected = await vscode.window.showQuickPick(
    providers.map((p) => ({ label: p.label, description: p.value })),
    { placeHolder: "Select LLM provider" },
  );

  if (!selected) {
    return;
  }

  const config = vscode.workspace.getConfiguration("mythos");
  await config.update(
    "defaultProvider",
    selected.description,
    vscode.ConfigurationTarget.Global,
  );

  refreshStatusBar();
  vscode.window.showInformationMessage(
    `Mythos: Provider switched to ${selected.label}`,
  );
}

/**
 * Refreshes the status bar text with current provider info.
 */
function refreshStatusBar(): void {
  const config = vscode.workspace.getConfiguration("mythos");
  const provider = config.get<string>("defaultProvider") || "auto";
  const label = provider === "auto" ? "Mythos" : `Mythos (${provider})`;
  statusBarItem.text = `$(hubot) ${label}`;
}

/**
 * Returns the configured binary path for the Mythos CLI.
 */
function getBinaryPath(): string {
  const config = vscode.workspace.getConfiguration("mythos");
  return config.get<string>("binaryPath") || "mythos";
}

/**
 * Executes a command and returns its stdout as a promise.
 * @param command - The command to execute
 * @param args - Arguments to pass to the command
 */
function runCommand(command: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(command, args, { timeout: 5000 }, (error, stdout) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(stdout);
    });
  });
}

/**
 * Generates the HTML for the chat webview panel.
 */
function getChatWebviewHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Mythos Chat</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: var(--vscode-font-family);
      color: var(--vscode-foreground);
      background: var(--vscode-editor-background);
      display: flex;
      flex-direction: column;
      height: 100vh;
    }
    #messages {
      flex: 1;
      overflow-y: auto;
      padding: 12px;
    }
    .msg {
      margin-bottom: 12px;
      padding: 8px 12px;
      border-radius: 8px;
      max-width: 90%;
    }
    .msg.user {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      margin-left: auto;
    }
    .msg.response {
      background: var(--vscode-input-background);
      border: 1px solid var(--vscode-input-border, transparent);
    }
    #input-area {
      display: flex;
      padding: 8px;
      gap: 8px;
      border-top: 1px solid var(--vscode-input-border, #333);
    }
    #prompt-input {
      flex: 1;
      padding: 8px 12px;
      border: 1px solid var(--vscode-input-border, #555);
      border-radius: 4px;
      background: var(--vscode-input-background);
      color: var(--vscode-foreground);
      font-family: inherit;
      font-size: 14px;
    }
    #send-btn {
      padding: 8px 16px;
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      border-radius: 4px;
      cursor: pointer;
    }
    #send-btn:hover {
      background: var(--vscode-button-hoverBackground);
    }
    .header {
      padding: 12px 16px;
      border-bottom: 1px solid var(--vscode-input-border, #333);
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .header .dot {
      width: 8px; height: 8px;
      background: #4caf50;
      border-radius: 50%;
    }
  </style>
</head>
<body>
  <div class="header">
    <span class="dot"></span>
    Mythos Patriarch — Quantum Supreme
  </div>
  <div id="messages"></div>
  <div id="input-area">
    <input id="prompt-input" placeholder="Ask Mythos anything..." autofocus />
    <button id="send-btn">Send</button>
  </div>
  <script>
    const vscode = acquireVsCodeApi();
    const messages = document.getElementById('messages');
    const input = document.getElementById('prompt-input');
    const sendBtn = document.getElementById('send-btn');

    function addMessage(text, type) {
      const div = document.createElement('div');
      div.className = 'msg ' + type;
      div.textContent = text;
      messages.appendChild(div);
      messages.scrollTop = messages.scrollHeight;
    }

    function sendPrompt() {
      const text = input.value.trim();
      if (!text) return;
      addMessage(text, 'user');
      vscode.postMessage({ command: 'sendPrompt', text: text });
      input.value = '';
    }

    sendBtn.addEventListener('click', sendPrompt);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendPrompt();
      }
    });

    window.addEventListener('message', (event) => {
      const msg = event.data;
      if (msg.command === 'response') {
        addMessage(msg.text, 'response');
      }
    });
  </script>
</body>
</html>`;
}

/**
 * Terminal profile provider that creates Mythos terminals.
 */
class MythosTerminalProfileProvider {
  /**
   * Provides a terminal profile for the Mythos CLI.
   */
  public provideTerminalProfile(): vscode.ProviderResult<vscode.TerminalProfile> {
    return new vscode.TerminalProfile({
      name: "Mythos Patriarch",
      shellPath: getBinaryPath(),
      iconPath: new vscode.ThemeIcon("hubot"),
    });
  }
}
