/**
 * Proof Engine Core — orchestrates all four verifiers, manages caching,
 * computes overall confidence, and generates escalation fixes.
 *
 * Pipeline: cache check → 4 verifiers in parallel → weighted aggregate →
 * Bayesian confidence → escalation check → cache result.
 */

import { createHash } from 'node:crypto'
import type {
	DimensionProofScore,
	ProofDimension,
	ProofEngineConfig,
	ProofFinding,
	ProofReport,
	ProofResult,
	TokenEfficiencyScore,
	VerifierContext,
} from './types.js'
import { DEFAULT_PROOF_CONFIG } from './types.js'
import { verifyEngineering } from './engineeringVerifier.js'
import { verifyLogically } from './logicalVerifier.js'
import { verifyMathematically } from './mathematicalVerifier.js'
import { TokenMultiplierTracker } from './tokenMultiplier.js'
import { verifyTypographically } from './typographicalVerifier.js'

/** Proven function confidences for compositional proof */
const provenFunctions = new Map<string, number>()

export class ProofEngine {
	private config: ProofEngineConfig
	private cache: Map<string, ProofResult>
	private tokenMultiplier: TokenMultiplierTracker
	private proofHistory: ProofResult[]

	constructor(config?: Partial<ProofEngineConfig>) {
		this.config = { ...DEFAULT_PROOF_CONFIG, ...config }
		this.cache = new Map()
		this.tokenMultiplier = new TokenMultiplierTracker(this.config.maxHistoryEntries)
		this.proofHistory = []
	}

