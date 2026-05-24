/**
 * StaticAnalyzer — Pure TypeScript static code analysis engine.
 *
 * No LLM dependency. Uses regex and structural patterns to analyze
 * complexity, type safety, error handling, naming, security, and
 * dependency graphs.
 */

import type {
	ComplexityMetrics,
	DependencyAnalysis,
	ErrorHandlingMetrics,
	GovernanceFinding,
	TypeSafetyMetrics,
} from './types.js'

// ============================================================
// Complexity Analysis
// ============================================================

/**
 * Analyze code complexity metrics for a source file.
 * @param source - The source code to analyze
 * @param filePath - Path of the file (for findings)
 * @returns Complexity metrics
 */
export function analyzeComplexity(
	source: string,
	_filePath: string,
): ComplexityMetrics {
	const lines = source.split('\n')
	const totalLines = lines.length

	// Count code lines (exclude blank and single-line comments)
	let codeLines = 0
	for (const line of lines) {
		const trimmed = line.trim()
		if (trimmed.length > 0 && !trimmed.startsWith('//') && !trimmed.startsWith('*') && !trimmed.startsWith('/*')) {
			codeLines++
		}
	}

	// Cyclomatic complexity: count branch points
	const branchPattern = /\b(if|else\s+if|for|while|case|catch)\b|\&\&|\|\||\?\?/g
	const branchMatches = source.match(branchPattern)
	const cyclomatic = (branchMatches?.length ?? 0) + 1

	// Nesting depth: track brace depth
	let maxDepth = 0
	let currentDepth = 0
	for (const char of source) {
		if (char === '{') {
			currentDepth++
			if (currentDepth > maxDepth) maxDepth = currentDepth
		} else if (char === '}') {
			currentDepth = Math.max(0, currentDepth - 1)
		}
	}

	// Function extraction and length analysis
	const functionPattern = /(?:function\s+\w+|(?:const|let|var)\s+\w+\s*=\s*(?:async\s+)?(?:\([^)]*\)|[a-zA-Z_]\w*)\s*=>|(?:async\s+)?(?:\([^)]*\)|[a-zA-Z_]\w*)\s*=>)/g
	const functionMatches = Array.from(source.matchAll(functionPattern))
	const functionCount = functionMatches.length

	// Compute function lengths
	const functionLengths: number[] = []
	for (const match of functionMatches) {
		if (match.index === undefined) continue
		const funcStart = match.index
		let braceCount = 0
		let funcEnd = funcStart
		let foundOpen = false
		for (let i = funcStart; i < source.length; i++) {
			if (source[i] === '{') {
				braceCount++
				foundOpen = true
			} else if (source[i] === '}') {
				braceCount--
				if (foundOpen && braceCount === 0) {
					funcEnd = i
					break
				}
			}
		}
		const funcLines = source.slice(funcStart, funcEnd).split('\n').length
		functionLengths.push(funcLines)
	}

	const avgFunctionLength = functionLengths.length > 0
		? functionLengths.reduce((a, b) => a + b, 0) / functionLengths.length
		: 0
	const longestFunction = functionLengths.length > 0
		? Math.max(...functionLengths)
		: 0

	return {
		cyclomatic,
		maxNestingDepth: maxDepth,
		avgFunctionLength: Math.round(avgFunctionLength * 10) / 10,
		longestFunction,
		totalLines,
		codeLines,
		functionCount,
	}
}

// ============================================================
// Import Extraction
// ============================================================

/**
 * Extract all import paths from a source file.
 * @param source - The source code
 * @param _filePath - Path of the file
 * @returns Array of import path strings
 */
