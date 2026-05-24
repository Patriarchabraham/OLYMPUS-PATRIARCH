/**
 * ArchitectureGuard — Architecture guardrail enforcement.
 *
 * Enforces module boundaries, detects circular dependencies,
 * and validates dependency directions against configurable rules.
 */

import type {
	ArchitectureRule,
	ArchitectureViolation,
} from './types.js'
import {
	detectCircularDependencies as detectCycles,
	extractModuleFromPath,
} from './staticAnalyzer.js'

// ============================================================
// Default Mythos Architecture Rules
// ============================================================

/**
 * Get the default architecture rules for the Mythos project.
 * Defines the allowed import directions between modules.
 */
export function getDefaultArchitectureRules(): ArchitectureRule[] {
	return [
		{
			sourceModule: 'governance',
			allowedImports: ['reasoning', 'cortex', 'evolution', 'utils', 'governance'],
			forbiddenImports: ['cli', 'bridge', 'services'],
			description: 'Governance can import from core analysis modules and utils, but not from CLI or bridge layers',
		},
		{
			sourceModule: 'reasoning',
			allowedImports: ['reasoning', 'utils', 'quantum'],
			forbiddenImports: ['cortex', 'cli', 'bridge', 'services', 'evolution'],
			description: 'Reasoning is a peer to Cortex — should not import from it. Can use utils and quantum.',
		},
		{
			sourceModule: 'cortex',
			allowedImports: ['cortex', 'reasoning', 'utils', 'knowledge'],
			forbiddenImports: ['cli', 'bridge', 'services'],
			description: 'Cortex can import from reasoning (lower layer) and utils, but not CLI or bridge',
		},
		{
			sourceModule: 'autonomous',
			allowedImports: ['autonomous', 'utils'],
			forbiddenImports: ['cortex', 'cli', 'services'],
			description: 'Autonomous should not import cortex directly — use orchestrator for coordination',
		},
		{
			sourceModule: 'quantum',
			allowedImports: ['quantum', 'reasoning', 'utils'],
			forbiddenImports: ['cortex', 'cli', 'bridge', 'services'],
			description: 'Quantum is a computation engine — should not import cortex or CLI',
		},
		{
			sourceModule: 'swarm',
			allowedImports: ['swarm', 'reasoning', 'utils'],
			forbiddenImports: ['cortex', 'cli', 'bridge', 'services'],
			description: 'Swarm is a peer to reasoning — should not import cortex or CLI',
		},
		{
			sourceModule: 'evolution',
			allowedImports: ['evolution', 'utils'],
			forbiddenImports: ['cli', 'bridge', 'services'],
			description: 'Evolution is a core module — should not import from CLI or service layers',
		},
		{
			sourceModule: 'knowledge',
			allowedImports: ['knowledge', 'utils'],
			forbiddenImports: ['cli', 'bridge', 'services', 'cortex', 'reasoning'],
			description: 'Knowledge is a foundational module — should not depend on higher-level modules',
		},
		{
			sourceModule: 'cli',
			allowedImports: ['cli', 'services', 'utils'],
			forbiddenImports: ['quantum', 'cortex', 'reasoning'],
			description: 'CLI should only import from services (orchestrator) and utils — not directly from engines',
		},
	]
}

// ============================================================
// Architecture Validation
// ============================================================

/**
 * Enforce architecture rules against a set of source files.
 * @param sources - Map of file path -> source code
 * @param rules - Architecture rules to enforce
 * @returns Array of detected violations
 */
