import { readFile, readdir, stat } from 'fs/promises'
import { join, extname, basename, relative } from 'path'
import type { DependencyAnalysis, DependencyNode, DependencyEdge } from './types.js'

interface RawImport {
  source: string
  targets: string[]
}

async function walkDir(
  dir: string,
  extensions: string[],
  maxDepth = 10,
  depth = 0,
): Promise<string[]> {
  if (depth > maxDepth) return []
  const files: string[] = []
  try {
    const entries = await readdir(dir, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'build') continue
      const fullPath = join(dir, entry.name)
      if (entry.isDirectory()) {
        files.push(...await walkDir(fullPath, extensions, maxDepth, depth + 1))
      } else if (extensions.includes(extname(entry.name))) {
        files.push(fullPath)
      }
    }
  } catch {
    // Permission error or similar
  }
  return files
}

function extractImports(content: string, filePath: string): string[] {
  const imports: string[] = []

  // ES module imports: import ... from '...', import '...'
  const esImportRegex = /import\s+(?:[\s\S]*?\s+from\s+)?['"]([^'"]+)['"]/g
  let match: RegExpExecArray | null
  while ((match = esImportRegex.exec(content)) !== null) {
    imports.push(match[1]!)
  }

  // CommonJS: require('...')
  const requireRegex = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g
  while ((match = requireRegex.exec(content)) !== null) {
    imports.push(match[1]!)
  }

  // Python imports
  if (filePath.endsWith('.py')) {
    const pyImportRegex = /(?:from\s+(\S+)\s+)?import\s+([^\n]+)/g
    while ((match = pyImportRegex.exec(content)) !== null) {
      if (match[1]) {
        imports.push(match[1]!)
      } else if (match[2]) {
        const modules = match[2].split(',').map(m => m.trim().split(/\s+as\s+/)[0]!.trim())
        imports.push(...modules)
      }
    }
  }

  return imports
}

function resolveImportPath(
  importPath: string,
  sourceFile: string,
  allFiles: Set<string>,
): string | null {
  // Skip external packages (no ./ or ../)
  if (!importPath.startsWith('.') && !importPath.startsWith('/')) {
    return null
  }

  const dir = sourceFile.replace(/[/\\][^/\\]+$/, '')
  let resolved: string

  if (importPath.startsWith('.')) {
    // Relative import
    resolved = join(dir, importPath).replace(/\\/g, '/')
  } else {
    resolved = importPath.replace(/\\/g, '/')
  }

  // Try exact match, then with extensions
  const candidates = [
    resolved,
    resolved + '.ts',
    resolved + '.tsx',
    resolved + '.js',
    resolved + '.jsx',
    resolved + '/index.ts',
    resolved + '/index.tsx',
    resolved + '/index.js',
    resolved + '/index.jsx',
  ]

  for (const candidate of candidates) {
    if (allFiles.has(candidate)) return candidate
  }

  return null
}

export async function analyzeDependencies(codebasePath: string): Promise<DependencyAnalysis> {
  const extensions = ['.ts', '.tsx', '.js', '.jsx', '.py']
  const files = await walkDir(codebasePath, extensions)
  const fileSet = new Set(files.map(f => f.replace(/\\/g, '/')))

  const nodes: DependencyNode[] = []
  const edges: DependencyEdge[] = []
  const edgeSet = new Set<string>() // dedup

  // Build nodes
  for (const file of files) {
    const normalized = file.replace(/\\/g, '/')
    nodes.push({
      id: normalized,
      type: 'file',
      name: basename(file),
      path: relative(codebasePath, file).replace(/\\/g, '/'),
      inDegree: 0,
      outDegree: 0,
    })
  }

  const nodeMap = new Map(nodes.map(n => [n.id, n]))

  // Analyze imports for each file
  for (const file of files) {
    const normalized = file.replace(/\\/g, '/')
    try {
      const content = await readFile(file, 'utf-8')
      const rawImports = extractImports(content, file)

      for (const imp of rawImports) {
        const resolved = resolveImportPath(imp, normalized, fileSet)
        if (!resolved) continue

        const edgeKey = `${normalized}->${resolved}`
        if (edgeSet.has(edgeKey)) continue
        edgeSet.add(edgeKey)

        edges.push({
          source: normalized,
          target: resolved,
          type: file.endsWith('.py') ? 'import' : imp.startsWith('import') ? 'import' : 'require',
        })

        // Update degrees
        const sourceNode = nodeMap.get(normalized)
        const targetNode = nodeMap.get(resolved)
        if (sourceNode) sourceNode.outDegree++
        if (targetNode) targetNode.inDegree++
      }
    } catch {
      // File read error
    }
  }

  // Find orphans (no in-degree, no out-degree)
  const orphans = nodes
    .filter(n => n.inDegree === 0 && n.outDegree === 0)
    .map(n => n.id)

  // Find cycles using DFS
  const cycles = detectCircularDependencies({ nodes, edges, orphans, cycles: [], hotspots: [] })

  // Find hotspots (high in-degree = depended on by many)
  const hotspotThreshold = Math.max(3, Math.floor(nodes.length * 0.05))
  const hotspots = nodes
    .filter(n => n.inDegree >= hotspotThreshold)
    .sort((a, b) => b.inDegree - a.inDegree)
    .map(n => n.id)

  return { nodes, edges, orphans, cycles, hotspots }
}