export function extractImports(source: string, _filePath: string): string[] {
	const importPattern = /import\s+(?:type\s+)?(?:[^;]*?)\s+from\s+['"]([^'"]+)['"]/g
	const dynamicImportPattern = /import\(['"]([^'"]+)['"]\)/g

	const imports: string[] = []
	let match: RegExpExecArray | null

	const sourceCopy = source
	const staticRegex = new RegExp(importPattern.source, importPattern.flags)
	while ((match = staticRegex.exec(sourceCopy)) !== null) {
		imports.push(match[1])
	}

	const sourceCopy2 = source
	const dynamicRegex = new RegExp(dynamicImportPattern.source, dynamicImportPattern.flags)
	while ((match = dynamicRegex.exec(sourceCopy2)) !== null) {
		imports.push(match[1])
	}

	return imports
}

// ============================================================
// Type Safety Analysis
// ============================================================

/**
 * Analyze type safety issues in a source file.
 * @param source - The source code
 * @returns Type safety metrics
 */
export function analyzeTypeSafety(source: string): TypeSafetyMetrics {
	// Count `any` usage (type annotations, not in comments/strings)
	const anyPattern = /:\s*any\b/g
	const anyMatches = source.match(anyPattern)
	const anyCount = anyMatches?.length ?? 0

	// Count `as` type casts
	const asPattern = /\bas\s+[A-Z]\w+/g
	const asMatches = source.match(asPattern)
	const castCount = asMatches?.length ?? 0

	// Functions missing return types
	const funcNoReturnPattern = /(?:function\s+\w+\s*\([^)]*\))\s*\{/g
	const funcNoReturnMatches = source.match(funcNoReturnPattern)
	const arrowNoReturnPattern = /(?:const|let|var)\s+\w+\s*=\s*(?:async\s+)?\([^)]*\)\s*=>\s*\{/g
	const arrowNoReturnMatches = source.match(arrowNoReturnPattern)
	const missingReturnTypes = (funcNoReturnMatches?.length ?? 0) + (arrowNoReturnMatches?.length ?? 0)

	// Untyped parameters
	const untypedParamPattern = /\(\s*\w+\s*[,\)]/g
	const untypedParamMatches = source.match(untypedParamPattern)
	const untypedParams = untypedParamMatches?.length ?? 0

	// Non-null assertions
	const nonNullPattern = /\w+!/g
	const nonNullMatches = source.match(nonNullPattern)
	const nonNullAssertions = nonNullMatches?.length ?? 0

	return {
		anyCount,
		castCount,
		missingReturnTypes,
		untypedParams,
		nonNullAssertions,
	}
}

// ============================================================
// Error Handling Analysis
// ============================================================

/**
 * Analyze error handling patterns in a source file.
 * @param source - The source code
 * @returns Error handling metrics
 */