export function enforceArchitectureRules(
	sources: Map<string, string>,
	rules: ArchitectureRule[],
): ArchitectureViolation[] {
	const violations: ArchitectureViolation[] = []

	for (const [filePath, source] of Array.from(sources.entries())) {
		const fromModule = extractModuleFromPath(filePath)
		const applicableRules = rules.filter((r) => r.sourceModule === fromModule)

		if (applicableRules.length === 0) continue

		// Extract imports
		const importPattern = /import\s+(?:type\s+)?(?:[^;]*?)\s+from\s+['"]([^'"]+)['"]/g
		const dynamicImportPattern = /import\(['"]([^'"]+)['"]\)/g

		const lines = source.split('\n')
		let match: RegExpExecArray | null

		for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
			const line = lines[lineIdx]

			// Static imports
			const staticRegex = new RegExp(importPattern.source, importPattern.flags)
			while ((match = staticRegex.exec(line)) !== null) {
				const importPath = match[1]
				if (importPath.startsWith('.')) {
					// Resolve relative path to module
					const toModule = resolveImportToModule(filePath, importPath)
					if (toModule) {
						const violation = checkViolation(
							fromModule,
							toModule,
							importPath,
							filePath,
							lineIdx + 1,
							applicableRules,
						)
						if (violation) violations.push(violation)
					}
				}
			}

			// Dynamic imports
			const dynamicRegex = new RegExp(dynamicImportPattern.source, dynamicImportPattern.flags)
			while ((match = dynamicRegex.exec(line)) !== null) {
				const importPath = match[1]
				if (importPath.startsWith('.')) {
					const toModule = resolveImportToModule(filePath, importPath)
					if (toModule) {
						const violation = checkViolation(
							fromModule,
							toModule,
							importPath,
							filePath,
							lineIdx + 1,
							applicableRules,
						)
						if (violation) violations.push(violation)
					}
				}
			}
		}
	}

	return violations
}

/**
 * Detect circular dependencies from an import graph.
 * @param importGraph - Map of file path -> imported file paths
 * @returns Array of circular dependency chains
 */
export function detectCircularDependencies(
	importGraph: Map<string, string[]>,
): string[][] {
	return detectCycles(importGraph)
}

/**
 * Validate that a dependency direction is allowed.
 * @param from - Source module name
 * @param to - Target module name
 * @param rules - Architecture rules
 * @returns Whether the import direction is valid
 */
export function validateDependencyDirection(
	from: string,
	to: string,
	rules: ArchitectureRule[],
): boolean {
	const applicableRules = rules.filter((r) => r.sourceModule === from)
	if (applicableRules.length === 0) return true // No rules = allowed

	for (const rule of applicableRules) {
		// Check if forbidden
		if (rule.forbiddenImports.some((pattern) => matchesModulePattern(to, pattern))) {
			return false
		}
		// Check if explicitly allowed
		if (rule.allowedImports.some((pattern) => matchesModulePattern(to, pattern))) {
			return true
		}
	}

	// If we have rules but none match, default to allowed
	return true
}

// ============================================================
// Helpers
// ============================================================

/** Resolve a relative import path to a module name */
function resolveImportToModule(
	fromFile: string,
	relativePath: string,
): string | null {
	const normalized = fromFile.replace(/\\/g, '/')
	const dir = normalized.substring(0, normalized.lastIndexOf('/'))
	const parts = relativePath.split('/')
	const base = dir.split('/')

	for (const part of parts) {
		if (part === '..') base.pop()
		else if (part !== '.') base.push(part)
	}

	const resolved = base.join('/')
	return extractModuleFromPath(resolved)
}

/** Check if a module name matches a pattern (simple glob) */
function matchesModulePattern(
	moduleName: string,
	pattern: string,
): boolean {
	if (pattern === '*') return true
	if (pattern === moduleName) return true
	// Simple glob: "reasoning/*" matches "reasoning"
	if (pattern.includes('*')) {
		const regex = new RegExp(`^${pattern.replace(/\*/g, '.*')}$`)
		return regex.test(moduleName)
	}
	return false
}

/** Check a single import against applicable rules */
function checkViolation(
	fromModule: string,
	toModule: string,
	importPath: string,
	filePath: string,
	line: number,
	rules: ArchitectureRule[],
): ArchitectureViolation | null {
	// Skip self-imports
	if (fromModule === toModule) return null

	// Skip utils — always allowed
	if (toModule === 'utils') return null

	for (const rule of rules) {
		const isForbidden = rule.forbiddenImports.some(
			(p) => matchesModulePattern(toModule, p),
		)
		if (isForbidden) {
			return {
				fromModule,
				toModule,
				violationType: 'boundary_cross',
				allowedDirections: rule.allowedImports,
				actualImport: importPath,
				file: filePath,
				line,
			}
		}

		// Check wrong direction (not in allowed list)
		const isAllowed = rule.allowedImports.some(
			(p) => matchesModulePattern(toModule, p),
		)
		if (!isAllowed && rule.forbiddenImports.length > 0) {
			// Not explicitly forbidden but not in allowed list either
			// Only flag if the rule has explicit forbidden list
		}
	}

	return null
}
