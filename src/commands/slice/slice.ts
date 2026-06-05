import type { ContentBlockParam } from '@anthropic-ai/sdk/resources/messages.mjs'
import type { Command } from '../../commands.js'
import { buildDependencyGraph, computeSlice } from '../../programSlicing/index.js'

const command: Command = {
	type: 'prompt',
	name: 'slice',
	description:
		'Program Slicing — reduce code to only the lines that affect or are affected by a variable',
	isEnabled: () => true,
	progressMessage: 'computing program slice',
	contentLength: 0,
	source: 'builtin',
	async getPromptForCommand(args?: string): Promise<ContentBlockParam[]> {
		const action = args?.trim() || 'help'

		if (action === 'help' || action === '') {
			return [{ type: 'text', text: `[Program Slicing]
Reduce code to only the lines relevant to a specific variable.

Usage:
- /slice help — Show this help
- /slice backward <var> <line> <code> — Backward slice (what affects this variable)
- /slice forward <var> <line> <code> — Forward slice (what this variable affects)
- /slice graph <code> — Show dependency graph

How it works:
- Builds a dependency graph (data + control edges)
- BFS traverses from the slice criterion
- Backward: lines that INFLUENCE the variable at that line
- Forward: lines INFLUENCED BY the variable at that line

Useful for debugging: "Which lines affect the value of x at line 42?"` }]
		}

		if (action.startsWith('graph ')) {
			const code = action.slice(6)
			if (code.length < 10) {
				return [{ type: 'text', text: '[Slice] Provide code: /slice graph <code>' }]
			}

			const graph = buildDependencyGraph(code)

			const lines = [
				`[Dependency Graph]`,
				`Nodes: ${graph.nodes.size}`,
				`Edges: ${graph.edges.length} (data: ${graph.edges.filter((e) => e.kind === 'data').length}, control: ${graph.edges.filter((e) => e.kind === 'control').length})`,
				`Variables defined: ${[...graph.variableDefs.keys()].join(', ') || 'none'}`,
				`Variables used: ${[...graph.variableUses.keys()].join(', ') || 'none'}`,
			]

			if (graph.edges.length > 0) {
				lines.push(`\nEdges (first 20):`)
				for (const edge of graph.edges.slice(0, 20)) {
					const fromNode = graph.nodes.get(edge.from)
					const toNode = graph.nodes.get(edge.to)
					lines.push(`  ${edge.kind}: L${fromNode?.lineNumber ?? '?'} → L${toNode?.lineNumber ?? '?'}`)
				}
			}

			return [{ type: 'text', text: lines.join('\n') }]
		}

		if (action.startsWith('backward ') || action.startsWith('forward ')) {
			const direction = action.startsWith('backward') ? 'backward' as const : 'forward' as const
			const rest = action.slice(direction === 'backward' ? 9 : 8).trim()

			// Parse: <var> <lineNumber> <code>
			// First token is variable, second is line number, rest is code
			const firstSpace = rest.indexOf(' ')
			if (firstSpace === -1) {
				return [{ type: 'text', text: `[Slice] Usage: /slice ${direction} <var> <line> <code>` }]
			}

			const varName = rest.slice(0, firstSpace)
			const afterVar = rest.slice(firstSpace + 1).trim()
			const secondSpace = afterVar.indexOf(' ')
			if (secondSpace === -1) {
				return [{ type: 'text', text: `[Slice] Usage: /slice ${direction} <var> <line> <code>` }]
			}

			const lineStr = afterVar.slice(0, secondSpace)
			const lineNumber = Number.parseInt(lineStr, 10)
			const code = afterVar.slice(secondSpace + 1).trim()

			if (Number.isNaN(lineNumber) || code.length < 5) {
				return [{ type: 'text', text: `[Slice] Invalid line number or code too short.` }]
			}

			const result = computeSlice(code, { variableName: varName, lineNumber, direction })

			const lines = [
				`[Program Slice — ${direction}]`,
				`Variable: ${varName} at line ${lineNumber}`,
				`Lines included: ${result.slicedLines.length} / ${result.totalLines}`,
				`Reduction: ${result.reductionPercent.toFixed(1)}%`,
				`Nodes: ${result.sliceNodes.length} | Dependencies: ${result.dependencies.length}`,
				`\nSliced code:`,
				result.slicedCode || '(empty)',
			]

			return [{ type: 'text', text: lines.join('\n') }]
		}

		return [{ type: 'text', text: `[Slice] Unknown action: ${action}. Use /slice help.` }]
	},
}

export default command