export function detectCircularDependencies(
  analysis: Pick<DependencyAnalysis, 'nodes' | 'edges'>,
): string[][] {
  const adjacency = new Map<string, string[]>()
  for (const edge of analysis.edges) {
    const existing = adjacency.get(edge.source) ?? []
    existing.push(edge.target)
    adjacency.set(edge.source, existing)
  }

  const cycles: string[][] = []
  const visited = new Set<string>()
  const inStack = new Set<string>()
  const path: string[] = []

  function dfs(node: string): void {
    if (inStack.has(node)) {
      // Found a cycle
      const cycleStart = path.indexOf(node)
      if (cycleStart !== -1) {
        const cycle = path.slice(cycleStart)
        if (cycle.length > 1 && cycle.length <= 20) {
          cycles.push([...cycle, node])
        }
      }
      return
    }
    if (visited.has(node)) return

    visited.add(node)
    inStack.add(node)
    path.push(node)

    const neighbors = adjacency.get(node) ?? []
    for (const neighbor of neighbors) {
      dfs(neighbor)
    }

    path.pop()
    inStack.delete(node)
  }

  for (const node of analysis.nodes) {
    if (!visited.has(node.id)) {
      dfs(node.id)
    }
  }

  // Deduplicate cycles (sort each cycle and compare)
  const seen = new Set<string>()
  return cycles.filter(c => {
    const key = [...c].sort().join(',')
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function findImportChain(
  filePath: string,
  analysis: DependencyAnalysis,
): string[] {
  const chain: string[] = []
  const visited = new Set<string>()

  function walk(file: string): void {
    if (visited.has(file)) return
    visited.add(file)
    chain.push(file)

    const outEdges = analysis.edges.filter(e => e.source === file)
    for (const edge of outEdges) {
      walk(edge.target)
    }
  }

  walk(filePath)
  return chain
}

export function findHotspots(analysis: DependencyAnalysis): string[] {
  return analysis.hotspots
}

export function calculateCoupling(
  nodeId: string,
  analysis: DependencyAnalysis,
): { afferent: number; efferent: number } {
  const node = analysis.nodes.find(n => n.id === nodeId)
  if (!node) return { afferent: 0, efferent: 0 }
  return {
    afferent: node.inDegree, // how many depend on this
    efferent: node.outDegree, // how many this depends on
  }
}

export function visualizeDependencyGraph(analysis: DependencyAnalysis): string {
  let mermaid = 'graph TD\n'

  // Add nodes (use short names to keep it readable)
  const nameMap = new Map<string, string>()
  let counter = 0
  for (const node of analysis.nodes) {
    const shortName = node.name.replace(extname(node.name), '')
    const id = `N${counter++}`
    nameMap.set(node.id, id)
    const label = shortName.length > 30 ? shortName.slice(0, 30) + '...' : shortName
    mermaid += `  ${id}["${label}"]\n`
  }

  // Add edges (limit to prevent enormous diagrams)
  const maxEdges = Math.min(analysis.edges.length, 100)
  for (let i = 0; i < maxEdges; i++) {
    const edge = analysis.edges[i]!
    const sourceId = nameMap.get(edge.source)
    const targetId = nameMap.get(edge.target)
    if (sourceId && targetId) {
      mermaid += `  ${sourceId} --> ${targetId}\n`
    }
  }

  if (analysis.edges.length > maxEdges) {
    mermaid += `  %% ... and ${analysis.edges.length - maxEdges} more edges\n`
  }

  // Highlight hotspots
  for (const hotspot of analysis.hotspots) {
    const id = nameMap.get(hotspot)
    if (id) {
      mermaid += `  style ${id} fill:#ff6b6b,stroke:#333,color:#fff\n`
    }
  }

  return mermaid
}
