import { randomUUID } from 'crypto'
import type { CodeVisualization } from './types.js'

interface CodeElement {
  type: 'function' | 'class' | 'method' | 'import' | 'export' | 'interface' | 'type' | 'variable'
  name: string
  params?: string[]
  returnType?: string
  parent?: string
  calls?: string[]
}

export async function analyzeCodeStructure(code: string, language: string): Promise<string[]> {
  const elements = extractElements(code, language)
  return elements.map(e => `${e.type}: ${e.name}${e.parent ? ` (in ${e.parent})` : ''}`)
}

function extractElements(code: string, language: string): CodeElement[] {
  const elements: CodeElement[] = []

  if (language === 'typescript' || language === 'javascript' || language === 'tsx' || language === 'jsx') {
    extractJSElements(code, elements)
  } else if (language === 'python') {
    extractPythonElements(code, elements)
  } else {
    extractGenericElements(code, elements)
  }

  return elements
}

function extractJSElements(code: string, elements: CodeElement[]): void {
  // Imports
  const importRegex = /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g
  let match: RegExpExecArray | null
  while ((match = importRegex.exec(code)) !== null) {
    elements.push({ type: 'import', name: match[1]! })
  }

  // Functions
  const funcRegex = /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)/g
  while ((match = funcRegex.exec(code)) !== null) {
    elements.push({
      type: 'function',
      name: match[1]!,
      params: match[2]!.split(',').map(p => p.trim()).filter(Boolean),
    })
  }

  // Arrow functions
  const arrowRegex = /(?:export\s+)?(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?\(([^)]*)\)\s*=>/g
  while ((match = arrowRegex.exec(code)) !== null) {
    elements.push({
      type: 'function',
      name: match[1]!,
      params: match[2]!.split(',').map(p => p.trim()).filter(Boolean),
    })
  }

  // Classes
  const classRegex = /(?:export\s+)?(?:abstract\s+)?class\s+(\w+)(?:\s+extends\s+(\w+))?(?:\s+implements\s+([\w,\s]+))?/g
  while ((match = classRegex.exec(code)) !== null) {
    elements.push({ type: 'class', name: match[1]! })
  }

  // Methods inside classes
  const methodRegex = /(?:(?:public|private|protected|static|async)\s+)*(\w+)\s*\(([^)]*)\)\s*(?::\s*([^{]+?))?\s*\{/g
  while ((match = methodRegex.exec(code)) !== null) {
    const name = match[1]!
    if (name !== 'constructor' && name !== 'if' && name !== 'for' && name !== 'while' && name !== 'switch') {
      elements.push({
        type: 'method',
        name,
        params: match[2]!.split(',').map(p => p.trim()).filter(Boolean),
        returnType: match[3]?.trim(),
      })
    }
  }

  // Interfaces
  const interfaceRegex = /(?:export\s+)?interface\s+(\w+)/g
  while ((match = interfaceRegex.exec(code)) !== null) {
    elements.push({ type: 'interface', name: match[1]! })
  }

  // Types
  const typeRegex = /(?:export\s+)?type\s+(\w+)\s*=/g
  while ((match = typeRegex.exec(code)) !== null) {
    elements.push({ type: 'type', name: match[1]! })
  }

  // Exports
  const exportRegex = /export\s+(?:default\s+)?(?:function|class|const|let|var)\s+(\w+)/g
  while ((match = exportRegex.exec(code)) !== null) {
    elements.push({ type: 'export', name: match[1]! })
  }
}

function extractPythonElements(code: string, elements: CodeElement[]): void {
  // Imports
  const importRegex = /(?:from\s+(\w+)\s+)?import\s+([\w.,\s]+)/g
  let match: RegExpExecArray | null
  while ((match = importRegex.exec(code)) !== null) {
    const module = match[1] || match[2]!.trim()
    elements.push({ type: 'import', name: module.replace(/\s*,\s*/g, ', ') })
  }

  // Functions
  const funcRegex = /def\s+(\w+)\s*\(([^)]*)\)/g
  while ((match = funcRegex.exec(code)) !== null) {
    elements.push({
      type: 'function',
      name: match[1]!,
      params: match[2]!.split(',').map(p => p.trim()).filter(Boolean),
    })
  }

  // Classes
  const classRegex = /class\s+(\w+)(?:\(([^)]+)\))?:/g
  while ((match = classRegex.exec(code)) !== null) {
    elements.push({ type: 'class', name: match[1]! })
  }
}

