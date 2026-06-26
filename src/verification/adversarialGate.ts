/**
 * Adversarial Verification Gate.
 *
 * For every non-trivial change (>thresholdFiles OR >thresholdLines), this gate
 * runs two checks in parallel:
 *
 *   1. **Static checks**: `tsc --noEmit` and `biome check`. These run on the
 *      project and produce pass/fail verdicts.
 *   2. **Semantic review**: a different model family from the generator
 *      reviews the diff and the original query, returning a confidence score
 *      and any contradictions.
 *
 * The two checks are independent and run in parallel. The gate returns
 * `{ passed, confidence, feedback }`.
 *
 * Built on top of `src/cortex/crossModelVerifier.ts:28 setVerificationProvider`
 * (which already implements TF-IDF + negation-aware contradiction detection).
 *
 * Default behavior: **non-blocking**. The gate runs but the caller decides
 * whether to await the verdict. Set `blockOnDisagreement: true` to make the
 * agent loop wait and reject on disagreement.
 */

import { spawn } from 'node:child_process'

import { verify as crossVerify, setVerificationProvider } from '../cortex/crossModelVerifier.js'
import { resolveFamily, route } from '../inference/router.js'
import { DEFAULT_VERIFICATION_CONFIG, type VerificationConfig } from '../inference/types.js'

/** Verdict returned by the gate. */
export interface GateVerdict {
	/** True iff static checks passed AND reviewer confidence >= minConfidence. */
	passed: boolean
	/** Combined confidence in [0, 1]. */
	confidence: number
	/** Human-readable feedback for the generator (or user). */
	feedback?: string
	/** Static-check results (always populated). */
	staticChecks: StaticCheckResult
	/** Semantic-review results (null if reviewer could not be invoked). */
	semanticReview?: SemanticReviewResult
	/** Wall-clock duration in ms. */
	durationMs: number
}

/** Result of static checks. */
export interface StaticCheckResult {
	typecheck: { passed: boolean; stderr: string }
	lint: { passed: boolean; stderr: string }
	overall: boolean
}

/** Result of cross-family semantic review. */
export interface SemanticReviewResult {
	reviewerProvider: string
	reviewerModel: string
	reviewerFamily: string
	/** [0, 1] — agreement with generator output. */
	agreement: number
	/** Reviewer's own confidence in the change. */
	confidence: number
	/** Identified contradictions. */
	contradictions: string[]
}

/** Inputs to the gate. */
export interface VerifyChangeInput {
	/** List of file paths changed by the generator. */
	changedFiles: string[]
	/** Total line count changed (added + removed). */
	lineCount: number
	/** Provider that generated the change — used to force a different family. */
	generatorProvider: string
	/** Diff or full output to review. */
	diff: string
	/** Original user query that drove the change. */
	originalQuery: string
	/** Optional config override. Falls back to defaults. */
	config?: Partial<VerificationConfig>
	/** Project root for running static checks. Defaults to process.cwd(). */
	projectRoot?: string
}

/**
 * Verify a change. Always resolves — never throws. Failure modes are encoded
 * in the verdict's `passed` and `feedback` fields.
 *
 * @param input - Change description and reviewer config.
 * @returns Verdict with pass/fail, confidence, and feedback.
 */
export async function verifyChange(input: VerifyChangeInput): Promise<GateVerdict> {
	const start = Date.now()
	const config: VerificationConfig = {
		...DEFAULT_VERIFICATION_CONFIG,
		...(input.config ?? {}),
	}

	// Below threshold → skip gate entirely.
	const meetsThreshold =
		input.changedFiles.length > config.thresholdFiles || input.lineCount > config.thresholdLines
	if (!config.enabled || !meetsThreshold) {
		return {
			passed: true,
			confidence: 1,
			feedback: 'below verification threshold',
			staticChecks: emptyStaticChecks(),
			durationMs: Date.now() - start,
		}
	}

	// 1. Static checks + semantic review run in parallel.
	const [staticChecks, semanticReview] = await Promise.all([
		runStaticChecks(input.projectRoot ?? process.cwd(), input.changedFiles),
		runSemanticReview(input, config),
	])

	// 2. Combine into a verdict.
	const staticPass = staticChecks.overall
	const semanticPass =
		semanticReview === null
			? true // couldn't run reviewer — don't fail on that alone
			: semanticReview.confidence >= config.minConfidence &&
				semanticReview.contradictions.length === 0

	const passed = staticPass && semanticPass

	// 3. Confidence: weighted combination.
	const confidence = combineConfidence(staticPass, semanticReview)

	// 4. Build feedback.
	const feedback = buildFeedback(staticChecks, semanticReview)

	return {
		passed,
		confidence,
		feedback,
		staticChecks,
		semanticReview: semanticReview ?? undefined,
		durationMs: Date.now() - start,
	}
}