export function analyzeErrorHandling(source: string): ErrorHandlingMetrics {
	// Bare catch: catch { (no variable)
	const bareCatchPattern = /catch\s*\{/g
	const bareCatchMatches = source.match(bareCatchPattern)
	const bareCatchCount = bareCatchMatches?.length ?? 0

	// Untyped catch: catch (e) or catch (error) without type
	const untypedCatchPattern = /catch\s*\(\s*(?:e|err|error|exception|_)\s*\)/gi
	const untypedCatchMatches = source.match(untypedCatchPattern)
	const untypedCatchCount = untypedCatchMatches?.length ?? 0

	// Unhandled promise: .then without .catch (simplified check)
	const thenPattern = /\.then\s*\(/g
	const catchPattern = /\.catch\s*\(/g
	const thenCount = source.match(thenPattern)?.length ?? 0
	const catchCount = source.match(catchPattern)?.length ?? 0
	const unhandledPromiseCount = Math.max(0, thenCount - catchCount)

	// Empty catch blocks
	const emptyCatchPattern = /catch\s*(?:\([^)]*\))?\s*\{\s*\}/g
	const emptyCatchMatches = source.match(emptyCatchPattern)
	const emptyCatchCount = emptyCatchMatches?.length ?? 0

	return {
		bareCatchCount,
		untypedCatchCount,
		unhandledPromiseCount,
		emptyCatchCount,
	}
}

// ============================================================
// Naming Convention Analysis
// ============================================================

/**
 * Check naming conventions in source code.
 * @param source - The source code
 * @returns Array of governance findings for naming violations
 */
export function analyzeNaming(source: string): GovernanceFinding[] {
	const findings: GovernanceFinding[] = []
	const lines = source.split('\n')

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i]
		const lineNum = i + 1

		// Check class/interface/type declarations for PascalCase
		const classPattern = /\b(class|interface|type)\s+([a-z]\w*)/g
		let match: RegExpExecArray | null
		while ((match = classPattern.exec(line)) !== null) {
			findings.push({
				severity: 'warning',
				dimension: 'naming',
				message: `${match[1]} "${match[2]}" should use PascalCase`,
				location: { file: '', line: lineNum },
				ruleId: 'GOV-NAM-001',
			})
		}

		// Check for single-letter variable names (except loop vars)
		const singleLetterPattern = /(?:const|let|var)\s+([a-zA-Z])\s*[=,]/g
		while ((match = singleLetterPattern.exec(line)) !== null) {
			if (!['i', 'j', 'k', 'x', 'y', 'z', '_'].includes(match[1])) {
				findings.push({
					severity: 'info',
					dimension: 'naming',
					message: `Single-letter variable "${match[1]}" is not descriptive`,
					location: { file: '', line: lineNum },
					ruleId: 'GOV-NAM-002',
				})
			}
		}

		// Check for abbreviations in variable names
		const abbrevPattern = /(?:const|let|var|function)\s+(?:tmp|temp|val|num|str|obj|arr|fn|cb|ctx|cfg|conf|msg|err|req|res|ref|doc|idx|len|param|arg)\b/gi
		while ((match = abbrevPattern.exec(line)) !== null) {
			findings.push({
				severity: 'info',
				dimension: 'naming',
				message: `Abbreviated name found — consider using a more descriptive name`,
				location: { file: '', line: lineNum },
				ruleId: 'GOV-NAM-003',
			})
		}
	}

	return findings
}

// ============================================================
// Security Analysis
// ============================================================

/**
 * Detect security issues in source code.
 * @param source - The source code
 * @returns Array of governance findings for security issues
 */
export function analyzeSecurity(source: string): GovernanceFinding[] {
	const findings: GovernanceFinding[] = []
	const lines = source.split('\n')

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i]
		const lineNum = i + 1

		// eval() usage
		if (/\beval\s*\(/.test(line) && !line.trim().startsWith('//')) {
			findings.push({
				severity: 'critical',
				dimension: 'security',
				message: 'Use of eval() is a security risk',
				location: { file: '', line: lineNum },
				ruleId: 'GOV-SEC-001',
				autoFix: 'Replace eval() with a safer alternative (JSON.parse, Function constructor, or refactored logic)',
				references: ['https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/eval#never_use_eval!'],
			})
		}

		// innerHTML
		if (/\.innerHTML\s*=/.test(line) && !line.trim().startsWith('//')) {
			findings.push({
				severity: 'error',
				dimension: 'security',
				message: 'Direct innerHTML assignment can lead to XSS',
				location: { file: '', line: lineNum },
				ruleId: 'GOV-SEC-002',
				autoFix: 'Use textContent or a sanitization library',
			})
		}

		// dangerouslySetInnerHTML
		if (/dangerouslySetInnerHTML/.test(line)) {
			findings.push({
				severity: 'error',
				dimension: 'security',
				message: 'dangerouslySetInnerHTML is a XSS vector',
				location: { file: '', line: lineNum },
				ruleId: 'GOV-SEC-003',
			})
		}

		// SQL string concatenation
		if (/['"`]\s*(SELECT|INSERT|UPDATE|DELETE|DROP)\b/i.test(line) || /\+\s*(?:req|request|input|param|query)\b/i.test(line) && /SELECT|INSERT|UPDATE|DELETE/i.test(line)) {
			findings.push({
				severity: 'critical',
				dimension: 'security',
				message: 'Possible SQL injection via string concatenation',
				location: { file: '', line: lineNum },
				ruleId: 'GOV-SEC-004',
				autoFix: 'Use parameterized queries instead of string concatenation',
			})
		}

		// process.env used directly without validation
		if (/\bprocess\.env\.\w+/.test(line) && !/z\.|joi\.|validate|schema|parse/.test(line)) {
			findings.push({
				severity: 'warning',
				dimension: 'security',
				message: 'process.env accessed without visible validation',
				location: { file: '', line: lineNum },
				ruleId: 'GOV-SEC-005',
				autoFix: 'Validate environment variables with zod or similar schema library',
			})
		}
	}

	return findings
}

