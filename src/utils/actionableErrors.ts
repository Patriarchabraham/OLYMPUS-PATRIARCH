/**
 * Actionable error messages — transforms raw errors into user-friendly
 * messages with concrete next steps. Every error tells the user what
 * happened AND what to do about it.
 *
 * @module actionableErrors
 */

/** Maps provider error patterns to actionable guidance */
const PROVIDER_ERROR_PATTERNS: ReadonlyArray<{
	pattern: RegExp
	title: string
	guidance: string
}> = [
	{
		pattern: /invalid.api.key|invalid x-api-key|authentication failed/i,
		title: "Invalid API Key",
		guidance: "Run: /provider to update your API key for the current provider.",
	},
	{
		pattern: /model not found|model.*not available|does not exist/i,
		title: "Model Not Available",
		guidance: "The selected model is not available for this provider. Run: /provider to see available models or switch provider.",
	},
	{
		pattern: /rate.limit|too many requests|429|quota.exceeded/i,
		title: "Rate Limited",
		guidance: "Mythos will retry with exponential backoff. Consider switching to a different provider with: /provider",
	},
	{
		pattern: /connection refused|ECONNREFUSED|fetch failed|network error/i,
		title: "Connection Failed",
		guidance: "Cannot reach the provider API. Check your internet connection and proxy settings.",
	},
	{
		pattern: /context.window|context.length|token limit|max.tokens/i,
		title: "Context Window Exceeded",
		guidance: "The conversation is too long. Use /clear to start fresh, or /compact to summarize context.",
	},
	{
		pattern: /timeout|ETIMEDOUT|request timed out/i,
		title: "Request Timeout",
		guidance: "The provider took too long to respond. Try a faster model or switch provider with: /provider",
	},
	{
		pattern: /billing|payment|subscription|plan/i,
		title: "Billing Issue",
		guidance: "There may be an issue with your provider account billing. Check your provider dashboard.",
	},
	{
		pattern: /permission denied|EACCES|not authorized/i,
		title: "Permission Denied",
		guidance: "Mythos doesn't have permission for this operation. Check file permissions or run with appropriate access.",
	},
]

/** Maps file operation error patterns to guidance */
const FILE_ERROR_PATTERNS: ReadonlyArray<{
	pattern: RegExp
	title: string
	guidance: string
}> = [
	{
		pattern: /ENOENT.*open/i,
		title: "File Not Found",
		guidance: "The file doesn't exist yet. It will be created automatically.",
	},
	{
		pattern: /ENOENT/i,
		title: "Path Not Found",
		guidance: "A directory or file in the path doesn't exist. Check the path and create any missing directories.",
	},
	{
		pattern: /EISDIR/i,
		title: "Expected File, Got Directory",
		guidance: "The path points to a directory, not a file. Specify a file path instead.",
	},
	{
		pattern: /ENOSPC/i,
		title: "Disk Full",
		guidance: "No disk space remaining. Free up space and try again.",
	},
	{
		pattern: /EPERM|EBUSY/i,
		title: "File Locked",
		guidance: "The file is locked by another process. Close the other program and retry.",
	},
]

export interface ActionableError {
	/** Short human-readable title */
	readonly title: string
	/** The original error message */
	readonly original: string
	/** What happened (one sentence) */
	readonly explanation: string
	/** Concrete next step the user should take */
	readonly guidance: string
}

/**
 * Transforms a raw error into an actionable error with guidance.
 * Falls back to the original error message with generic guidance if
 * no specific pattern matches.
 *
 * @param error - The raw error (Error object, string, or unknown)
 * @returns An {@link ActionableError} with title, explanation, and guidance
 */
export function makeActionable(error: unknown): ActionableError {
	const message = error instanceof Error ? error.message : String(error)

	// Check provider error patterns
	for (const { pattern, title, guidance } of PROVIDER_ERROR_PATTERNS) {
		if (pattern.test(message)) {
			return {
				title,
				original: message,
				explanation: message,
				guidance,
			}
		}
	}

	// Check file error patterns
	for (const { pattern, title, guidance } of FILE_ERROR_PATTERNS) {
		if (pattern.test(message)) {
			return {
				title,
				original: message,
				explanation: message,
				guidance,
			}
		}
	}

	// Generic fallback
	return {
		title: "Error",
		original: message,
		explanation: message,
		guidance: "If this persists, try /clear to reset context or /provider to switch models.",
	}
}

/**
 * Formats an actionable error for terminal display with colors.
 * Returns a plain string without ANSI codes if `useColor` is false.
 *
 * @param actionable - The actionable error to format
 * @param useColor - Whether to include ANSI color codes (default: true)
 * @returns Formatted string ready for console output
 */
export function formatActionableError(actionable: ActionableError, useColor = true): string {
	const red = useColor ? "\x1b[31m" : ""
	const yellow = useColor ? "\x1b[33m" : ""
	const dim = useColor ? "\x1b[2m" : ""
	const bold = useColor ? "\x1b[1m" : ""
	const reset = useColor ? "\x1b[0m" : ""

	return [
		`${red}${bold}${actionable.title}${reset}`,
		`${dim}${actionable.explanation}${reset}`,
		`${yellow}→ ${actionable.guidance}${reset}`,
	].join("\n")
}
