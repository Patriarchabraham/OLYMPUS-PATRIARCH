/**
 * GovernanceEngine — Main orchestrator for 100x code governance.
 *
 * Coordinates static analysis, scoring, architecture guardrails,
 * and auto-fix generation. Persists history for regression detection.
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildDependencyGraph, extractImports } from './staticAnalyzer.js'
import { scoreFile, detectRegressions } from './scoringEngine.js'
import { enforceArchitectureRules, getDefaultArchitectureRules } from './architectureGuard.js'
import { generateAutoFixes } from './autoFixGenerator.js'
import type {
	GovernanceConfig,
	GovernanceHistoryEntry,
	GovernanceReport,
	GovernanceScore,
	AutoFixSuggestion,
	GovernanceFinding,
} from './types.js'
import { DEFAULT_GOVERNANCE_CONFIG } from './types.js'

// ============================================================
// Persistence Types
// ============================================================

interface GovernanceState {
	history: GovernanceHistoryEntry[]
	lastScores: Record<string, number>
	version: number
}

// ============================================================
// GovernanceEngine Class
// ============================================================

/**
 * Main governance engine — coordinates all analysis, scoring,
 * and persistence for the 100x code governance system.
 */
export class GovernanceEngine {
	private config: GovernanceConfig
	private history: GovernanceHistoryEntry[]
	private lastScores: Record<string, number>
	private lastReport: GovernanceReport | null = null
	private dataDir: string | null

	private constructor(config: GovernanceConfig) {
		this.config = config
		this.history = []
		this.lastScores = {}
		this.dataDir = config.dataDir ?? null
	}

	/**
	 * Create and initialize a new GovernanceEngine.
	 * @param dataDir - Directory for persistent state
	 * @param config - Optional config overrides
	 */
	static async init(
		dataDir?: string,
		config?: Partial<GovernanceConfig>,
	): Promise<GovernanceEngine> {
		const fullConfig: GovernanceConfig = {
			...DEFAULT_GOVERNANCE_CONFIG,
			...config,
			dataDir,
		}

		const engine = new GovernanceEngine(fullConfig)
		await engine.load()
		return engine
	}

	/**
	 * Run a full governance scan on a project directory.
	 * @param rootDir - Root directory to scan
	 * @returns Complete governance report
	 */
	async analyzeProject(rootDir: string): Promise<GovernanceReport> {
		const startTime = Date.now()

		// 1. Collect all TypeScript files
		const files = collectTsFiles(rootDir)

		// 2. Read all files
		const sources = new Map<string, string>()
		for (const filePath of files) {
			try {
				const content = readFileSync(filePath, 'utf-8')
				sources.set(filePath, content)
			} catch {
				// Skip unreadable files
			}
		}

		// 3. Build dependency graph
		const depAnalysis = buildDependencyGraph(sources)

		// 4. Get architecture rules
		const rules = this.config.architectureRules.length > 0
			? this.config.architectureRules
			: getDefaultArchitectureRules()

		// 5. Detect architecture violations
		const violations = enforceArchitectureRules(sources, rules)

		// 6. Score each file
		const fileScores = new Map<string, GovernanceScore>()
		const allFindings: GovernanceFinding[] = []
		const allAutoFixes: AutoFixSuggestion[] = []

		for (const [filePath, source] of Array.from(sources.entries())) {
			// Count circular deps and violations for this file
			const circularCount = depAnalysis.circularDependencies.filter(
				(chain) => chain.some((f) => f === filePath),
			).length
			const violationCount = violations.filter(
				(v) => v.file === filePath,
			).length

			const score = scoreFile(
				source,
				filePath,
				this.config,
				circularCount,
				violationCount,
			)
			fileScores.set(filePath, score)
			allFindings.push(...getAllFindings(score))

			// Generate auto-fixes
			if (this.config.autoFixEnabled) {
				const fixes = generateAutoFixes(
					allFindings,
					source,
					filePath,
				)
				allAutoFixes.push(...fixes)
			}
		}

		// 7. Compute module scores
		const moduleScores = new Map<string, GovernanceScore>()
		for (const [moduleName, fileSet] of Array.from(depAnalysis.moduleFiles.entries())) {
			const moduleSources = new Map<string, string>()
			for (const f of fileSet) {
				const content = sources.get(f)
				if (content) moduleSources.set(f, content)
			}
			if (moduleSources.size > 0) {
				const { scoreModule } = await import('./scoringEngine.js')
				moduleScores.set(moduleName, scoreModule(moduleSources, moduleName, this.config))
			}
		}

		// 8. Compute overall score
		const overallScore = fileScores.size > 0
			? Array.from(fileScores.values()).reduce((a, s) => a + s.overall, 0) / fileScores.size
			: 1

		// 9. Detect regressions vs previous scan
		const regressions = this.detectProjectRegressions(fileScores)

		// 10. Build report
		const report: GovernanceReport = {
			overallScore,
			fileScores,
			moduleScores,
			violations,
			allFindings,
			autoFixes: allAutoFixes,
			timestamp: Date.now(),
			durationMs: Date.now() - startTime,
			filesAnalyzed: sources.size,
			regressions,
		}

		// 11. Save history
		this.recordHistory(report)
		this.lastReport = report
		await this.save()

		return report
	}

