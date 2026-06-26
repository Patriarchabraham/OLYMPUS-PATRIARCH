/**
 * Formal Analysis post-edit hook.
 *
 * After FileEditTool or WriteTool succeeds, run abstract interpretation
 * on the edited file and surface findings (null-deref, division-by-zero,
 * array out-of-bounds, etc.) back to the LLM in the same turn. This is
 * the integration point that turns the abstractInterpretation engine
 * from a CLI toy (`/abstract`) into a default-on safety net that catches
 * bugs Claude Code's plain editor misses.
 *
 * Design notes:
 *  - Sync, sub-millisecond analysis — safe to run inline in the tool flow.
 *  - Silent when clean; chatty only when there's something to fix.
 *  - Every step wrapped in try/catch — analysis must NEVER break editing.
 */

import { readFile } from 'node:fs/promises'
import { extname } from 'node:path'
import { analyzeAbstractly } from '../../abstractInterpretation/abstractInterpreter.js'
import { FILE_EDIT_TOOL_NAME } from '../../tools/FileEditTool/constants.js'
import { logForDebugging } from '../../utils/debug.js'

/**
 * Tools that should trigger formal analysis after success.
 *
 * NOTE: 'Write' is hardcoded rather than imported from FileWriteTool/prompt.js
 * because that module transitively imports FileReadTool/prompt.ts → pdfUtils
 * → model layer → permissions/classifierDecision, which currently breaks under
 * vitest on Windows (the .js→.ts resolver plugin doesn't fire for inlined deps).
 * The string value is stable (see FileWriteTool/prompt.ts:3).
 */
const ANALYZED_TOOLS = new Set<string>([FILE_EDIT_TOOL_NAME, 'Write'])

/** File extensions the abstract interpreter can parse. */
const ANALYZED_EXTENSIONS = new Set<string>(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs'])

/** Skip files above this line count — engine is O(n) and 2k lines is pathological. */
const MAX_LINES = 2000

/** Severity prefixes for the formatted output. */
const SEVERITY_PREFIX: Record<'error' | 'warning', string> = {
	error: '[ERR]',
	warning: '[WRN]',
}

/**
 * Run formal analysis on the file just produced by `toolName`.
 *
 * @param toolName - The tool that just executed (must be Edit or Write)
 * @param toolInput - The tool's input parameters (must contain file_path)
 * @returns Formatted `<formal_analysis>` block if findings exist, otherwise null
 *
 * @example
 * const findings = await runFormalAnalysisCheck('Edit', { file_path: '/src/foo.ts' })
 * // → "<formal_analysis engine=\"abstract-interpretation\" ...>\n[ERR] L12: ...\n</formal_analysis>"
 * // or null when the file is clean
 */
export async function runFormalAnalysisCheck(
	toolName: string,
	toolInput: Record<string, unknown>,
): Promise<string | null> {
	try {
		// 1. Gate on tool name
		if (!ANALYZED_TOOLS.has(toolName)) return null

		// 2. Extract file path
		const rawPath = toolInput.file_path
		if (typeof rawPath !== 'string' || rawPath.length === 0) return null

		// 3. Gate on extension
		const ext = extname(rawPath).toLowerCase()
		if (!ANALYZED_EXTENSIONS.has(ext)) return null

		// 4. Read post-edit content (Write already wrote it; Edit already applied patch)
		let source: string
		try {
			source = await readFile(rawPath, 'utf-8')
		} catch {
			// File may not exist (transient, deleted, etc.) — nothing to analyze.
			return null
		}

		// 5. Gate on size
		const lineCount = source.split('\n').length
		if (lineCount > MAX_LINES) return null

		// 6. Run abstract interpretation
		const result = analyzeAbstractly(source, rawPath)

		// 7. Filter to actionable severities (drop 'info' to reduce noise)
		const actionable = result.findings.filter(
			(f) => f.severity === 'error' || f.severity === 'warning',
		)
		if (actionable.length === 0) return null

		// 8. Format as <formal_analysis> block
		const soundnessPct = (result.soundnessScore * 100).toFixed(0)
		const lines = actionable.map((f) => {
			const prefix = SEVERITY_PREFIX[f.severity as 'error' | 'warning']
			const confPct = (f.confidence * 100).toFixed(0)
			return `${prefix} L${f.lineNumber}: ${f.message} (${confPct}%)`
		})

		return (
			`<formal_analysis engine="abstract-interpretation" soundness="${soundnessPct}">\n` +
			`${lines.join('\n')}\n` +
			`</formal_analysis>`
		)
	} catch (e) {
		// Analysis must NEVER break the tool flow — log and bail.
		logForDebugging(`[formalAnalysis] hook failed: ${e}`)
		return null
	}
}
