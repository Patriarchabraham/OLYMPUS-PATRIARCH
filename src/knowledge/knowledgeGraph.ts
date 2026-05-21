import { createHash } from 'crypto'
import type { Document, KnowledgeNode, KnowledgeEdge, KnowledgeGraph } from './types.js'

function nodeId(type: KnowledgeNode['type'], name: string): string {
  return `${type}:${name}`
}

// Regex patterns for entity extraction
const IMPORT_PATTERNS = [
  /import\s+.*?from\s+['"]([^'"]+)['"]/g,
  /import\s+['"]([^'"]+)['"]/g,
  /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  /from\s+([a-zA-Z_][\w.]*)\s+import/g,
]

const EXPORT_PATTERNS = [
  /export\s+(?:default\s+)?(?:function|class|const|let|var|type|interface)\s+(\w+)/g,
  /export\s*\{([^}]+)\}/g,
]

const FUNCTION_PATTERN = /(?:function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?(?:function|\([^)]*\)\s*=>|\w+\s*=>))/g
const CLASS_PATTERN = /class\s+(\w+)/g

export function extractEntities(document: Document): KnowledgeNode[] {
  const nodes: KnowledgeNode[] = []
  const content = document.content
  const fileName = document.path.split('/').pop() ?? document.path

  // File node
  nodes.push({
    id: nodeId('file', document.path),
    type: 'file',
    name: fileName,
    properties: { path: document.path, language: document.language },
    edges: [],
  })

  // Module node
  nodes.push({
    id: nodeId('module', document.path),
    type: 'module',
    name: document.path.replace(/\.[^.]+$/, ''),
    properties: { path: document.path },
    edges: [{
      sourceId: nodeId('module', document.path),
      targetId: nodeId('file', document.path),
      type: 'contains',
      weight: 1,
    }],
  })

  // Import edges
  for (const pattern of IMPORT_PATTERNS) {
    pattern.lastIndex = 0
    let match
    while ((match = pattern.exec(content)) !== null) {
      const importPath = match[1]!
      nodes[0]!.edges.push({
        sourceId: nodeId('file', document.path),
        targetId: nodeId('dependency', importPath),
        type: 'imports',
        weight: 1,
      })
      nodes.push({
        id: nodeId('dependency', importPath),
        type: 'dependency',
        name: importPath,
        properties: { importedFrom: document.path },
        edges: [],
      })
    }
  }

  // Functions
  FUNCTION_PATTERN.lastIndex = 0
  let match
  while ((match = FUNCTION_PATTERN.exec(content)) !== null) {
    const fnName = match[1] ?? match[2]
    if (fnName) {
      const id = nodeId('function', `${document.path}::${fnName}`)
      nodes.push({
        id,
        type: 'function',
        name: fnName,
        properties: { file: document.path },
        edges: [{
          sourceId: nodeId('file', document.path),
          targetId: id,
          type: 'contains',
          weight: 1,
        }],
      })
    }
  }

  // Classes
  CLASS_PATTERN.lastIndex = 0
  while ((match = CLASS_PATTERN.exec(content)) !== null) {
    const className = match[1]!
    const id = nodeId('class', `${document.path}::${className}`)
    nodes.push({
      id,
      type: 'class',
      name: className,
      properties: { file: document.path },
      edges: [{
        sourceId: nodeId('file', document.path),
        targetId: id,
        type: 'contains',
        weight: 1,
      }],
    })
  }

  return nodes
}

export function buildGraph(documents: Document[]): KnowledgeGraph {
  const graph: KnowledgeGraph = {
    nodes: new Map(),
    edges: [],
  }

  const allNodes: KnowledgeNode[] = []
  for (const doc of documents) {
    allNodes.push(...extractEntities(doc))
  }

  // Deduplicate nodes by ID
  for (const node of allNodes) {
    const existing = graph.nodes.get(node.id)
    if (existing) {
      // Merge edges
      existing.edges.push(...node.edges)
    } else {
      graph.nodes.set(node.id, { ...node, edges: [...node.edges] })
    }
  }

  // Collect all edges
  for (const node of graph.nodes.values()) {
    for (const edge of node.edges) {
      graph.edges.push(edge)
    }
  }

  // Resolve cross-file import references
  resolveImportReferences(graph)

  return graph
}