	/**
	 * Analyze a single file.
	 * @param filePath - Path to the file
	 * @returns Governance score for the file
	 */
	async analyzeFile(filePath: string): Promise<GovernanceScore> {
		const source = readFileSync(filePath, 'utf-8')
		return scoreFile(source, filePath, this.config)
	}

	/**
	 * Get governance history entries.
	 */
	getHistory(): GovernanceHistoryEntry[] {
		return [...this.history]
	}

	/**
	 * Detect regressions from the last report.
	 * @returns Array of file paths that regressed
	 */
	detectRegressions(): string[] {
		if (!this.lastReport) return []
		return this.lastReport.regressions
	}

	/**
	 * Get the last governance report.
	 */
	getLastReport(): GovernanceReport | null {
		return this.lastReport
	}

	/**
	 * Get the current configuration.
	 */
	getConfig(): GovernanceConfig {
		return { ...this.config }
	}

	/**
	 * Save governance state to disk.
	 */
	async save(): Promise<void> {
		if (!this.dataDir || !this.config.persistHistory) return

		const dir = join(this.dataDir, 'governance')
		if (!existsSync(dir)) mkdirSync(dir, { recursive: true })

		const state: GovernanceState = {
			history: this.history.slice(-100), // Keep last 100 entries
			lastScores: this.lastScores,
			version: 1,
		}

		const path = join(dir, 'state.json')
		writeFileSync(path, JSON.stringify(state, null, 2), 'utf-8')
	}

	/**
	 * Load governance state from disk.
	 */
	async load(): Promise<void> {
		if (!this.dataDir) return

		const path = join(this.dataDir, 'governance', 'state.json')
		if (!existsSync(path)) return

		try {
			const raw = readFileSync(path, 'utf-8')
			const state = JSON.parse(raw) as GovernanceState
			this.history = state.history ?? []
			this.lastScores = state.lastScores ?? {}
		} catch {
			// Corrupted state — start fresh
			this.history = []
			this.lastScores = {}
		}
	}

	// ─── Private Methods ──────────────────────────────────────────

	/** Detect regressions by comparing file scores with last saved scores */
	private detectProjectRegressions(
		fileScores: Map<string, GovernanceScore>,
	): string[] {
		const regressions: string[] = []

		for (const [filePath, score] of Array.from(fileScores.entries())) {
			const prevScore = this.lastScores[filePath]
			if (prevScore !== undefined && score.overall < prevScore - 0.1) {
				regressions.push(filePath)
			}
		}

		return regressions
	}

	/** Record a history entry from a report */
	private recordHistory(report: GovernanceReport): void {
		const scores: Record<string, number> = {}
		const improvements: string[] = []

		for (const [filePath, score] of Array.from(report.fileScores.entries())) {
			scores[filePath] = score.overall
			const prevScore = this.lastScores[filePath]
			if (prevScore !== undefined && score.overall > prevScore + 0.1) {
				improvements.push(filePath)
			}
		}

		const entry: GovernanceHistoryEntry = {
			timestamp: report.timestamp,
			scores,
			regressions: report.regressions,
			improvements,
			totalFindings: report.allFindings.length,
			autoFixesApplied: report.autoFixes.length,
		}

		this.history.push(entry)
		this.lastScores = scores
	}
}

// ============================================================
// Helpers
// ============================================================

/** Extract all findings from a governance score */
function getAllFindings(score: GovernanceScore): GovernanceFinding[] {
	const findings: GovernanceFinding[] = []
	for (const dimScore of Object.values(score.dimensions)) {
		findings.push(...dimScore.findings)
	}
	return findings
}

/** Collect all .ts/.tsx files in a directory (excluding node_modules, dist, .git) */
function collectTsFiles(rootDir: string): string[] {
	const excludedDirs = new Set([
		'node_modules', 'dist', '.git', 'build', '.next', 'coverage',
		'.cache', '.turbo', '.vercel', '__pycache__', '.terraform',
	])

	const files: string[] = []

	function walk(dir: string): void {
		let entries: string[]
		try {
			entries = readdirSync(dir)
		} catch {
			return
		}

		for (const entry of entries) {
			const fullPath = join(dir, entry)
			if (excludedDirs.has(entry)) continue

			let stat
			try {
				stat = statSync(fullPath)
			} catch {
				continue
			}

			if (stat.isDirectory()) {
				walk(fullPath)
			} else if (
				stat.isFile() &&
				(entry.endsWith('.ts') || entry.endsWith('.tsx')) &&
				!entry.endsWith('.d.ts') &&
				!entry.endsWith('.test.ts') &&
				!entry.endsWith('.spec.ts')
			) {
				files.push(fullPath.replace(/\\/g, '/'))
			}
		}
	}

	walk(rootDir)
	return files
}

// Fix: use proper imports instead of require
// Replace the require in collectTsFiles with proper imports

/** Singleton */
let engineInstance: GovernanceEngine | null = null

/**
 * Get or create the global GovernanceEngine singleton.
 */
export async function getGovernanceEngine(
	dataDir?: string,
): Promise<GovernanceEngine> {
	if (!engineInstance) {
		engineInstance = await GovernanceEngine.init(dataDir)
	}
	return engineInstance
}
