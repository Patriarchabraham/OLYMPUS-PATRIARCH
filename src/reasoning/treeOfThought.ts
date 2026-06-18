/**
 * Tree-of-Thought reasoning — LLM-backed.
 *
 * - Beam search (width = 3): keeps top-K paths at each expansion level.
 * - Cross-path learning: boosts a new branch's score when it shares keywords
 *   with already-successful branches.
 * - Adaptive pruning: prune_threshold = best_score * 0.6 (dynamic, not fixed).
 * - Step diversity bonus: penalizes paths that are too similar to already-
 *   explored paths (cosine similarity of keyword vectors).
 * - Backtracking: if expansion degrades the best path's evaluation, roll back
 *   and try the next-best candidate.
 * - Enhanced metadata: beam stats, pruning rationale, diversity scores.
 */

import { randomUUID } from 'node:crypto'
import type { GenerateFn, ReasoningChain, ReasoningStep, TreeOfThoughtPath } from './types.js'

// ─── Prompts ──────────────────────────────────────────────────────────────────

const BRANCH_GENERATION_PROMPT = `Generate {count} different approaches to solve this problem.
Return a JSON array of objects with "approach" (string) and "steps" (string[]).

Problem: `

const EVALUATION_PROMPT = `Evaluate the quality of this reasoning path on a scale of 0.0 to 1.0.
Respond with ONLY the numeric score, nothing else.

Path: `

const EXPANSION_PROMPT = `Given this promising reasoning path:
"""
{path}
"""

And the original problem:
"""
{query}
"""

Suggest 2-3 additional steps that deepen the analysis. Return as a JSON array of strings.`

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_MAX_BRANCHES = 4
const BEAM_WIDTH = 3
const ADAPTIVE_PRUNE_FACTOR = 0.6
const DIVERSITY_PENALTY_THRESHOLD = 0.85 // cosine similarity above this → penalize
const DIVERSITY_PENALTY_AMOUNT = 0.1
const CROSS_PATH_BOOST_FACTOR = 0.08
const MAX_BACKTRACK_ATTEMPTS = 2

// ─── Types ────────────────────────────────────────────────────────────────────

interface BranchTemplate {
	approach: string
	steps: string[]
}

// ─── Utility helpers ──────────────────────────────────────────────────────────

/** Detect the domain / query type from free text. */
function detectQueryType(text: string): string {
	const lower = text.toLowerCase()
	if (/\b(bug|error|fix|crash|fail|exception|traceback)\b/.test(lower)) return 'debugging'
	if (/\b(secur|vulnerab|auth|encrypt|xss|sql injection|csrf|owasp)\b/.test(lower))
		return 'security'
	if (/\b(design|architect|plan|system|structure|microservice|monolith)\b/.test(lower))
		return 'architecture'
	if (/\b(perform|speed|optim|fast|slow|latency|throughput|bottleneck)\b/.test(lower))
		return 'performance'
	if (/\b(test|verif|valid|assert|property.based|invariant)\b/.test(lower)) return 'verification'
	if (/\b(implement|build|create|add|write|develop)\b/.test(lower)) return 'implementation'
	return 'general'
}

/** TF-IDF-lite keyword extraction. */
function extractTopKeywords(text: string): string[] {
	const stopWords = new Set([
		'the',
		'a',
		'an',
		'is',
		'are',
		'was',
		'were',
		'be',
		'been',
		'have',
		'has',
		'had',
		'do',
		'does',
		'did',
		'will',
		'would',
		'could',
		'should',
		'to',
		'of',
		'in',
		'for',
		'on',
		'with',
		'at',
		'by',
		'from',
		'as',
		'into',
		'through',
		'and',
		'or',
		'if',
		'not',
		'this',
		'that',
		'it',
		'i',
		'me',
		'my',
		'we',
		'our',
		'you',
		'your',
		'but',
		'about',
		'what',
		'how',
		'why',
		'when',
		'where',
		'which',
		'who',
		'can',
		'may',
	])
	const words = text
		.toLowerCase()
		.replace(/[^a-z0-9\s_]/g, ' ')
		.split(/\s+/)
	const freq = new Map<string, number>()
	for (const w of words) {
		if (w.length > 2 && !stopWords.has(w)) {
			freq.set(w, (freq.get(w) ?? 0) + 1)
		}
	}
	return [...freq.entries()]
		.sort((a, b) => b[1] - a[1])
		.slice(0, 10)
		.map(([w]) => w)
}

/** Build a keyword-frequency vector from a list of thoughts (bag-of-words). */
function buildKeywordVector(thoughts: string[]): Map<string, number> {
	const vec = new Map<string, number>()
	const text = thoughts
		.join(' ')
		.toLowerCase()
		.replace(/[^a-z0-9\s_]/g, ' ')
	for (const w of text.split(/\s+/)) {
		if (w.length > 2) {
			vec.set(w, (vec.get(w) ?? 0) + 1)
		}
	}
	return vec
}