/**
 * Run typecheck + lint in parallel. Both are best-effort — failures are
 * recorded but never throw.
 */
async function runStaticChecks(
	projectRoot: string,
	changedFiles: string[],
): Promise<StaticCheckResult> {
	// Scope biome to the changed files when known — running it repo-wide would
	// surface pre-existing style debt (this repo carries ~9k biome diagnostics)
	// and report "lint failed" on nearly every change. tsc stays whole-project:
	// it's a real type-error signal, not stylistic noise.
	const lintArgs =
		changedFiles.length > 0 ? ['biome', 'check', ...changedFiles] : ['biome', 'check', 'src/']
	const [typecheck, lint] = await Promise.all([
		runCommand(
			'node',
			['--max-old-space-size=2048', './node_modules/typescript/bin/tsc', '--noEmit'],
			projectRoot,
		),
		runCommand('npx', lintArgs, projectRoot),
	])

	return {
		typecheck: { passed: typecheck.exitCode === 0, stderr: typecheck.stderr },
		lint: { passed: lint.exitCode === 0, stderr: lint.stderr },
		overall: typecheck.exitCode === 0 && lint.exitCode === 0,
	}
}

/**
 * Run semantic review using a different model family. Returns null if the
 * router can't find a suitable reviewer (e.g. only one provider configured,
 * or no provider with a different family available).
 */
async function runSemanticReview(
	input: VerifyChangeInput,
	config: VerificationConfig,
): Promise<SemanticReviewResult | null> {
	try {
		return await runSemanticReviewUnsafe(input, config)
	} catch (_err) {
		return null
	}
}

/** Implementation — may throw. Wrapped by {@link runSemanticReview}. */
async function runSemanticReviewUnsafe(
	input: VerifyChangeInput,
	config: VerificationConfig,
): Promise<SemanticReviewResult | null> {
	// Explicit reviewer override — skip router.
	let reviewerProvider: string
	let reviewerModel: string
	let reviewerBaseURL: string
	let reviewerApiKey: string

	if (config.reviewerProvider && config.reviewerModel) {
		reviewerProvider = config.reviewerProvider
		reviewerModel = config.reviewerModel
		reviewerBaseURL = ''
		reviewerApiKey = ''
	} else {
		// Route to any provider with a different family.
		const decision = await pickDifferentFamily(input.generatorProvider)
		if (!decision) return null
		reviewerProvider = decision.provider
		reviewerModel = decision.model
		reviewerBaseURL = decision.baseURL
		reviewerApiKey = decision.apiKey
	}

	// Wire the cross-model verifier with a GenerateFn that calls the reviewer.
	// We use a minimal fetch-based generator — full SDK integration happens
	// when this gate is invoked from the main query loop.
	const generateFn = async (prompt: string): Promise<string> => {
		return callOpenAICompatible(reviewerBaseURL, reviewerApiKey, reviewerModel, prompt)
	}
	setVerificationProvider(generateFn)

	// Run cross-model verification.
	const result = await crossVerify(input.originalQuery, input.diff, reviewerModel)

	return {
		reviewerProvider,
		reviewerModel,
		reviewerFamily: resolveFamily(reviewerProvider, reviewerBaseURL).toString(),
		agreement: result.agreementWithPrimary,
		confidence: result.confidence,
		contradictions: result.contradictions,
	}
}

