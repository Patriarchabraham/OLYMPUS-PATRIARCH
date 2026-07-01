import React, { useCallback, useEffect, useState } from 'react'

const olympuz = window.olympuz

export interface DirEntry {
	name: string
	path: string
	isDirectory: boolean
	size: number
	mtime: number
}

interface TreeNode extends DirEntry {
	children?: TreeNode[]
	expanded?: boolean
}

interface SidebarProps {
	workspace: string | null
	onOpenFolder: () => void
	onOpenFile: (path: string, name: string) => void
}

export default function Sidebar({ workspace, onOpenFolder, onOpenFile }: SidebarProps) {
	const [tree, setTree] = useState<TreeNode[]>([])
	const [selected, setSelected] = useState<string | null>(null)
	const [loading, setLoading] = useState(false)

	// Load root when workspace changes
	useEffect(() => {
		if (!workspace) {
			setTree([])
			return
		}
		loadDir(workspace).then(setTree)
	}, [workspace])

	const loadDir = async (dirPath: string): Promise<TreeNode[]> => {
		try {
			const entries = (await olympuz.fs.readDir(dirPath)) as DirEntry[]
			return entries.map((e) => ({ ...e, expanded: false }))
		} catch (err) {
			console.error('[Sidebar] readDir error:', err)
			return []
		}
	}

	const toggleNode = useCallback(
		async (node: TreeNode, pathInTree: number[]) => {
			if (!node.isDirectory) {
				setSelected(node.path)
				onOpenFile(node.path, node.name)
				return
			}

			setTree((prev) => {
				const next = structuredClone(prev)
				const target = getNodeAt(next, pathInTree)
				if (!target) return prev
				target.expanded = !target.expanded
				return next
			})

			// Lazy-load children if not yet fetched
			setLoading(true)
			const children = await loadDir(node.path)
			setLoading(false)

			setTree((prev) => {
				const next = structuredClone(prev)
				const target = getNodeAt(next, pathInTree)
				if (!target) return prev
				target.children = children
				return next
			})
		},
		[onOpenFile],
	)

	return (
		<aside className="sidebar">
			<div className="sidebar-header">
				<span className="sidebar-title">Explorer</span>
				<button
					id="open-folder-btn"
					className="sidebar-btn"
					onClick={onOpenFolder}
					title="Open Folder (Ctrl+O)"
				>
					📂
				</button>
			</div>

			<div className="file-tree">
				{!workspace ? (
					<div className="tree-empty">
						<svg
							width="40"
							height="40"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="1.2"
						>
							<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
						</svg>
						<span style={{ fontSize: 12, color: 'var(--text-muted)' }}>No folder open</span>
						<button id="open-folder-empty-btn" className="open-folder-btn" onClick={onOpenFolder}>
							Open Folder
						</button>
					</div>
				) : (
					<>
						{loading && (
							<div style={{ padding: '6px 12px', fontSize: 11, color: 'var(--text-muted)' }}>
								Loading
								<span className="loading-dots" />
							</div>
						)}
						{tree.map((node, i) => (
							<TreeItem
								key={node.path}
								node={node}
								depth={0}
								path={[i]}
								selected={selected}
								onToggle={toggleNode}
							/>
						))}
					</>
				)}
			</div>
		</aside>
	)
}

function TreeItem({
	node,
	depth,
	path,
	selected,
	onToggle,
}: {
	node: TreeNode
	depth: number
	path: number[]
	selected: string | null
	onToggle: (node: TreeNode, path: number[]) => void
}) {
	return (
		<>
			<div
				className={`tree-node${selected === node.path ? ' selected' : ''}`}
				style={{ paddingLeft: `${8 + depth * 14}px` }}
				onClick={() => onToggle(node, path)}
				title={node.path}
			>
				<span className="icon">
					{node.isDirectory ? (node.expanded ? '📂' : '📁') : getFileIcon(node.name)}
				</span>
				<span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{node.name}</span>
			</div>
			{node.isDirectory &&
				node.expanded &&
				node.children?.map((child, i) => (
					<TreeItem
						key={child.path}
						node={child}
						depth={depth + 1}
						path={[...path, i]}
						selected={selected}
						onToggle={onToggle}
					/>
				))}
		</>
	)
}

function getNodeAt(tree: TreeNode[], path: number[]): TreeNode | null {
	let current: TreeNode[] = tree
	let node: TreeNode | null = null
	for (const idx of path) {
		node = current[idx] ?? null
		if (!node) return null
		current = node.children ?? []
	}
	return node
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
		yml: '⚙',
		yaml: '⚙',
		png: '🖼',
		jpg: '🖼',
		svg: '🖼',
	}
	return map[ext] ?? '📄'
}