/** Cosine similarity between two keyword-frequency vectors. */
function cosineSimilarity(a: Map<string, number>, b: Map<string, number>): number {
	let dot = 0
	let normA = 0
	let normB = 0
	for (const [k, va] of a) {
		normA += va * va
		const vb = b.get(k) ?? 0
		dot += va * vb
	}
	for (const [, vb] of b) {
		normB += vb * vb
	}
	const denom = Math.sqrt(normA) * Math.sqrt(normB)
	return denom > 0 ? dot / denom : 0
}

/**
 * Compute the maximum cosine similarity between `candidate` and any vector
 * in `existingVectors`.  Used for the diversity penalty.
 */
function maxSimilarityToExisting(
	candidate: Map<string, number>,
	existingVectors: Map<string, number>[],
): number {
	if (existingVectors.length === 0) return 0
	let max = 0
	for (const v of existingVectors) {
		const sim = cosineSimilarity(candidate, v)
		if (sim > max) max = sim
	}
	return max
}

/**
 * Cross-path Learning boost.
 * Returns a bonus ∈ [0, CROSS_PATH_BOOST_FACTOR] proportional to keyword
 * overlap with successful (above-median) paths.
 */
function crossPathBoost(
	candidateVec: Map<string, number>,
	successfulVecs: Map<string, number>[],
): number {
	if (successfulVecs.length === 0) return 0
	let totalSim = 0
	for (const sv of successfulVecs) {
		totalSim += cosineSimilarity(candidateVec, sv)
	}
	const avgSim = totalSim / successfulVecs.length
	return avgSim * CROSS_PATH_BOOST_FACTOR
}

// ─── Parsing helpers ──────────────────────────────────────────────────────────

function parseEvaluation(raw: string): number {
	const match = raw.match(/(\d+\.?\d*)/)
	if (match) {
		return Math.max(0, Math.min(1, parseFloat(match[1]!)))
	}
	return 0.5
}

function parseBranches(raw: string): BranchTemplate[] {
	try {
		const jsonMatch = raw.match(/\[[\s\S]*\]/)
		if (jsonMatch) {
			const parsed = JSON.parse(jsonMatch[0]) as Array<{ approach?: string; steps?: string[] }>
			return parsed
				.filter((b) => b.approach && Array.isArray(b.steps))
				.map((b) => ({ approach: b.approach!, steps: b.steps! }))
		}
	} catch {
		/* fall through */
	}
	return [
		{
			approach: 'Default analytical approach',
			steps: ['Analyze the problem', 'Generate solution', 'Verify result'],
		},
	]
}

function parseExpansion(raw: string): string[] {
	try {
		const jsonMatch = raw.match(/\[[\s\S]*\]/)
		if (jsonMatch) {
			return JSON.parse(jsonMatch[0]) as string[]
		}
	} catch {
		/* fall through */
	}
	return ['Continue reasoning deeper into the problem space']
}

// ─── Beam search core ─────────────────────────────────────────────────────────

interface BeamCandidate {
	path: TreeOfThoughtPath
	keywordVec: Map<string, number>
	diversityScore: number
	crossPathBonus: number
	adjustedScore: number
	pruneReason?: string
}

/**
 * Run beam search over the candidate paths.
 *
 * 1. Score each candidate (evaluation + cross-path boost − diversity penalty).
 * 2. Sort by adjusted score and keep top `beamWidth`.
 * 3. Mark the rest as pruned (adaptive threshold).
 */
