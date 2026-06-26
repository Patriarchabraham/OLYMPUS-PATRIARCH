/**
 * Cross-file impact post-edit hook.
 *
 * After FileEditTool or WriteTool succeeds, look up which other project
 * files import the edited file and surface that list back to the LLM in
 * the same turn. This gives the LLM awareness of blast radius — it can
 * now notice "I just renamed an export that 3 other files consume" and
 * react in the same response. Claude Code has no equivalent feedback.
 *
 * Design notes:
 *  - Reverse-import-graph built lazily on first call, cached for session.
 *    No invalidation. Staleness is acceptable for an advisory hook.
 *  - Regex-based import extraction (no TypeScript compiler API) — fast
 *    but coarse: catches ES + dynamic imports, misses re-exports.
 *  - Silent when edited file has no importers (matches the formal-analysis
 *    pattern — speak only when there's something to say).
 *  - Every step wrapped in try/catch — graph build must NEVER break editing.
 */

import { readFile } from 'node:fs/promises'
import { dirname, extname, relative, resolve } from 'node:path'
import { logForDebugging } from '../../utils/debug.js'

/** Tools that should trigger cross-file impact analysis. See formalAnalysisHook.ts for the hardcoded-string rationale. */
const TRACKED_TOOLS = new Set<string>(['Edit', 'Write'])