function extractGenericElements(code: string, elements: CodeElement[]): void {
  // Generic function pattern
  const funcRegex = /(?:function|def|fn|func)\s+(\w+)\s*\(/g
  let match: RegExpExecArray | null
  while ((match = funcRegex.exec(code)) !== null) {
    elements.push({ type: 'function', name: match[1]! })
  }

  // Generic class pattern
  const classRegex = /(?:class|struct|interface|type)\s+(\w+)/g
  while ((match = classRegex.exec(code)) !== null) {
    elements.push({ type: 'class', name: match[1]! })
  }
}

export async function generateFlowchart(code: string, language: string): Promise<CodeVisualization> {
  const elements = extractElements(code, language)
  const id = randomUUID()

  let mermaidCode = 'flowchart TD\n'

  // Create nodes for functions/classes
  const functions = elements.filter(e => e.type === 'function')
  const classes = elements.filter(e => e.type === 'class')

  for (const cls of classes) {
    mermaidCode += `    ${sanitizeId(cls.name)}["${cls.name} (class)"]\n`
  }

  for (const func of functions) {
    const label = func.params?.length
      ? `${func.name}(${func.params.join(', ')})`
      : func.name
    mermaidCode += `    ${sanitizeId(func.name)}["${label}"]\n`
  }

  // Add sequential flow for functions
  for (let i = 0; i < functions.length - 1; i++) {
    mermaidCode += `    ${sanitizeId(functions[i]!.name)} --> ${sanitizeId(functions[i + 1]!.name)}\n`
  }

  return {
    id,
    type: 'flowchart',
    title: `Code Flowchart (${language})`,
    mermaidCode,
    description: `Flowchart of ${elements.length} code elements in ${language}`,
    sourceElements: elements.map(e => e.name),
  }
}

export async function generateSequenceDiagram(interactions: string[]): Promise<CodeVisualization> {
  const id = randomUUID()

  let mermaidCode = 'sequenceDiagram\n'

  // Parse interactions as "A -> B: message" format
  for (let i = 0; i < interactions.length; i++) {
    const interaction = interactions[i]!
    const arrowMatch = interaction.match(/(.+?)\s*(?:->|-->|->>|->>)\s*(.+?):\s*(.+)/)

    if (arrowMatch) {
      const from = arrowMatch[1]!.trim()
      const to = arrowMatch[2]!.trim()
      const message = arrowMatch[3]!.trim()
      mermaidCode += `    ${sanitizeId(from)}->>${sanitizeId(to)}: ${message}\n`
    } else {
      mermaidCode += `    Note over System: ${interaction}\n`
    }
  }

  return {
    id,
    type: 'sequence',
    title: 'Sequence Diagram',
    mermaidCode,
    description: `Sequence diagram with ${interactions.length} interactions`,
    sourceElements: interactions,
  }
}

export async function generateClassDiagram(code: string, language: string): Promise<CodeVisualization> {
  const elements = extractElements(code, language)
  const id = randomUUID()

  const classes = elements.filter(e => e.type === 'class')
  const methods = elements.filter(e => e.type === 'method')
  const interfaces = elements.filter(e => e.type === 'interface')

  let mermaidCode = 'classDiagram\n'

  // Classes
  for (const cls of classes) {
    mermaidCode += `    class ${sanitizeId(cls.name)} {\n`
    // Add methods that belong to this class
    const classMethods = methods.slice(0, 5) // Limit methods shown
    for (const method of classMethods) {
      const params = method.params?.join(', ') ?? ''
      mermaidCode += `        +${method.name}(${params})\n`
    }
    mermaidCode += '    }\n'
  }

  // Interfaces
  for (const iface of interfaces) {
    mermaidCode += `    class ${sanitizeId(iface.name)} {\n`
    mermaidCode += '        <<interface>>\n'
    mermaidCode += '    }\n'
  }

  return {
    id,
    type: 'class-diagram',
    title: `Class Diagram (${language})`,
    mermaidCode,
    description: `Class diagram with ${classes.length} classes and ${interfaces.length} interfaces`,
    sourceElements: elements.map(e => e.name),
  }
}

export async function generateDependencyGraph(files: string[]): Promise<CodeVisualization> {
  const id = randomUUID()

  let mermaidCode = 'graph LR\n'

  const nodes = new Set<string>()
  const edges: { from: string; to: string }[] = []

  for (const file of files) {
    const parts = file.replace(/\\/g, '/').split('/')
    const moduleName = parts[parts.length - 1]!.replace(/\.\w+$/, '')
    nodes.add(moduleName)

    // Infer dependencies from path structure
    if (parts.length > 1) {
      const parentDir = parts[parts.length - 2]!
      if (parentDir !== moduleName && !parentDir.startsWith('.')) {
        nodes.add(parentDir)
        edges.push({ from: parentDir, to: moduleName })
      }
    }
  }

  for (const node of nodes) {
    mermaidCode += `    ${sanitizeId(node)}["${node}"]\n`
  }

  for (const edge of edges) {
    mermaidCode += `    ${sanitizeId(edge.from)} --> ${sanitizeId(edge.to)}\n`
  }

  return {
    id,
    type: 'dependency-graph',
    title: 'Dependency Graph',
    mermaidCode,
    description: `Dependency graph of ${files.length} files with ${edges.length} dependencies`,
    sourceElements: Array.from(nodes),
  }
}

export async function generateCallTree(entryPoint: string, codebase: string): Promise<CodeVisualization> {
  const id = randomUUID()
  const elements = extractElements(codebase, 'typescript')

  let mermaidCode = 'graph TD\n'

  // Build a simple call tree starting from entry point
  const functions = elements.filter(e => e.type === 'function')
  const sanitizeEntry = sanitizeId(entryPoint)

  mermaidCode += `    root["${entryPoint}"]\n`

  for (const func of functions.slice(0, 10)) {
    const funcId = sanitizeId(func.name)
    mermaidCode += `    ${funcId}["${func.name}"]\n`
    mermaidCode += `    root --> ${funcId}\n`
  }

  return {
    id,
    type: 'call-tree',
    title: `Call Tree from ${entryPoint}`,
    mermaidCode,
    description: `Call tree starting from ${entryPoint} with ${functions.length} functions`,
    sourceElements: [entryPoint, ...functions.map(f => f.name)],
  }
}

function sanitizeId(name: string): string {
  return name.replace(/[^a-zA-Z0-9_]/g, '_').replace(/^[0-9]/, '_$&')
}
