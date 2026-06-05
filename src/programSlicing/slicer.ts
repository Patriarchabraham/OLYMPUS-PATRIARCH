/**
 * Program Slicer — builds dependency graph and computes backward/forward slices.
 *
 * Reduces code to only the lines that affect (backward) or are affected by (forward)
 * a specific variable at a specific point.
 */

import type {
	DepNode, DepEdge, DependencyGraph, SliceCriteria, SliceResult,
	SlicerConfig, DependencyKind,
} from './types.js'
import { DEFAULT_SLICER_CONFIG } from './types.js'

/**
 * Build a dependency graph from source code.
 *
 * @param source - TypeScript source code
 * @returns Dependency graph with data and control edges
 */
export function buildDependencyGraph(source: string): DependencyGraph {
	const nodes = new Map<string, DepNode>()
	const edges: DepEdge[] = []
	const variableDefs = new Map<string, string[]>()
	const variableUses = new Map<string, string[]>()
	const lineNodes = new Map<number, string[]>()

	const lines = source.split('\n')
	let nodeId = 0

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i]
		const lineNum = i + 1
		const trimmed = line.trim()

		if (trimmed === '' || trimmed.startsWith('//') || trimmed.startsWith('import ')) continue

		// Track variable definitions
		const defPatterns = [
			/(?:const|let|var)\s+(\w+)/g,
			/(\w+)\s*=/g,
			/(\w+)\s*\+=/g,
			/(\w+)\s*-=/g,
		]

		const definedHere = new Set<string>()
		for (const pattern of defPatterns) {
			let match: RegExpExecArray | null
			while ((match = pattern.exec(trimmed)) !== null) {
				const varName = match[1]
				if (['if', 'else', 'for', 'while', 'return', 'throw', 'function', 'const', 'let', 'var', 'new', 'true', 'false'].includes(varName)) continue
				definedHere.add(varName)
			}
		}

		// Track variable uses
		const usedHere = new Set<string>()
		const usePattern = /\b(\w+)\b/g
		let useMatch: RegExpExecArray | null
		while ((useMatch = usePattern.exec(trimmed)) !== null) {
			const varName = useMatch[1]
			if (['if', 'else', 'for', 'while', 'return', 'throw', 'function', 'const', 'let', 'var', 'new', 'true', 'false', 'undefined', 'null', 'typeof', 'console', 'Math'].includes(varName)) continue
			if (!definedHere.has(varName)) {
				usedHere.add(varName)
			} else {
				// Variable is both defined and used (e.g., x += 1)
				usedHere.add(varName)
			}
		}

		// Create statement node
		const stmtId = `stmt_${nodeId++}`
		const stmtNode: DepNode = {
			id: stmtId,
			type: 'statement',
			variableName: null,
			lineNumber: lineNum,
			column: 0,
			text: trimmed,
		}
		nodes.set(stmtId, stmtNode)
		if (!lineNodes.has(lineNum)) lineNodes.set(lineNum, [])
		lineNodes.get(lineNum)!.push(stmtId)

		// Record definitions
		for (const varName of definedHere) {
			if (!variableDefs.has(varName)) variableDefs.set(varName, [])
			variableDefs.get(varName)!.push(stmtId)
		}

		// Record uses
		for (const varName of usedHere) {
			if (!variableUses.has(varName)) variableUses.set(varName, [])
			variableUses.get(varName)!.push(stmtId)
		}

		// Create variable definition nodes
		for (const varName of definedHere) {
			const varId = `var_${nodeId++}_${varName}`
			const varNode: DepNode = {
				id: varId,
				type: 'variable',
				variableName: varName,
				lineNumber: lineNum,
				column: 0,
				text: varName,
			}
			nodes.set(varId, varNode)
			lineNodes.get(lineNum)!.push(varId)

			// Data edge: statement → variable definition
			edges.push({ from: stmtId, to: varId, kind: 'data' })
		}
	}

	// Build data dependency edges: use → def (backward)
	for (const [varName, useIds] of variableUses) {
		const defIds = variableDefs.get(varName) ?? []
		for (const useId of useIds) {
			// Find the closest preceding definition
			const useNode = nodes.get(useId)
			if (!useNode) continue

			for (const defId of defIds) {
				const defNode = nodes.get(defId)
				if (!defNode) continue

				// Only backward data dependencies (definition before use)
				if (defNode.lineNumber <= useNode.lineNumber) {
					edges.push({ from: useId, to: defId, kind: 'data' })
				}
			}
		}
	}

	// Build control dependency edges (if/while bodies)
	for (let i = 0; i < lines.length; i++) {
		const line = lines[i].trim()
		const lineNum = i + 1
		const ifMatch = line.match(/if\s*\(/)
		if (ifMatch) {
			// Find the body lines (simplified: until matching } or next non-indented line)
			const bodyLines = findBodyLines(lines, i)
			for (const bodyLineNum of bodyLines) {
				const bodyNodeIds = lineNodes.get(bodyLineNum) ?? []
				const ctrlNodeIds = lineNodes.get(lineNum) ?? []
				for (const bodyId of bodyNodeIds) {
					for (const ctrlId of ctrlNodeIds) {
						edges.push({ from: bodyId, to: ctrlId, kind: 'control' })
					}
				}
			}
		}
	}

	return { nodes, edges, variableDefs, variableUses, lineNodes }
}

