import MonacoEditor from '@monaco-editor/react'
import React, { useEffect, useRef } from 'react'
import type { OpenFile } from './App'

interface EditorAreaProps {
	file: OpenFile | null
	onChange: (value: string | undefined) => void
	onSave: () => void
}

export default function EditorArea({ file, onChange, onSave }: EditorAreaProps) {
	const editorRef = useRef<unknown>(null)

	// Attach Ctrl+S save shortcut inside Monaco
	const handleEditorMount = (editor: unknown) => {
		editorRef.current = editor
		const e = editor as {
			addCommand: (key: number, handler: () => void) => void
		}
		// Monaco KeyMod.CtrlCmd | KeyCode.KeyS = 2048 | 49 = 2097 (platform-aware)
		const KeyMod_CtrlCmd = 1 << 11 // 2048
		const KeyCode_KeyS = 49
		e.addCommand(KeyMod_CtrlCmd | KeyCode_KeyS, onSave)
	}

	// Update editor command when onSave changes (active tab changes)
	useEffect(() => {
		const e = editorRef.current as {
			addCommand?: (key: number, handler: () => void) => void
		} | null
		if (e?.addCommand) {
			const KeyMod_CtrlCmd = 1 << 11
			const KeyCode_KeyS = 49
			e.addCommand(KeyMod_CtrlCmd | KeyCode_KeyS, onSave)
		}
	}, [onSave])

	if (!file) {
		return (
			<div className="editor-area">
				<div className="editor-welcome">
					<div className="editor-welcome-logo">olympuz</div>
					<h2>AI-First Code Editor</h2>
					<p className="editor-welcome-hint">Open a file to start editing</p>
					<div className="editor-welcome-shortcuts">
						<div className="shortcut-row">
							<kbd className="kbd">Ctrl+O</kbd>
							<span>Open folder</span>
						</div>
						<div className="shortcut-row">
							<kbd className="kbd">Ctrl+S</kbd>
							<span>Save file</span>
						</div>
					</div>
				</div>
			</div>
		)
	}

	const language = getLanguage(file.name)

	return (
		<div className="editor-area" id="editor-container">
			<MonacoEditor
				key={file.path}
				height="100%"
				language={language}
				value={file.content}
				theme="vs-dark"
				onChange={onChange}
				onMount={handleEditorMount}
				options={{
					fontSize: 13,
					fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
					fontLigatures: true,
					minimap: { enabled: true, scale: 1 },
					scrollBeyondLastLine: false,
					smoothScrolling: true,
					cursorBlinking: 'smooth',
					cursorSmoothCaretAnimation: 'on',
					lineNumbers: 'on',
					renderWhitespace: 'selection',
					bracketPairColorization: { enabled: true },
					guides: { bracketPairs: true },
					padding: { top: 8, bottom: 8 },
					automaticLayout: true,
					tabSize: 2,
					wordWrap: 'off',
					suggest: { showStatusBar: true },
					inlineSuggest: { enabled: true },
				}}
			/>
		</div>
	)
}

function getLanguage(filename: string): string {
	const ext = filename.split('.').pop()?.toLowerCase() ?? ''
	const map: Record<string, string> = {
		ts: 'typescript',
		tsx: 'typescript',
		js: 'javascript',
		jsx: 'javascript',
		json: 'json',
		jsonc: 'jsonc',
		css: 'css',
		scss: 'scss',
		less: 'less',
		html: 'html',
		htm: 'html',
		md: 'markdown',
		mdx: 'mdx',
		py: 'python',
		rs: 'rust',
		go: 'go',
		java: 'java',
		c: 'c',
		cpp: 'cpp',
		h: 'c',
		sh: 'shell',
		bash: 'shell',
		yaml: 'yaml',
		yml: 'yaml',
		toml: 'toml',
		xml: 'xml',
		sql: 'sql',
		graphql: 'graphql',
		gql: 'graphql',
	}
	return map[ext] ?? 'plaintext'
}