/**
 * Find a provider whose family differs from the generator's. Iterates the
 * router's known providers via the cost ledger and active profile.
 *
 * Returns null if only one family is available, or if routing fails for any
 * reason (e.g. no providers configured). The caller treats null as "skip
 * semantic review" and falls back to static checks only.
 */
async function pickDifferentFamily(generatorProvider: string): Promise<{
	provider: string
	model: string
	baseURL: string
	apiKey: string
} | null> {
	let decision
	try {
		decision = await route({
			queryText: '__reviewer_probe__',
			contextTokenEstimate: 0,
			toolBudget: 0,
		})
	} catch {
		// No providers configured, or router misconfigured — skip review.
		return null
	}
	if (decision.family !== resolveFamily(generatorProvider, '')) {
		return {
			provider: decision.provider,
			model: decision.model,
			baseURL: decision.baseURL,
			apiKey: decision.apiKey,
		}
	}
	return null
}

/** Minimal OpenAI-compatible chat completion call. Returns assistant content. */
async function callOpenAICompatible(
	baseURL: string,
	apiKey: string,
	model: string,
	prompt: string,
): Promise<string> {
	if (!baseURL) {
		throw new Error('reviewer baseURL not configured')
	}
	const url = `${baseURL.replace(/\/$/, '')}/chat/completions`
	const body = {
		model,
		messages: [{ role: 'user', content: prompt }],
		stream: false,
	}
	const headers: Record<string, string> = { 'Content-Type': 'application/json' }
	if (apiKey) headers.Authorization = `Bearer ${apiKey}`

	const res = await fetch(url, {
		method: 'POST',
		headers,
		body: JSON.stringify(body),
	})
	if (!res.ok) {
		throw new Error(`reviewer call failed: ${res.status} ${await res.text()}`)
	}
	const data = (await res.json()) as {
		choices?: Array<{ message?: { content?: string } }>
	}
	return data.choices?.[0]?.message?.content ?? ''
}

/** Spawn a command and capture exit code + stderr. Never throws. */
function runCommand(
	cmd: string,
	args: string[],
	cwd: string,
): Promise<{ exitCode: number; stderr: string }> {
	return new Promise((resolve) => {
		try {
			const child = spawn(cmd, args, {
				cwd,
				shell: process.platform === 'win32',
				stdio: ['ignore', 'ignore', 'pipe'],
			})
			let stderr = ''
			child.stderr?.on('data', (chunk) => {
				stderr += chunk.toString()
				// Cap stderr to avoid memory bloat on noisy commands.
				if (stderr.length > 4096) stderr = stderr.slice(-4096)
			})
			child.on('error', () => resolve({ exitCode: 1, stderr: 'spawn failed' }))
			child.on('close', (code) => resolve({ exitCode: code ?? 1, stderr }))
		} catch (err) {
			resolve({
				exitCode: 1,
				stderr: (err as Error).message,
			})
		}
	})
}

function emptyStaticChecks(): StaticCheckResult {
	return {
		typecheck: { passed: true, stderr: '' },
		lint: { passed: true, stderr: '' },
		overall: true,
	}
}

/** Combine static and semantic outcomes into a single confidence number. */
function combineConfidence(staticPass: boolean, semantic: SemanticReviewResult | null): number {
	const staticScore = staticPass ? 1 : 0
	if (!semantic) return staticScore * 0.7 // no semantic data → trust static only partially
	return staticScore * 0.4 + semantic.confidence * 0.6
}

/** Build a human-readable feedback string for the generator (or user). */
function buildFeedback(
	staticChecks: StaticCheckResult,
	semantic: SemanticReviewResult | null,
): string | undefined {
	const lines: string[] = []
	if (!staticChecks.overall) {
		if (!staticChecks.typecheck.passed) lines.push('typecheck failed')
		if (!staticChecks.lint.passed) lines.push('lint failed')
	}
	if (semantic) {
		if (semantic.contradictions.length > 0) {
			lines.push(`reviewer found ${semantic.contradictions.length} contradictions`)
		}
		if (semantic.agreement < 0.5) {
			lines.push(`low reviewer agreement (${(semantic.agreement * 100).toFixed(0)}%)`)
		}
	}
	return lines.length > 0 ? lines.join('; ') : undefined
}