function resolveImportReferences(graph: KnowledgeGraph): void {
  const filesByBasename = new Map<string, KnowledgeNode[]>()
  for (const node of graph.nodes.values()) {
    if (node.type === 'file') {
      const base = node.name
      const existing = filesByBasename.get(base) ?? []
      existing.push(node)
      filesByBasename.set(base, existing)
    }
  }

  for (const dep of graph.nodes.values()) {
    if (dep.type !== 'dependency') continue
    const importName = dep.name
    // Try to find a matching file or module
    for (const file of graph.nodes.values()) {
      if (file.type === 'file' && (file.name.endsWith(importName) || file.name.includes(importName))) {
        graph.edges.push({
          sourceId: dep.id,
          targetId: file.id,
          type: 'references',
          weight: 0.8,
        })
      }
    }
  }
}

export function addNode(graph: KnowledgeGraph, node: KnowledgeNode): void {
  graph.nodes.set(node.id, node)
}

export function addEdge(graph: KnowledgeGraph, edge: KnowledgeEdge): void {
  graph.edges.push(edge)
  const source = graph.nodes.get(edge.sourceId)
  if (source) {
    source.edges.push(edge)
  }
}

export function findRelated(graph: KnowledgeGraph, nodeId: string, depth: number = 2): KnowledgeNode[] {
  const visited = new Set<string>()
  const result: KnowledgeNode[] = []
  const queue: Array<{ id: string; d: number }> = [{ id: nodeId, d: 0 }]

  while (queue.length > 0) {
    const { id, d } = queue.shift()!
    if (visited.has(id) || d > depth) continue
    visited.add(id)

    const node = graph.nodes.get(id)
    if (node && id !== nodeId) {
      result.push(node)
    }

    if (node && d < depth) {
      for (const edge of node.edges) {
        if (!visited.has(edge.targetId)) {
          queue.push({ id: edge.targetId, d: d + 1 })
        }
      }
      // Also follow incoming edges
      for (const edge of graph.edges) {
        if (edge.targetId === id && !visited.has(edge.sourceId)) {
          queue.push({ id: edge.sourceId, d: d + 1 })
        }
      }
    }
  }

  return result
}

export function findPath(graph: KnowledgeGraph, fromId: string, toId: string): KnowledgeNode[] {
  const visited = new Set<string>()
  const parent = new Map<string, string>()
  const queue: string[] = [fromId]
  visited.add(fromId)

  while (queue.length > 0) {
    const current = queue.shift()!
    if (current === toId) break

    const node = graph.nodes.get(current)
    if (!node) continue

    const neighbors = [
      ...node.edges.map(e => e.targetId),
      ...graph.edges.filter(e => e.targetId === current).map(e => e.sourceId),
    ]

    for (const next of neighbors) {
      if (!visited.has(next) && graph.nodes.has(next)) {
        visited.add(next)
        parent.set(next, current)
        queue.push(next)
      }
    }
  }

  // Reconstruct path
  const path: KnowledgeNode[] = []
  let current: string | undefined = toId
  while (current && parent.has(current)) {
    const node = graph.nodes.get(current)
    if (node) path.unshift(node)
    current = parent.get(current)
  }

  const startNode = graph.nodes.get(fromId)
  if (startNode && path.length > 0) {
    path.unshift(startNode)
  }

  return path
}

export function queryGraph(graph: KnowledgeGraph, query: string): KnowledgeNode[] {
  const terms = query.toLowerCase().split(/\s+/).filter(t => t.length > 0)

  const scored: Array<{ node: KnowledgeNode; score: number }> = []
  for (const node of graph.nodes.values()) {
    let score = 0
    const text = `${node.name} ${node.type} ${Object.values(node.properties).join(' ')}`.toLowerCase()
    for (const term of terms) {
      if (text.includes(term)) score++
    }
    if (score > 0) {
      scored.push({ node, score })
    }
  }

  scored.sort((a, b) => b.score - a.score)
  return scored.map(s => s.node)
}