function beamSelect(
	candidates: BeamCandidate[],
	beamWidth: number,
): { selected: BeamCandidate[]; pruned: BeamCandidate[] } {
	if (candidates.length === 0) return { selected: [], pruned: [] }

	// Sort descending by adjusted score
	const sorted = [...candidates].sort((a, b) => b.adjustedScore - a.adjustedScore)
	const bestScore = sorted[0]!.adjustedScore
	const adaptiveThreshold = bestScore * ADAPTIVE_PRUNE_FACTOR

	const selected: BeamCandidate[] = []
	const pruned: BeamCandidate[] = []

	for (let i = 0; i < sorted.length; i++) {
		const c = sorted[i]!
		if (i < beamWidth && c.adjustedScore >= adaptiveThreshold) {
			selected.push(c)
		} else {
			c.path.pruned = true
			c.pruneReason =
				i >= beamWidth
					? `Outside beam width (rank ${i + 1} > ${beamWidth})`
					: `Below adaptive threshold (${c.adjustedScore.toFixed(3)} < ${adaptiveThreshold.toFixed(3)})`
			pruned.push(c)
		}
	}

	return { selected, pruned }
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Run Tree-of-Thought reasoning with beam search, cross-path learning,
 * adaptive pruning, diversity bonuses, and backtracking.
 *
 * @param query        The problem to reason about.
 * @param context      Optional additional context.
 * @param maxBranches  Maximum initial branches to generate (default 4).
 * @param generateFn   LLM generation function (required — no fallback).
 * @returns            A `ReasoningChain` with enhanced metadata.
 */
export async function runTreeOfThought(
	query: string,
	context?: string,
	maxBranches?: number,
	generateFn?: GenerateFn,
): Promise<ReasoningChain> {
	if (!generateFn) {
		throw new Error('runTreeOfThought requires a real GenerateFn — no LLM available')
	}
	const generate = generateFn
	const branches = maxBranches ?? DEFAULT_MAX_BRANCHES
	const startTime = Date.now()

	const fullQuery = context ? `Context: ${context}\n\n${query}` : query
	const queryType = detectQueryType(fullQuery)
	const queryKeywords = extractTopKeywords(fullQuery)

	// ── Phase 1: Generate initial branches ────────────────────────────────────
	const branchPrompt = BRANCH_GENERATION_PROMPT.replace('{count}', String(branches)) + fullQuery
	const rawBranches = await generate(branchPrompt)
	const parsedBranches = parseBranches(rawBranches)

	// ── Phase 2: Evaluate each branch & build beam candidates ─────────────────
	const candidates: BeamCandidate[] = []
	const evaluatedVectors: Map<string, number>[] = []

	for (const branch of parsedBranches) {
		const evalPrompt = `${EVALUATION_PROMPT + branch.approach}\nSteps:\n${branch.steps.join('\n')}`
		const evalRaw = await generate(evalPrompt)
		const baseEval = parseEvaluation(evalRaw)

		const thoughts = [branch.approach, ...branch.steps]
		const keywordVec = buildKeywordVector(thoughts)

		// Cross-path boost: reward shared keywords with already-successful branches
		const successfulVecs = candidates
			.filter((c) => c.path.evaluation >= 0.5)
			.map((c) => c.keywordVec)
		const boost = crossPathBoost(keywordVec, successfulVecs)

		// Diversity penalty: penalize if too similar to an existing candidate
		const maxSim = maxSimilarityToExisting(keywordVec, evaluatedVectors)
		const diversityPenalty = maxSim > DIVERSITY_PENALTY_THRESHOLD ? DIVERSITY_PENALTY_AMOUNT : 0
		const diversityScore = 1 - maxSim

		const adjustedScore = Math.max(0, Math.min(1, baseEval + boost - diversityPenalty))

		const path: TreeOfThoughtPath = {
			id: randomUUID(),
			thoughts,
			evaluation: baseEval,
			explored: false,
			pruned: false,
		}

		candidates.push({
			path,
			keywordVec,
			diversityScore,
			crossPathBonus: boost,
			adjustedScore,
		})
		evaluatedVectors.push(keywordVec)
	}

	// ── Phase 3: Beam selection with adaptive pruning ─────────────────────────
	const { selected, pruned } = beamSelect(candidates, BEAM_WIDTH)

	// Build pruning rationale log
	const pruningLog = pruned.map((c) => ({
		approach: c.path.thoughts[0],
		rawEval: c.path.evaluation,
		adjustedScore: c.adjustedScore,
		reason: c.pruneReason ?? 'pruned',
	}))

	// ── Phase 4: Expand best path with backtracking ───────────────────────────
	let bestCandidate: BeamCandidate | undefined
	let backtrackCount = 0
	const backtrackLog: Array<{ attempt: number; approach: string; reason: string }> = []

	// Try expanding paths in beam order; backtrack if expansion degrades quality
	const expansionQueue = [...selected]

	while (expansionQueue.length > 0 && backtrackCount <= MAX_BACKTRACK_ATTEMPTS) {
		const candidate = expansionQueue.shift()!
		const expandPrompt = EXPANSION_PROMPT.replace(
			'{path}',
			candidate.path.thoughts.join('\n'),
		).replace('{query}', fullQuery)
		const expansionRaw = await generate(expandPrompt)
		const expandedSteps = parseExpansion(expansionRaw)

		// Snapshot pre-expansion thoughts for potential rollback
		const preExpansionThoughts = [...candidate.path.thoughts]

		candidate.path.thoughts.push(...expandedSteps)
		candidate.path.explored = true

		// Re-evaluate after expansion
		const reEvalPrompt = EVALUATION_PROMPT + candidate.path.thoughts.join('\n')
		const reEvalRaw = await generate(reEvalPrompt)
		const postExpansionEval = parseEvaluation(reEvalRaw)

		if (postExpansionEval < candidate.path.evaluation * 0.75 && expansionQueue.length > 0) {
			// Expansion degraded quality → backtrack
			backtrackLog.push({
				attempt: backtrackCount + 1,
				approach: preExpansionThoughts[0] ?? 'unknown',
				reason: `Post-expansion eval ${postExpansionEval.toFixed(3)} < 75% of pre-expansion ${candidate.path.evaluation.toFixed(3)}`,
			})
			// Rollback
			candidate.path.thoughts = preExpansionThoughts
			candidate.path.explored = false
			backtrackCount++
			continue
		}

		// Accept this candidate as the best
		candidate.path.evaluation = postExpansionEval
		candidate.adjustedScore = postExpansionEval + candidate.crossPathBonus
		bestCandidate = candidate
		break
	}

	// Fallback: if no candidate survived expansion, use the highest-scored selected
	if (!bestCandidate) {
		if (selected.length > 0) {
			bestCandidate = selected.reduce((a, b) => (a.adjustedScore > b.adjustedScore ? a : b))
			bestCandidate.path.explored = true
		} else {
			// Ultimate fallback
			bestCandidate = {
				path: {
					id: randomUUID(),
					thoughts: ['Fallback: analyze the problem directly'],
					evaluation: 0.5,
					explored: true,
					pruned: false,
				},
				keywordVec: new Map(),
				diversityScore: 1,
				crossPathBonus: 0,
				adjustedScore: 0.5,
			}
		}
	}

	const bestPath = bestCandidate.path

	// ── Phase 5: Build reasoning chain from the best path ─────────────────────
	const stepTypes: ReasoningStep['type'][] = [
		'analysis',
		'decomposition',
		'hypothesis',
		'verification',
		'synthesis',
	]
	const steps: ReasoningStep[] = bestPath.thoughts.map((thought, i) => ({
		id: randomUUID(),
		type: stepTypes[Math.min(i, stepTypes.length - 1)]!,
		content: thought,
		confidence: bestPath.evaluation * (1 - i * 0.03), // Gradual confidence decay per step
	}))

	// Ensure a synthesis step exists at the end
	const hasSynthesis = steps.some((s) => s.type === 'synthesis')
	if (!hasSynthesis && steps.length > 0) {
		steps.push({
			id: randomUUID(),
			type: 'synthesis',
			content: `Synthesis: integrated reasoning from ${steps.length} steps across ${queryType} domain.`,
			confidence: bestPath.evaluation,
		})
	}

	// ── Phase 6: Assemble result with enhanced metadata ───────────────────────
	const allPaths = [...candidates.map((c) => c.path)]
	const prunedCount = allPaths.filter((p) => p.pruned).length
	const exploredCount = allPaths.filter((p) => p.explored).length

	// Diversity scores for selected paths
	const diversityScores = selected.map((c) => ({
		approach: c.path.thoughts[0],
		diversity: c.diversityScore,
		crossPathBonus: c.crossPathBonus,
		adjustedScore: c.adjustedScore,
	}))

	return {
		id: randomUUID(),
		strategy: 'tot',
		query,
		steps,
		conclusion: steps[steps.length - 1]?.content ?? 'Tree-of-thought exploration complete.',
		confidence: bestPath.evaluation,
		durationMs: Date.now() - startTime,
		timestamp: Date.now(),
		metadata: {
			// Core stats
			domain: queryType,
			queryKeywords: queryKeywords.slice(0, 5),
			totalPaths: allPaths.length,
			prunedPaths: prunedCount,
			exploredPaths: exploredCount,
			bestPathEvaluation: bestPath.evaluation,

			// Beam search stats
			beamWidth: BEAM_WIDTH,
			beamCandidatesConsidered: candidates.length,
			beamSurvivors: selected.length,

			// Adaptive pruning
			adaptivePruneThreshold:
				selected.length > 0 ? selected[0]!.adjustedScore * ADAPTIVE_PRUNE_FACTOR : 0,
			pruningLog,

			// Backtracking
			backtrackAttempts: backtrackCount,
			backtrackLog,

			// Diversity & cross-path learning
			diversityScores,
			diversityPenaltyThreshold: DIVERSITY_PENALTY_THRESHOLD,
			crossPathBoostFactor: CROSS_PATH_BOOST_FACTOR,

			// Alternative approaches that survived pruning
			alternativeApproaches: selected
				.filter((c) => c.path.id !== bestPath.id)
				.map((c) => ({
					approach: c.path.thoughts[0],
					rawEvaluation: c.path.evaluation,
					adjustedScore: c.adjustedScore,
					diversityScore: c.diversityScore,
				})),
		},
	}
}
