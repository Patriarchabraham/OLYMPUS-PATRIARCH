import type { AutoFixConfig } from './autoFixConfig.js'
import type { AutoFixResult } from './autoFixRunner.js'

// Real tool names are 'Edit' and 'Write' (see FileEditTool/constants.ts:2,
// FileWriteTool/prompt.ts:3). The previous values 'file_edit'/'file_write'
// never matched tool.name, so autoFix never fired.
const AUTO_FIX_TOOLS = new Set(['Edit', 'Write'])

export function shouldRunAutoFix(toolName: string, config: AutoFixConfig | null): boolean {
	if (!config) return false
	return AUTO_FIX_TOOLS.has(toolName)
}

export function buildAutoFixContext(result: AutoFixResult): string | null {
	if (!result.hasErrors || !result.errorSummary) return null

	return (
		`<auto_fix_feedback>\n` +
		`AUTO-FIX: The file you just edited has errors. Please fix them:\n\n` +
		`${result.errorSummary}\n\n` +
		`Please fix these errors in the files you just edited. ` +
		`Do not ask the user — just apply the fix.\n` +
		`</auto_fix_feedback>`
	)
}