// ============================================================
// Dependency Graph
// ============================================================

/**
 * Build a dependency graph from multiple source files and detect circular deps.
 * @param sources - Map of file path -> source code
 * @returns Dependency analysis with import graph and circular dependencies
 */
export function buildDependencyGraph(
	sources: Map<string, string>,
): DependencyAnalysis {
	const importGraph = new Map<string, string[]>()
	const moduleFiles = new Map<string, Set<string>>()

	for (const [filePath, source] of Array.from(sources.entries())) {
		const imports = extractImports(source, filePath)
		// Resolve relative imports to actual file paths
		const resolvedImports = imports.map((imp) => {
			if (imp.startsWith('.')) {
				// Resolve relative path
				const dir = filePath.substring(0, filePath.lastIndexOf('/'))
				const parts = imp.split('/')
				const base = dir.split('/')
				for (const part of parts) {
					if (part === '..') base.pop()
					else if (part !== '.') base.push(part)
				}
				return base.join('/')
			}
			return imp
		})
		importGraph.set(filePath, resolvedImports)

		// Group by module
		const moduleName = extractModuleFromPath(filePath)
		if (!moduleFiles.has(moduleName)) {
			moduleFiles.set(moduleName, new Set())
		}
		moduleFiles.get(moduleName)?.add(filePath)
	}

	const circularDependencies = detectCircularDependencies(importGraph)

	return { importGraph, circularDependencies, moduleFiles }
}

/**
 * Extract module name from file path.
 * @param filePath - The file path (e.g., "src/reasoning/chainOfThought.ts")
 * @returns Module name (e.g., "reasoning")
 */
export function extractModuleFromPath(filePath: string): string {
	// Normalize path separators
	const normalized = filePath.replace(/\\/g, '/')
	const parts = normalized.split('/')

	// Find 'src' directory and take the next segment
	const srcIdx = parts.indexOf('src')
	if (srcIdx >= 0 && srcIdx + 1 < parts.length) {
		return parts[srcIdx + 1]
	}

	// Fallback: use directory name
	if (parts.length >= 2) {
		return parts[parts.length - 2]
	}
	return 'unknown'
}

/**
 * Detect circular dependencies using DFS.
 * @param graph - Import graph (file -> imports)
 * @returns Array of circular dependency chains
 */
export function detectCircularDependencies(
	graph: Map<string, string[]>,
): string[][] {
	const cycles: string[][] = []
	const visited = new Set<string>()
	const stack = new Set<string>()
	const path: string[] = []

	function dfs(node: string): void {
		if (stack.has(node)) {
			// Found a cycle
			const cycleStart = path.indexOf(node)
			if (cycleStart >= 0) {
				cycles.push([...path.slice(cycleStart), node])
			}
			return
		}
		if (visited.has(node)) return

		visited.add(node)
		stack.add(node)
		path.push(node)

		const neighbors = graph.get(node) ?? []
		for (const neighbor of neighbors) {
			// Only check internal imports
			if (graph.has(neighbor)) {
				dfs(neighbor)
			}
		}

		path.pop()
		stack.delete(node)
	}

	for (const node of Array.from(graph.keys())) {
		dfs(node)
	}

	return cycles
}