/**
 * Compute a program slice.
 *
 * @param source - Original source code
 * @param criteria - Slice criteria (variable, line, direction)
 * @param config - Slicer configuration
 * @returns Slice result with reduced code
 */
export function computeSlice(
	source: string,
	criteria: SliceCriteria,
	config: SlicerConfig = DEFAULT_SLICER_CONFIG,
): SliceResult {
	const graph = buildDependencyGraph(source)
	const lines = source.split('\n')
	const includedLines = new Set<number>()

	// Find the starting node(s)
	const startNodes = findNodesForCriteria(graph, criteria)
	const visited = new Set<string>()
	const queue = [...startNodes]

	// BFS traverse dependencies
	while (queue.length > 0 && includedLines.size < config.maxSliceSize) {
		const currentId = queue.shift()!
		if (visited.has(currentId)) continue
		visited.add(currentId)

		const node = graph.nodes.get(currentId)
		if (node) {
			includedLines.add(node.lineNumber)

			// Traverse edges based on direction
			for (const edge of graph.edges) {
				if (config.includeDataDeps && edge.kind === 'data') {
					const nextId = criteria.direction === 'backward' ? edge.to : edge.from
					if (edge.from === currentId || edge.to === currentId) {
						if (!visited.has(nextId)) queue.push(nextId)
					}
				}
				if (config.includeControlDeps && edge.kind === 'control') {
					const nextId = criteria.direction === 'backward' ? edge.to : edge.from
					if (edge.from === currentId || edge.to === currentId) {
						if (!visited.has(nextId)) queue.push(nextId)
					}
				}
			}
		}
	}

	// Also include lines of all traversed nodes
	for (const id of visited) {
		const node = graph.nodes.get(id)
		if (node) includedLines.add(node.lineNumber)
	}

	// Build sliced code
	const slicedLineNums = [...includedLines].sort((a, b) => a - b)
	const slicedCode = slicedLineNums
		.map((n) => lines[n - 1])
		.filter(Boolean)
		.join('\n')

	const sliceNodes = [...visited]
		.map((id) => graph.nodes.get(id))
		.filter((n): n is DepNode => n !== undefined)

	const deps = graph.edges.filter(
		(e) => visited.has(e.from) && visited.has(e.to),
	)

	return {
		criteria,
		slicedLines: slicedLineNums,
		totalLines: lines.length,
		reductionPercent: lines.length > 0
			? ((1 - slicedLineNums.length / lines.length) * 100)
			: 0,
		sliceNodes,
		dependencies: deps,
		slicedCode,
	}
}

/**
 * Find all lines inside an if/while body.
 */
function findBodyLines(lines: string[], startIdx: number): number[] {
	const bodyLines: number[] = []
	let braceCount = 0
	let inBody = false

	for (let i = startIdx; i < lines.length; i++) {
		const line = lines[i]!
		for (const ch of line) {
			if (ch === '{') { braceCount++; inBody = true }
			if (ch === '}') braceCount--
		}
		if (inBody && i > startIdx) {
			bodyLines.push(i + 1)
		}
		if (inBody && braceCount === 0) break
	}

	return bodyLines
}

/**
 * Find nodes matching slice criteria.
 */
function findNodesForCriteria(graph: DependencyGraph, criteria: SliceCriteria): string[] {
	const matching: string[] = []

	for (const [id, node] of graph.nodes) {
		if (node.variableName === criteria.variableName || node.lineNumber === criteria.lineNumber) {
			matching.push(id)
		}
	}

	// Also find statements that define/use the variable
	const defIds = graph.variableDefs.get(criteria.variableName) ?? []
	const useIds = graph.variableUses.get(criteria.variableName) ?? []

	return [...new Set([...matching, ...defIds, ...useIds])]
}
