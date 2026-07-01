import React, { type KeyboardEvent, useCallback, useEffect, useRef, useState } from 'react'
import type { AiStatus, ChatMessage } from './App'

const olympuz = window.olympuz

interface TerminalPanelProps {
	workspace: string | null
	chatMessages: ChatMessage[]
	aiStatus: AiStatus
	onPrompt: (msg: string) => void
	onAbort: () => void
}

type PanelTab = 'terminal' | 'ai'

export default function TerminalPanel({
	workspace,
	chatMessages,
	aiStatus,
	onPrompt,
	onAbort,
}: TerminalPanelProps) {
	const [activeTab, setActiveTab] = useState<PanelTab>('terminal')
	const [chatInput, setChatInput] = useState('')
	const terminalContainerRef = useRef<HTMLDivElement>(null)
	const xtermRef = useRef<unknown>(null)
	const fitAddonRef = useRef<unknown>(null)
	const chatBottomRef = useRef<HTMLDivElement>(null)
	const terminalSpawned = useRef(false)

	// ── Initialize xterm ────────────────────────────────────────
	useEffect(() => {
		let term: unknown = null
		let fitAddon: unknown = null
		let unsubData: (() => void) | null = null
		let unsubExit: (() => void) | null = null

		const initTerminal = async () => {
			if (!terminalContainerRef.current) return

			try {
				const [{ Terminal }, { FitAddon }] = await Promise.all([
					import('@xterm/xterm'),
					import('@xterm/addon-fit'),
				])

				const t = new Terminal({
					theme: {
						background: '#0a0e14',
						foreground: '#e6edf3',
						cursor: '#58a6ff',
						cursorAccent: '#0a0e14',
						selectionBackground: 'rgba(88,166,255,0.25)',
						black: '#0d1117',
						red: '#f85149',
						green: '#3fb950',
						yellow: '#d29922',
						blue: '#58a6ff',
						magenta: '#bc8cff',
						cyan: '#39c5cf',
						white: '#e6edf3',
						brightBlack: '#484f58',
						brightRed: '#ff7b72',
						brightGreen: '#56d364',
						brightYellow: '#e3b341',
						brightBlue: '#79c0ff',
						brightMagenta: '#d2a8ff',
						brightCyan: '#56d4dd',
						brightWhite: '#f0f6fc',
					},
					fontFamily: "'JetBrains Mono', 'Cascadia Code', monospace",
					fontSize: 13,
					lineHeight: 1.4,
					cursorBlink: true,
					cursorStyle: 'block',
					scrollback: 5000,
					allowTransparency: true,
				})

				const fa = new FitAddon()
				t.loadAddon(fa)
				t.open(terminalContainerRef.current)
				fa.fit()

				term = t
				fitAddon = fa
				xtermRef.current = t
				fitAddonRef.current = fa

				// Pipe key input to main process
				t.onData((data: string) => {
					olympuz.terminal.input(data)
				})

				// Pipe resize to main process
				t.onResize(({ cols, rows }: { cols: number; rows: number }) => {
					olympuz.terminal.resize(cols, rows)
				})

				// Receive data from main process
				unsubData = olympuz.terminal.onData((data: string) => {
					t.write(data)
				})

				// Terminal exit
				unsubExit = olympuz.terminal.onExit((code: number | null) => {
					t.writeln(`\r\n\x1b[33m[Process exited with code ${code}]\x1b[0m`)
					terminalSpawned.current = false
				})

				// Spawn shell
				const cwd = workspace ?? process.cwd?.() ?? '.'
				await olympuz.terminal.spawn(cwd)
				terminalSpawned.current = true
			} catch (err) {
				console.error('[TerminalPanel] init error:', err)
			}
		}

		initTerminal()

		// ResizeObserver to keep terminal fitted
		let observer: ResizeObserver | null = null
		if (terminalContainerRef.current) {
			observer = new ResizeObserver(() => {
				const fa = fitAddonRef.current as { fit?: () => void } | null
				fa?.fit?.()
			})
			observer.observe(terminalContainerRef.current)
		}

		return () => {
			observer?.disconnect()
			unsubData?.()
			unsubExit?.()
			olympuz.terminal.kill()
			const t = term as { dispose?: () => void } | null
			t?.dispose?.()
			xtermRef.current = null
			fitAddonRef.current = null
			terminalSpawned.current = false
		}
	}, []) // run once on mount

	// Re-spawn terminal when workspace changes
	useEffect(() => {
		if (!workspace || !terminalSpawned.current) return
		olympuz.terminal.kill()
		olympuz.terminal.spawn(workspace)
	}, [workspace])

	// Scroll chat to bottom when new messages arrive
	useEffect(() => {
		chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
	}, [chatMessages])

	// Focus terminal when switching to tab
	useEffect(() => {
		if (activeTab === 'terminal') {
			const t = xtermRef.current as { focus?: () => void } | null
			setTimeout(() => t?.focus?.(), 50)
		}
	}, [activeTab])

	const handleChatKeyDown = useCallback(
		(e: KeyboardEvent<HTMLTextAreaElement>) => {
			if (e.key === 'Enter' && !e.shiftKey) {
				e.preventDefault()
				const msg = chatInput.trim()
				if (msg && aiStatus !== 'running') {
					onPrompt(msg)
					setChatInput('')
				}
			}
		},
		[chatInput, aiStatus, onPrompt],
	)

	const handleChatSend = useCallback(() => {
		const msg = chatInput.trim()
		if (msg && aiStatus !== 'running') {
			onPrompt(msg)
			setChatInput('')
		}
	}, [chatInput, aiStatus, onPrompt])

	const handleKillTerminal = useCallback(() => {
		olympuz.terminal.kill()
		if (workspace) olympuz.terminal.spawn(workspace)
	}, [workspace])

	return (
		<div className="terminal-panel">
			{/* Panel tab bar */}
			<div className="panel-tabs">
				<button
					id="tab-terminal"
					className={`panel-tab${activeTab === 'terminal' ? ' active' : ''}`}
					onClick={() => setActiveTab('terminal')}
				>
					⬛ Terminal
				</button>
				<button
					id="tab-ai-chat"
					className={`panel-tab${activeTab === 'ai' ? ' active' : ''}`}
					onClick={() => setActiveTab('ai')}
				>
					✦ AI Chat
					{aiStatus === 'running' && (
						<span
							style={{
								width: 6,
								height: 6,
								borderRadius: '50%',
								background: 'var(--yellow)',
								display: 'inline-block',
								marginLeft: 4,
							}}
						/>
					)}
				</button>

				<div className="panel-actions">
					{activeTab === 'terminal' && (
						<button
							id="kill-terminal-btn"
							className="panel-action-btn"
							title="Kill & restart terminal"
							onClick={handleKillTerminal}
						>
							↺
						</button>
					)}
					{activeTab === 'ai' && aiStatus === 'running' && (
						<button
							id="abort-ai-btn"
							className="panel-action-btn"
							title="Abort AI"
							onClick={onAbort}
							style={{ color: 'var(--red)' }}
						>
							⏹
						</button>
					)}
				</div>
			</div>

			{/* Terminal xterm */}
			<div
				className="terminal-container"
				style={{ display: activeTab === 'terminal' ? 'block' : 'none', flex: 1 }}
				ref={terminalContainerRef}
				id="xterm-container"
			/>

			{/* AI Chat */}
			{activeTab === 'ai' && (
				<div className="ai-chat">
					<div className="chat-messages" id="chat-messages">
						{chatMessages.length === 0 && (
							<div
								style={{
									color: 'var(--text-muted)',
									fontSize: 12,
									textAlign: 'center',
									marginTop: 16,
								}}
							>
								Ask Olympuz anything about your code…
							</div>
						)}
						{chatMessages.map((msg) => (
							<div key={msg.id} className="chat-msg">
								<div className={`chat-msg-avatar ${msg.role}`}>
									{msg.role === 'user' ? 'U' : '✦'}
								</div>
								<pre className={`chat-msg-body ${msg.role}`}>{msg.text}</pre>
							</div>
						))}
						{aiStatus === 'running' && chatMessages[chatMessages.length - 1]?.role !== 'ai' && (
							<div className="chat-msg">
								<div className="chat-msg-avatar ai">✦</div>
								<span className="chat-msg-body" style={{ color: 'var(--text-muted)' }}>
									Thinking
									<span className="loading-dots" />
								</span>
							</div>
						)}
						<div ref={chatBottomRef} />
					</div>

					<div className="chat-input-row">
						<textarea
							id="chat-input"
							className="chat-input"
							placeholder="Ask AI… (Enter to send, Shift+Enter for newline)"
							value={chatInput}
							onChange={(e) => setChatInput(e.target.value)}
							onKeyDown={handleChatKeyDown}
							rows={1}
							disabled={aiStatus === 'running'}
						/>
						<button
							id="chat-send-btn"
							className="chat-send-btn"
							onClick={handleChatSend}
							disabled={!chatInput.trim() || aiStatus === 'running'}
							title="Send (Enter)"
						>
							↑
						</button>
					</div>
				</div>
			)}
		</div>
	)
}