/** Extensions whose imports we track. */
const TRACKED_EXTENSIONS = new Set<string>(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'])

/** Directories to skip when walking the project tree. */
const SKIP_DIRS = new Set<string>(['node_modules', 'dist', '.git', 'build', '.next'])

/**
 * Reverse import graph: maps an absolute file path to the set of absolute
 * paths of files that import it. Built lazily on first hook fire.
 */
let reverseImportGraph: Map<string, Set<string>> | null = null

/**
 * Run cross-file impact analysis on the file just produced by `toolName`.
 *
 * @param toolName - The tool that just executed (must be Edit or Write)
 * @param toolInput - The tool's input parameters (must contain file_path)
 * @returns Formatted `<cross_file_impact>` block if there are importers, otherwise null
 */
export async function runCrossFileImpactCheck(
	toolName: string,
	toolInput: Record<string, unknown>,
): Promise<string | null> {
	try {
		// 1. Gate on tool name
		if (!TRACKED_TOOLS.has(toolName)) return null

		// 2. Extract file path
		const rawPath = toolInput.file_path
		if (typeof rawPath !== 'string' || rawPath.length === 0) return null

		// 3. Gate on extension
		const ext = extname(rawPath).toLowerCase()
		if (!TRACKED_EXTENSIONS.has(ext)) return null

		// 4. Resolve to absolute path
		const absolutePath = resolve(process.cwd(), rawPath)

		// 5. Look up importers in cached reverse-import graph
		const graph = await getReverseImportGraph()
		const importers = graph.get(absolutePath)

		// 6. Filter + format
		if (!importers || importers.size === 0) return null

		// Sort for deterministic output, show relative paths for readability
		const sortedImporters = [...importers].sort()
		const relativePaths = sortedImporters.map((abs) => {
			const rel = relative(process.cwd(), abs)
			return rel.startsWith('..') ? abs : rel
		})

		return (
			`<cross_file_impact importers="${relativePaths.length}">\n` +
			relativePaths.map((p) => `- ${p}`).join('\n') +
			`\nVerify your edits don't break these importers ` +
			`(signature changes, removed exports, renamed symbols).\n` +
			`</cross_file_impact>`
		)
	} catch (e) {
		// Graph build or lookup must NEVER break the tool flow.
		logForDebugging(`[crossFileImpact] hook failed: ${e}`)
		return null
	}
}

/**
 * Get the cached reverse-import graph, building it lazily on first access.
 */
async function getReverseImportGraph(): Promise<Map<string, Set<string>>> {
	if (reverseImportGraph) return reverseImportGraph
	reverseImportGraph = await buildReverseImportGraph(process.cwd())
	return reverseImportGraph
}

/**
 * Walk the project's `src/` directory, parse imports out of every tracked
 * file, and build a reverse-import map (importedFile → set of importerFiles).
 *
 * Reuses the import-extraction regex pattern from `src/governance/staticAnalyzer.ts:117`
 * (inlined to avoid the vitest resolver bug documented in formalAnalysisHook.ts:28-31).
 */
async function buildReverseImportGraph(projectRoot: string): Promise<Map<string, Set<string>>> {
	const graph = new Map<string, Set<string>>()

	// Walk src/ collecting tracked files
	const srcDir = resolve(projectRoot, 'src')
	const files = await walkTrackedFiles(srcDir)

	// Parse each file's imports and invert into the reverse graph
	for (const file of files) {
		try {
			const source = await readFile(file, 'utf-8')
			const importPaths = extractImports(source)

			for (const imp of importPaths) {
				// Skip bare specifiers (npm packages, node: imports)
				if (!imp.startsWith('.')) continue

				// Resolve relative to the importing file's directory
				const importerDir = dirname(file)
				const importedAbsolute = resolve(importerDir, imp)

				// Try with each tracked extension if the import has none
				const candidates = candidatePaths(importedAbsolute)
				for (const candidate of candidates) {
					if (!files.has(candidate)) continue

					let entry = graph.get(candidate)
					if (!entry) {
						entry = new Set<string>()
						graph.set(candidate, entry)
					}
					entry.add(file)
				}
			}
		} catch {
			// Individual file read failure shouldn't kill the graph build
		}
	}

	return graph
}

/**
 * Walk a directory recursively, returning a Set of absolute paths to
 * files matching TRACKED_EXTENSIONS. Skips SKIP_DIRS.
 */
async function walkTrackedFiles(dir: string): Promise<Set<string>> {
	const result = new Set<string>()
	let entries: import('node:fs').Dirent[]
	try {
		const { readdir } = await import('node:fs/promises')
		entries = await readdir(dir, { withFileTypes: true })
	} catch {
		return result
	}

	for (const entry of entries) {
		if (SKIP_DIRS.has(entry.name)) continue
		const full = resolve(dir, entry.name)
		if (entry.isDirectory()) {
			const nested = await walkTrackedFiles(full)
			for (const n of nested) result.add(n)
		} else if (entry.isFile()) {
			const ext = extname(entry.name).toLowerCase()
			if (TRACKED_EXTENSIONS.has(ext)) {
				result.add(full)
			}
		}
	}

	return result
}

/**
 * Extract import specifiers from source via regex. Inlined from
 * `src/governance/staticAnalyzer.ts:117` to avoid pulling the governance
 * module (which would trigger the same vitest-resolver bug).
 *
 * Handles ES static imports (`import ... from '...'`) and dynamic imports
 * (`import('...')`). Does NOT handle re-exports (`export ... from '...'`)
 * or CommonJS `require()` — those are rarer in this codebase.
 */
function extractImports(source: string): string[] {
	const imports: string[] = []

	// ES static imports: `import { x } from './foo'` or `import type { T } from './foo'`
	const staticRegex = /import\s+(?:type\s+)?(?:[^;]*?)\s+from\s+['"]([^'"]+)['"]/g
	// ES dynamic imports: `import('./foo')`
	const dynamicRegex = /import\(['"]([^'"]+)['"]\)/g

	let match: RegExpExecArray | null
	while ((match = staticRegex.exec(source)) !== null) imports.push(match[1])
	while ((match = dynamicRegex.exec(source)) !== null) imports.push(match[1])

	return imports
}

/**
 * Given an absolute import specifier, produce candidate paths to test
 * against the file set. Covers three forms seen in real TS code:
 *   1. No extension (`'./foo'`) — try all tracked extensions + index files.
 *   2. `.js` extension on a `.ts` source — TypeScript ESM convention:
 *      `import x from './foo.js'` actually resolves to `foo.ts`. Strip
 *      and retry with each tracked source extension.
 *   3. Other tracked extension (`.ts`, `.tsx`, …) — assume literal.
 */
function candidatePaths(absolutePath: string): string[] {
	const ext = extname(absolutePath).toLowerCase()

	// Case 2: `.js` import that actually points at a `.ts`/`.tsx`/etc. file.
	// Always include the literal path too (case 3 falls through into this list).
	if (ext === '.js' || ext === '.jsx' || ext === '.mjs' || ext === '.cjs') {
		const withoutExt = absolutePath.slice(0, -ext.length)
		return [
			absolutePath,
			`${withoutExt}.ts`,
			`${withoutExt}.tsx`,
			`${withoutExt}.js`,
			`${withoutExt}.jsx`,
			`${withoutExt}.mjs`,
			`${withoutExt}.cjs`,
		]
	}

	// Case 3: literal tracked extension.
	if (TRACKED_EXTENSIONS.has(ext)) return [absolutePath]

	// Case 1: no extension — standard resolution order + index files.
	return [
		`${absolutePath}.ts`,
		`${absolutePath}.tsx`,
		`${absolutePath}.js`,
		`${absolutePath}.jsx`,
		`${absolutePath}.mjs`,
		`${absolutePath}.cjs`,
		resolve(absolutePath, 'index.ts'),
		resolve(absolutePath, 'index.tsx'),
	]
}

/**
 * Reset the cached graph (test helper).
 */
export function _resetForTest(): void {
	reverseImportGraph = null
}