	/**
	 * Run a full proof on the given code.
	 * Returns a ProofResult with per-dimension scores and overall confidence.
	 */
	async prove(code: string, filePath: string): Promise<ProofResult> {
		const startTime = Date.now()

		// Check cache
		const cacheKey = this.computeCacheKey(code, filePath)
		if (this.config.enableCaching) {
			const cached = this.cache.get(cacheKey)
			if (cached) return cached
		}

		// Build verifier context
		const context: VerifierContext = {
			code,
			filePath,
			provenConfidences: provenFunctions,
		}

		// Run all four verifiers (sequentially to conserve memory on constrained hardware)
		const mathematical = verifyMathematically(context)
		const logical = verifyLogically(context)
		const engineering = verifyEngineering(context)
		const typographical = verifyTypographically(context)

		const dimensions: Record<ProofDimension, DimensionProofScore> = {
			mathematical,
			logical,
			engineering,
			typographical,
		}

		// Compute weighted aggregate confidence
		const totalWeight = Object.values(dimensions).reduce((sum, d) => sum + d.weight, 0)
		const overallConfidence = Object.values(dimensions).reduce(
			(sum, d) => sum + d.value * d.weight,
			0,
		) / totalWeight

		// Determine pass/fail
		const passed = overallConfidence >= this.config.confidenceThreshold
		const escalationRequired = this.config.enableAutoEscalation && !passed

		// Generate escalation fixes
		const escalationFixes = escalationRequired ? this.generateEscalationFixes(dimensions) : []

		// Compute token efficiency
		const tokenEfficiency = this.computeTokenEfficiency(code, overallConfidence)

		const result: ProofResult = {
			id: `proof-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
			overallConfidence,
			dimensions,
			passed,
			escalationRequired,
			escalationFixes,
			tokenEfficiency,
			proofCacheKey: cacheKey,
			timestamp: Date.now(),
			durationMs: Date.now() - startTime,
		}

		// Cache the result
		if (this.config.enableCaching) {
			if (this.cache.size >= this.config.maxCacheSize) {
				// Evict oldest entry
				const firstKey = this.cache.keys().next().value
				if (firstKey) this.cache.delete(firstKey)
			}
			this.cache.set(cacheKey, result)
		}

		// Record in history
		this.proofHistory.push(result)
		if (this.proofHistory.length > 100) {
			this.proofHistory = this.proofHistory.slice(-100)
		}

		return result
	}

	/**
	 * Verify a single file by reading its contents.
	 */
	async proveFile(filePath: string): Promise<ProofResult> {
		const fs = await import('node:fs/promises')
		const code = await fs.readFile(filePath, 'utf-8')
		return this.prove(code, filePath)
	}

	/**
	 * Scan a directory and verify all source files.
	 */
	async proveDirectory(dirPath: string): Promise<ProofReport> {
		const fs = await import('node:fs/promises')
		const path = await import('node:path')

		const fileResults = new Map<string, ProofResult>()
		const allFindings: ProofFinding[] = []
		let filesPassing = 0
		let filesFailing = 0
		let totalConfidence = 0

		const entries = await this.walkDirectory(dirPath, fs, path)

		for (const filePath of entries) {
			try {
				const result = await this.proveFile(filePath)
				fileResults.set(filePath, result)
				allFindings.push(...result.dimensions.mathematical.findings)
				allFindings.push(...result.dimensions.logical.findings)
				allFindings.push(...result.dimensions.engineering.findings)
				allFindings.push(...result.dimensions.typographical.findings)
				totalConfidence += result.overallConfidence
				if (result.passed) filesPassing++
				else filesFailing++
			} catch {
				// Skip files that can't be read
			}
		}

		const filesAnalyzed = fileResults.size
		const averageConfidence = filesAnalyzed > 0 ? totalConfidence / filesAnalyzed : 0

		// Compute dimension averages
		const dimensionAverages: Record<ProofDimension, number> = {
			mathematical: 0,
			logical: 0,
			engineering: 0,
			typographical: 0,
		}
		for (const result of fileResults.values()) {
			for (const dim of Object.keys(dimensionAverages) as ProofDimension[]) {
				dimensionAverages[dim] += result.dimensions[dim].value
			}
		}
		for (const dim of Object.keys(dimensionAverages) as ProofDimension[]) {
			dimensionAverages[dim] = filesAnalyzed > 0 ? dimensionAverages[dim] / filesAnalyzed : 0
		}

		return {
			filesAnalyzed,
			filesPassing,
			filesFailing,
			averageConfidence,
			dimensionAverages,
			allFindings,
			tokenEfficiency: {
				correctLinesPerToken: this.tokenMultiplier.getTokenEfficiency().correctLinesPerToken,
				reworkRatio: this.tokenMultiplier.getTokenEfficiency().reworkRatio,
				usefulTokenRatio: this.tokenMultiplier.getTokenEfficiency().usefulTokenRatio,
				trend: this.tokenMultiplier.getTrend(),
			},
			fileResults,
		}
	}

	/**
	 * Record token usage for efficiency tracking.
	 */
	recordTokenUsage(proofResult: ProofResult, tokenCount: number): void {
		if (this.config.enableTokenTracking) {
			this.tokenMultiplier.recordVerification(proofResult, tokenCount)
		}
	}

	/**
	 * Get the token multiplier report for context augmentation.
	 */
	getTokenMultiplierReport() {
		return this.tokenMultiplier.getMultiplierReport()
	}

	/**
	 * Get recent proof history.
	 */
	getRecentProofs(count = 10): ProofResult[] {
		return this.proofHistory.slice(-count)
	}

	/**
	 * Register a function as proven with a given confidence.
	 * Used for compositional proof across modules.
	 */
	registerProvenFunction(name: string, confidence: number): void {
		provenFunctions.set(name, confidence)
	}

	/**
	 * Get the current configuration.
	 */
	getConfig(): ProofEngineConfig {
		return { ...this.config }
	}

	/**
	 * Clear the proof cache.
	 */
	clearCache(): void {
		this.cache.clear()
	}

	// ─── Private Helpers ──────────────────────────────────────────────────

	private computeCacheKey(code: string, filePath: string): string {
		const hash = createHash('sha256')
		hash.update(code)
		hash.update(filePath)
		return hash.digest('hex').slice(0, 16)
	}

	private computeTokenEfficiency(code: string, confidence: number): TokenEfficiencyScore {
		const eff = this.tokenMultiplier.getTokenEfficiency()
		return {
			correctLinesPerToken: eff.correctLinesPerToken || this.estimateCorrectLinesPerToken(code),
			reworkRatio: eff.reworkRatio,
			usefulTokenRatio: eff.usefulTokenRatio || this.estimateUsefulTokenRatio(code),
			trend: eff.trend,
		}
	}

	private estimateCorrectLinesPerToken(code: string): number {
		const lines = code.split('\n').filter((l) => l.trim().length > 0).length
		const tokens = Math.ceil(code.length / 4)
		return tokens > 0 ? lines / tokens : 0
	}

	private estimateUsefulTokenRatio(code: string): number {
		const tokens = code.split(/[\s\n]+/).filter(Boolean)
		if (tokens.length === 0) return 1
		const useful = tokens.filter((t) => t.length > 1 || /^[\w+\-*/%=<>!&|^~?:]$/.test(t))
		return useful.length / tokens.length
	}

	private generateEscalationFixes(dimensions: Record<ProofDimension, DimensionProofScore>): string[] {
		const fixes: string[] = []

		for (const [dimName, dimScore] of Object.entries(dimensions)) {
			if (dimScore.value >= this.config.confidenceThreshold) continue

			// Get top findings by severity
			const criticalFindings = dimScore.findings
				.filter((f) => f.severity === 'error' || f.severity === 'critical')
				.sort((a, b) => b.confidence - a.confidence)
				.slice(0, 3)

			for (const finding of criticalFindings) {
				if (finding.suggestion) {
					fixes.push(`[${dimName.toUpperCase()}] ${finding.suggestion}`)
				}
			}

			// If no critical findings, use warnings
			if (criticalFindings.length === 0) {
				const warnings = dimScore.findings
					.filter((f) => f.severity === 'warning')
					.sort((a, b) => b.confidence - a.confidence)
					.slice(0, 2)

				for (const finding of warnings) {
					if (finding.suggestion) {
						fixes.push(`[${dimName.toUpperCase()}] ${finding.suggestion}`)
					}
				}
			}
		}

		return fixes
	}

	private async walkDirectory(
		dirPath: string,
		fs: typeof import('node:fs/promises'),
		path: typeof import('node:path'),
	): Promise<string[]> {
		const extensions = ['.ts', '.tsx', '.js', '.jsx']
		const files: string[] = []

		try {
			const entries = await fs.readdir(dirPath, { withFileTypes: true })
			for (const entry of entries) {
				const fullPath = path.join(dirPath, entry.name)
				if (entry.isDirectory()) {
					if (entry.name === 'node_modules' || entry.name === '.git') continue
					files.push(...await this.walkDirectory(fullPath, fs, path))
				} else if (extensions.some((ext) => entry.name.endsWith(ext))) {
					files.push(fullPath)
				}
			}
		} catch {
			// Directory doesn't exist or can't be read
		}

		return files
	}
}
