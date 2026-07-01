import React from 'react'
import type { AiStatus, OpenFile } from './App'

interface StatusBarProps {
	workspace: string | null
	activeFile: OpenFile | null
	aiStatus: AiStatus
}

export default function StatusBar({ workspace, activeFile, aiStatus }: StatusBarProps) {
	const wsLabel = workspace ? (workspace.split(/[\\/]/).pop() ?? workspace) : 'No folder'

	const fileLabel = activeFile ? activeFile.name + (activeFile.modified ? ' ●' : '') : ''

	const langLabel = activeFile ? getLang(activeFile.name) : ''

	const statusLabel =
		aiStatus === 'running' ? 'AI running…' : aiStatus === 'error' ? 'AI error' : 'Ready'

	return (
		<div className="statusbar" id="statusbar">
			<div className="statusbar-item">
				<span>📁</span>
				<span>{wsLabel}</span>
			</div>

			{fileLabel && (
				<div className="statusbar-item">
					<span>│</span>
					<span>{fileLabel}</span>
				</div>
			)}

			<div className="statusbar-item right">
				{langLabel && <span style={{ marginRight: 12, opacity: 0.75 }}>{langLabel}</span>}
				<span
					className={`status-dot${aiStatus === 'running' ? ' running' : aiStatus === 'error' ? ' error' : ''}`}
				/>
				<span>{statusLabel}</span>
			</div>
		</div>
	)
}

function getLang(name: string): string {
	const ext = name.split('.').pop()?.toLowerCase() ?? ''
	const map: Record<string, string> = {
		ts: 'TypeScript',
		tsx: 'TypeScript JSX',
		js: 'JavaScript',
		jsx: 'JavaScript JSX',
		json: 'JSON',
		css: 'CSS',
		scss: 'SCSS',
		html: 'HTML',
		md: 'Markdown',
		py: 'Python',
		rs: 'Rust',
		go: 'Go',
		java: 'Java',
		sh: 'Shell',
		yml: 'YAML',
		yaml: 'YAML',
	}
	return map[ext] ?? ext.toUpperCase()
}
