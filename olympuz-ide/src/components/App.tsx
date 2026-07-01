import React, { useCallback, useEffect, useState } from 'react'
import EditorArea from './EditorArea'
import Sidebar from './Sidebar'
import StatusBar from './StatusBar'
import TerminalPanel from './TerminalPanel'

export interface OpenFile {
	path: string
	name: string
	content: string
	modified: boolean
}

export type AiStatus = 'idle' | 'running' | 'error'

export interface ChatMessage {
	id: string
	role: 'user' | 'ai'
	text: string
}

const olympuz = window.olympuz

export default function App() {
	const [workspace, setWorkspace] = useState<string | null>(null)
	const [openFiles, setOpenFiles] = useState<OpenFile[]>([])
	const [activeIdx, setActiveIdx] = useState<number>(-1)
	const [aiStatus, setAiStatus] = useState<AiStatus>('idle')
	const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
	const [sessionId, setSessionId] = useState<string | null>(null)

	// ── Listen to workspace changes from menu ──────────────────
	useEffect(() => {
		const unsub = olympuz.menu.onOpenFolder(async () => {
			await handleOpenFolder()
		})
		return unsub
	}, [])

	// ── Listen to AI status/message streams ───────────────────
	useEffect(() => {
		const unsubMsg = olympuz.ai.onMessage((msg: unknown) => {
			const m = msg as { type?: string; text?: string; content?: string }
			const text = m.text ?? m.content ?? ''
			if (!text) return
			setChatMessages((prev) => {
				// Append to last AI message if still streaming, else new bubble
				const last = prev[prev.length - 1]
				if (last?.role === 'ai' && last.id === 'streaming') {
					return [...prev.slice(0, -1), { ...last, text: last.text + text }]
				}
				return [...prev, { id: 'streaming', role: 'ai', text }]
			})
		})

		const unsubStatus = olympuz.ai.onStatus((status: string) => {
			setAiStatus(status as AiStatus)
			if (status !== 'running') {
				// Seal the streaming message with a stable id
				setChatMessages((prev) => {
					const last = prev[prev.length - 1]
					if (last?.id === 'streaming') {
						return [...prev.slice(0, -1), { ...last, id: `ai-${Date.now()}` }]
					}
					return prev
				})
			}
		})

		return () => {
			unsubMsg()
			unsubStatus()
		}
	}, [])

	// ── Listen to save shortcut ────────────────────────────────
	useEffect(() => {
		const unsub = olympuz.menu.onSave(() => {
			if (activeIdx >= 0) handleSave(activeIdx)
		})
		return unsub
	}, [activeIdx, openFiles])

	// ── Open folder ────────────────────────────────────────────
	const handleOpenFolder = useCallback(async () => {
		try {
			const path = await olympuz.fs.openFolder()
			if (path) setWorkspace(path as string)
		} catch (err) {
			console.error('[App] openFolder error:', err)
		}
	}, [])

	// ── Open file from sidebar ─────────────────────────────────
	const handleOpenFile = useCallback(
		async (filePath: string, fileName: string) => {
			// If already open, switch to it
			const existingIdx = openFiles.findIndex((f) => f.path === filePath)
			if (existingIdx >= 0) {
				setActiveIdx(existingIdx)
				return
			}
			try {
				const content = (await olympuz.fs.readFile(filePath)) as string
				setOpenFiles((prev) => {
					const next = [...prev, { path: filePath, name: fileName, content, modified: false }]
					setActiveIdx(next.length - 1)
					return next
				})
			} catch (err) {
				console.error('[App] readFile error:', err)
			}
		},
		[openFiles],
	)

	// ── Close tab ──────────────────────────────────────────────
	const handleCloseTab = useCallback((idx: number) => {
		setOpenFiles((prev) => {
			const next = [...prev]
			next.splice(idx, 1)
			setActiveIdx((old) => {
				if (old >= next.length) return next.length - 1
				if (old > idx) return old - 1
				if (old === idx) return Math.max(0, idx - 1)
				return old
			})
			return next
		})
	}, [])

	// ── Editor content change ──────────────────────────────────
	const handleEditorChange = useCallback(
		(value: string | undefined) => {
			if (activeIdx < 0) return
			setOpenFiles((prev) => {
				const next = [...prev]
				next[activeIdx] = { ...next[activeIdx], content: value ?? '', modified: true }
				return next
			})
		},
		[activeIdx],
	)

	// ── Save file ──────────────────────────────────────────────
	const handleSave = useCallback(
		async (idx: number) => {
			const file = openFiles[idx]
			if (!file || !file.modified) return
			try {
				await olympuz.fs.writeFile(file.path, file.content)
				setOpenFiles((prev) => {
					const next = [...prev]
					next[idx] = { ...next[idx], modified: false }
					return next
				})
			} catch (err) {
				console.error('[App] writeFile error:', err)
			}
		},
		[openFiles],
	)

	// ── AI prompt ─────────────────────────────────────────────
	const handleAiPrompt = useCallback(
		async (message: string) => {
			if (aiStatus === 'running') return
			setChatMessages((prev) => [
				...prev,
				{ id: `user-${Date.now()}`, role: 'user', text: message },
			])
			try {
				const sid = (await olympuz.ai.prompt({
					cwd: workspace ?? '.',
					message,
					sessionId: sessionId ?? undefined,
				})) as string
				setSessionId(sid)
			} catch (err) {
				console.error('[App] ai.prompt error:', err)
				setAiStatus('error')
			}
		},
		[aiStatus, workspace, sessionId],
	)

	const handleAiAbort = useCallback(() => {
		olympuz.ai.abort()
	}, [])

	const activeFile = activeIdx >= 0 ? openFiles[activeIdx] : null

	return (
		<div className="ide-layout">
			{/* Tab bar */}
			<div className="tab-bar">
				{openFiles.map((f, i) => (
					<div
						key={f.path}
						className={`tab-item${i === activeIdx ? ' active' : ''}`}
						onClick={() => setActiveIdx(i)}
					>
						<span className="icon">{getFileIcon(f.name)}</span>
						<span>
							{f.name}
							{f.modified ? ' ●' : ''}
						</span>
						<span
							className="tab-close"
							onClick={(e) => {
								e.stopPropagation()
								handleCloseTab(i)
							}}
							title="Close"
						>
							✕
						</span>
					</div>
				))}
			</div>

			{/* Sidebar */}
			<Sidebar workspace={workspace} onOpenFolder={handleOpenFolder} onOpenFile={handleOpenFile} />

			{/* Editor */}
			<EditorArea
				file={activeFile}
				onChange={handleEditorChange}
				onSave={() => activeIdx >= 0 && handleSave(activeIdx)}
			/>

			{/* Terminal + AI panel */}
			<TerminalPanel
				workspace={workspace}
				chatMessages={chatMessages}
				aiStatus={aiStatus}
				onPrompt={handleAiPrompt}
				onAbort={handleAiAbort}
			/>

			{/* Status bar */}
			<StatusBar workspace={workspace} activeFile={activeFile} aiStatus={aiStatus} />
		</div>
	)
}

function getFileIcon(name: string): string {
	const ext = name.split('.').pop()?.toLowerCase() ?? ''
	const map: Record<string, string> = {
		ts: '🔷',
		tsx: '⚛',
		js: '🟨',
		jsx: '⚛',
		json: '{}',
		md: '📄',
		css: '🎨',
		html: '🌐',
		py: '🐍',
		rs: '🦀',
		go: '🐹',
		java: '☕',
		sh: '⬛',
		bat: '⬛',
		cmd: '⬛',
		yml: '⚙',
		yaml: '⚙',
		png: '🖼',
		jpg: '🖼',
		svg: '🖼',
		gif: '🖼',
		txt: '📝',
		env: '🔑',
		lock: '🔒',
	}
	return map[ext] ?? '📄'
}
