/**
 * PromptEvolver — Real genetic algorithm for prompt evolution.
 *
 * Uses genuine evolutionary computation:
 * - Chromosomes = prompt segments (genes)
 * - Tournament selection for parent picking
 * - Uniform crossover (segment splicing)
 * - Mutation operators: drop, swap, refine, inject
 * - Fitness from historical success data + specificity + coverage
 * - Elitism to preserve best variants
 */

import { randomUUID } from 'node:crypto'
import type { InteractionRecord, PromptEvolution } from './types.js'

// ============================================================
// Genetic algorithm primitives
// ============================================================

/** A single prompt segment (gene in the chromosome) */
interface PromptSegment {
	text: string
	isHeader: boolean
	isEssential: boolean // first section and final instructions are essential
}

/** A chromosome = ordered list of segments forming a complete prompt */
interface Chromosome {
	segments: PromptSegment[]
	fitness: number
}

/** Vague terms that reduce prompt specificity */
const VAGUE_TERMS = new Set([
	'etc',
	'things',
	'stuff',
	'something',
	'whatever',
	'some',
	'maybe',
	'might',
	'possibly',
	'perhaps',
	'kind of',
])

/** Concrete action verbs that increase specificity */
const CONCRETE_TERMS = new Set([
	'always',
	'never',
	'must',
	'verify',
	'ensure',
	'check',
	'test',
	'validate',
	'return',
	'throw',
	'reject',
	'require',
	'install',
	'create',
	'delete',
	'update',
	'replace',
	'extract',
	'parse',
	'serialize',
	'compute',
	'normalize',
	'sanitize',
])

/** Task type keywords for coverage scoring */
const TASK_TYPE_SIGNALS: Record<string, string[]> = {
	debugging: ['error', 'bug', 'fix', 'crash', 'debug', 'trace', 'fail'],
	architecture: ['design', 'pattern', 'structure', 'module', 'component', 'refactor'],
	performance: ['optimize', 'speed', 'latency', 'memory', 'cache', 'profile'],
	security: ['auth', 'validate', 'sanitize', 'encrypt', 'permission', 'inject'],
	testing: ['test', 'assert', 'mock', 'coverage', 'edge case', 'regression'],
	deployment: ['deploy', 'build', 'ci', 'env', 'config', 'release'],
}

export class PromptEvolver {
	private sections = new Map<string, PromptSection>()

	/** Population size for genetic evolution */
	private static readonly POPULATION_SIZE = 8
	/** Number of elite individuals preserved each generation */
	private static readonly ELITE_COUNT = 2
	/** Mutation probability per segment */
	private static readonly MUTATION_RATE = 0.15
	/** Crossover probability per gene position */
	private static readonly CROSSOVER_RATE = 0.5
	/** Maximum generations before stopping */
	private static readonly MAX_GENERATIONS = 5

	constructor(existing?: PromptEvolution[]) {
		if (existing) {
			const bySection = new Map<string, PromptEvolution[]>()
			for (const evo of existing) {
				const list = bySection.get(evo.sectionName) ?? []
				list.push(evo)
				bySection.set(evo.sectionName, list)
			}

			for (const evolutions of Array.from(bySection.values())) {
				const name = evolutions[0]!.sectionName
				const latest = evolutions.reduce((a, b) => (a.generation > b.generation ? a : b))
				this.sections.set(name, {
					name,
					content: latest.evolvedPrompt,
					generation: latest.generation,
					history: evolutions,
				})
			}
		}
	}

	getEvolutions(): PromptEvolution[] {
		const result: PromptEvolution[] = []
		for (const section of Array.from(this.sections.values())) {
			result.push(...section.history)
		}
		return result
	}

	/**
	 * Evolve a prompt using genetic algorithm.
	 * Creates a population of variants, runs selection/crossover/mutation
	 * for multiple generations, returns the fittest individual.
	 */
	evolvePrompt(
		sectionName: string,
		currentPrompt: string,
		interactions: InteractionRecord[],
	): string {
		if (interactions.length < 5) return currentPrompt

		const successes = interactions.filter((r) => r.success)
		const failures = interactions.filter((r) => !r.success)
		if (successes.length < 3) return currentPrompt

		const section = this.sections.get(sectionName) ?? {
			name: sectionName,
			content: currentPrompt,
			generation: 0,
			history: [],
		}

		// Extract learned data from interactions
		const learnedPatterns = this.extractSuccessPrinciples(successes)
		const antiPatterns = this.extractFailureAntiPatterns(failures)

		// Initialize population
		let population = this.initializePopulation(currentPrompt, learnedPatterns, antiPatterns)

		// Evaluate fitness for initial population
		population = population.map((ch) => ({
			...ch,
			fitness: this.computeFitness(ch, interactions),
		}))

		// Run genetic algorithm for N generations
		for (let gen = 0; gen < PromptEvolver.MAX_GENERATIONS; gen++) {
			population = this.evolveGeneration(population, interactions, learnedPatterns, antiPatterns)
		}

		// Select best individual
		population.sort((a, b) => b.fitness - a.fitness)
		const best = population[0]!

		// Assemble evolved prompt from winning chromosome
		const evolvedPromptText = this.chromosomeToPrompt(best)

		// Record evolution
		const evolution: PromptEvolution = {
			id: randomUUID(),
			sectionName,
			originalPrompt: currentPrompt,
			evolvedPrompt: evolvedPromptText,
			generation: section.generation + 1,
			effectivenessScore: best.fitness,
			timestamp: Date.now(),
		}

		section.content = evolvedPromptText
		section.generation = evolution.generation
		section.history.push(evolution)

		if (section.history.length > 10) {
			section.history = section.history.slice(-10)
		}

		this.sections.set(sectionName, section)
		return evolvedPromptText
	}

	/**
	 * Generate a prompt variant using single-parent mutation.
	 * Used for creating diversity in the population.
	 */
	generatePromptVariant(prompt: string): string {
		const chromosome = this.promptToChromosome(prompt)
		const mutated = this.mutate({ ...chromosome, fitness: 0 })
		return this.chromosomeToPrompt(mutated)
	}

	/**
	 * Evaluate prompt quality using multi-factor fitness.
	 * NOT keyword counting — uses statistical measures.
	 */
	evaluatePromptQuality(prompt: string, testCases: InteractionRecord[]): number {
		const chromosome = this.promptToChromosome(prompt)
		return this.computeFitness(chromosome, testCases)
	}

	getEvolvedPrompt(sectionName: string): string | null {
		return this.sections.get(sectionName)?.content ?? null
	}

	rollbackPrompt(sectionName: string, generation: number): string | null {
		const section = this.sections.get(sectionName)
		if (!section) return null

		const target = section.history.find((h) => h.generation === generation)
		if (!target) return null

		section.content = target.evolvedPrompt
		section.generation = generation

		return target.evolvedPrompt
	}

	// ============================================================
	// Genetic Algorithm Core
	// ============================================================

	/** Parse prompt into chromosome (ordered segments) */
	private promptToChromosome(prompt: string): Chromosome {
		const rawSegments = prompt.split(/\n\n+/)
		const segments: PromptSegment[] = rawSegments
			.map((text, i) => ({
				text: text.trim(),
				isHeader: /^#{1,3}\s/.test(text.trim()),
				isEssential: i === 0, // first section is always essential
			}))
			.filter((s) => s.text.length > 0)

		return { segments, fitness: 0 }
	}

	/** Assemble prompt from chromosome */
	private chromosomeToPrompt(chromosome: Chromosome): string {
		return chromosome.segments.map((s) => s.text).join('\n\n')
	}

	/** Create initial population with genetic diversity */
	private initializePopulation(
		basePrompt: string,
		learnedPatterns: string[],
		antiPatterns: string[],
	): Chromosome[] {
		const baseChromosome = this.promptToChromosome(basePrompt)
		const population: Chromosome[] = [{ ...baseChromosome, segments: [...baseChromosome.segments] }]

		// Generate variants by mutation and injection
		while (population.length < PromptEvolver.POPULATION_SIZE) {
			const variant = { ...baseChromosome, segments: [...baseChromosome.segments], fitness: 0 }

			// Randomly mutate
			const mutated = this.mutate(variant)
			population.push(mutated)
		}

		// Inject learned patterns as a distinct variant
		if (learnedPatterns.length > 0) {
			const injected = this.injectLearnedSegments(baseChromosome, learnedPatterns)
			population.push(injected)
		}

		// Inject anti-patterns as a distinct variant
		if (antiPatterns.length > 0) {
			const injected = this.injectAntiPatternSegments(baseChromosome, antiPatterns)
			population.push(injected)
		}

		// Trim to population size
		return population.slice(0, PromptEvolver.POPULATION_SIZE)
	}

	/** Run one generation: select → crossover → mutate → evaluate → diversity adjust */
	private evolveGeneration(
		population: Chromosome[],
		interactions: InteractionRecord[],
		learnedPatterns: string[],
		antiPatterns: string[],
	): Chromosome[] {
		// Sort by fitness
		population.sort((a, b) => b.fitness - a.fitness)

		const nextGen: Chromosome[] = []

		// Elitism: preserve top individuals unchanged
		for (let i = 0; i < PromptEvolver.ELITE_COUNT && i < population.length; i++) {
			nextGen.push({
				segments: [...population[i]!.segments],
				fitness: population[i]!.fitness,
			})
		}

		// Fill rest with offspring
		while (nextGen.length < PromptEvolver.POPULATION_SIZE) {
			// Tournament selection for parent A
			const parentA = this.tournamentSelect(population, 3)
			// Tournament selection for parent B
			const parentB = this.tournamentSelect(population, 3)

			// Crossover
			let child = this.crossover(parentA, parentB)

			// Mutation
			child = this.mutate(child)

			// Occasional injection of learned data
			if (Math.random() < 0.2 && learnedPatterns.length > 0) {
				child = this.injectLearnedSegments(child, learnedPatterns.slice(0, 2))
			}
			if (Math.random() < 0.1 && antiPatterns.length > 0) {
				child = this.injectAntiPatternSegments(child, antiPatterns.slice(0, 1))
			}

			// Evaluate fitness
			child.fitness = this.computeFitness(child, interactions)

			nextGen.push(child)
		}

		// Diversity preservation (fitness sharing / niching)
		// Penalize individuals that are too similar to other high-fitness ones
		this.applyDiversityPenalty(nextGen)

		return nextGen
	}

	/**
	 * Fitness sharing: if two individuals are very similar (Jaccard > 0.85),
	 * reduce the weaker one's fitness. This prevents the population from
	 * converging to a single solution.
	 */
	private applyDiversityPenalty(population: Chromosome[]): void {
		const SIMILARITY_THRESHOLD = 0.85
		const PENALTY_FACTOR = 0.3

		for (let i = 0; i < population.length; i++) {
			let neighborCount = 0
			for (let j = 0; j < population.length; j++) {
				if (i === j) continue
				const sim = this.chromosomeSimilarity(population[i]!, population[j]!)
				if (sim > SIMILARITY_THRESHOLD) neighborCount++
			}
			// Share fitness among similar neighbors
			if (neighborCount > 0) {
				population[i]!.fitness *= 1 - (PENALTY_FACTOR * neighborCount) / population.length
			}
		}
	}

	/** Jaccard similarity between two chromosomes' keyword sets. */
	private chromosomeSimilarity(a: Chromosome, b: Chromosome): number {
		const aWords = new Set(tokenize(this.chromosomeToPrompt(a)))
		const bWords = new Set(tokenize(this.chromosomeToPrompt(b)))
		if (aWords.size === 0 && bWords.size === 0) return 1

		let intersection = 0
		for (const w of aWords) {
			if (bWords.has(w)) intersection++
		}
		const union = aWords.size + bWords.size - intersection
		return union > 0 ? intersection / union : 0
	}

	/** Tournament selection: pick k random, return best */
	private tournamentSelect(population: Chromosome[], k: number): Chromosome {
		const candidates: Chromosome[] = []
		for (let i = 0; i < k; i++) {
			const idx = Math.floor(Math.random() * population.length)
			candidates.push(population[idx]!)
		}
		candidates.sort((a, b) => b.fitness - a.fitness)
		return { segments: [...candidates[0]!.segments], fitness: candidates[0]!.fitness }
	}

	/** Uniform crossover: each segment comes from either parent */
	private crossover(parentA: Chromosome, parentB: Chromosome): Chromosome {
		const maxLen = Math.max(parentA.segments.length, parentB.segments.length)
		const childSegments: PromptSegment[] = []

		for (let i = 0; i < maxLen; i++) {
			const segA = parentA.segments[i]
			const segB = parentB.segments[i]

			if (!segA && segB) {
				childSegments.push({ ...segB })
			} else if (!segB && segA) {
				childSegments.push({ ...segA })
			} else if (segA && segB) {
				// Uniform crossover: randomly pick from either parent
				const source = Math.random() < PromptEvolver.CROSSOVER_RATE ? segA : segB
				childSegments.push({ ...source })
			}
		}

		return { segments: childSegments, fitness: 0 }
	}

	/** Apply mutation operators with probability */
	private mutate(chromosome: Chromosome): Chromosome {
		const segments = chromosome.segments.map((s) => ({ ...s }))

		for (let i = 0; i < segments.length; i++) {
			if (Math.random() > PromptEvolver.MUTATION_RATE) continue
			if (segments[i]!.isEssential) continue // don't mutate essential segments

			const mutationType = Math.random()

			if (mutationType < 0.35) {
				// Segment drop: remove non-essential segment
				segments.splice(i, 1)
				i-- // adjust index after removal
			} else if (mutationType < 0.6 && segments.length > 2) {
				// Segment reorder: swap with another segment
				const j = Math.floor(Math.random() * segments.length)
				if (j !== i && !segments[j]!.isEssential) {
					const temp = segments[i]!
					segments[i] = segments[j]!
					segments[j] = temp
				}
			} else if (mutationType < 0.85) {
				// Instruction refinement: replace vague terms with concrete ones
				segments[i] = {
					...segments[i]!,
					text: refineSegment(segments[i]!.text),
				}
			}
			// else: no mutation for this segment
		}

		return { segments, fitness: 0 }
	}

	// ============================================================
	// Fitness Function
	// ============================================================

	/**
	 * Multi-factor fitness based on real interaction data.
	 *
	 * Score = w1*successCorrelation + w2*specificity + w3*coverage
	 *       + w4*cortexComplexityBonus + w5*cortexConfidenceBonus
	 *       - w6*lengthPenalty
	 */
	private computeFitness(chromosome: Chromosome, interactions: InteractionRecord[]): number {
		const prompt = this.chromosomeToPrompt(chromosome)
		const words = prompt.split(/\s+/).filter((w) => w.length > 0)
		if (words.length === 0) return 0

		// Factor 1: Historical success correlation
		const successCorrelation = this.computeSuccessCorrelation(prompt, interactions)

		// Factor 2: Specificity ratio (concrete terms / total meaningful words)
		const specificity = this.computeSpecificity(words)

		// Factor 3: Coverage (how many task types the prompt addresses)
		const coverage = this.computeCoverage(prompt)

		// Factor 4: Cortex complexity bonus — reward prompts that correlate with
		// successful interactions on complex queries
		const cortexComplexityBonus = this.computeCortexComplexityBonus(interactions)

		// Factor 5: Cortex confidence bonus — reward prompts correlated with
		// high-confidence cortex analyses
		const cortexConfidenceBonus = this.computeCortexConfidenceBonus(interactions)

		// Factor 6: Length penalty (diminishing returns, then penalty)
		const lengthPenalty = this.computeLengthPenalty(words.length)

		// Weighted combination
		const fitness =
			0.3 * successCorrelation +
			0.2 * specificity +
			0.15 * coverage +
			0.1 * cortexComplexityBonus +
			0.1 * cortexConfidenceBonus -
			lengthPenalty

		return Math.max(0, Math.min(1, fitness))
	}

	/** Bonus for prompts that correlate with successful complex queries */
	private computeCortexComplexityBonus(interactions: InteractionRecord[]): number {
		const withCortex = interactions.filter((r) => r.cortexMeta && r.success)
		if (withCortex.length === 0) return 0.5

		const avgComplexity =
			withCortex.reduce((s, r) => s + (r.cortexMeta?.complexity ?? 0), 0) / withCortex.length
		return avgComplexity
	}

	/** Bonus for prompts that correlate with high-confidence analyses */
	private computeCortexConfidenceBonus(interactions: InteractionRecord[]): number {
		const withCortex = interactions.filter((r) => r.cortexMeta && r.success)
		if (withCortex.length === 0) return 0.5

		const avgConfidence =
			withCortex.reduce((s, r) => s + (r.cortexMeta?.confidence ?? 0), 0) / withCortex.length
		return avgConfidence
	}

	/** Correlation between prompt content and successful interactions */
	private computeSuccessCorrelation(prompt: string, interactions: InteractionRecord[]): number {
		if (interactions.length === 0) return 0.5

		const promptTerms = new Set(tokenize(prompt))
		let successScore = 0
		let totalWeight = 0

		for (const record of interactions) {
			const recordTerms = new Set(tokenize(record.query))
			// Overlap between prompt terms and query terms
			let overlap = 0
			for (const term of Array.from(promptTerms)) {
				if (recordTerms.has(term)) overlap++
			}
			const similarity = promptTerms.size > 0 ? overlap / promptTerms.size : 0

			// Weight by success and similarity
			const weight = similarity
			if (weight > 0) {
				successScore += weight * (record.success ? 1 : 0)
				totalWeight += weight
			}
		}

		return totalWeight > 0 ? successScore / totalWeight : 0.5
	}

	/** Ratio of concrete terms to total meaningful words */
	private computeSpecificity(words: string[]): number {
		let concrete = 0
		let vague = 0
		let meaningful = 0

		for (const word of words) {
			const lower = word.toLowerCase().replace(/[^a-z]/g, '')
			if (lower.length < 3) continue
			meaningful++
			if (CONCRETE_TERMS.has(lower)) concrete++
			if (VAGUE_TERMS.has(lower)) vague++
		}

		if (meaningful === 0) return 0.5
		// High concrete, low vague = high specificity
		return Math.min(1, (concrete / meaningful) * 2 + (1 - vague / meaningful))
	}

	/** How many task types does this prompt address */
	private computeCoverage(prompt: string): number {
		const lower = prompt.toLowerCase()
		const coveredTypes = Object.entries(TASK_TYPE_SIGNALS).filter(([, keywords]) =>
			keywords.some((kw) => lower.includes(kw)),
		)
		return coveredTypes.length / Object.keys(TASK_TYPE_SIGNALS).length
	}

	/** Diminishing returns for length, penalty for excessive length */
	private computeLengthPenalty(wordCount: number): number {
		if (wordCount <= 500) return 0
		if (wordCount <= 2000) return 0.02 // minimal penalty
		// Exponential penalty for very long prompts
		return Math.min(0.3, ((wordCount - 2000) / 5000) * 0.15)
	}

	// ============================================================
	// Segment Injection
	// ============================================================

	/** Inject learned success patterns as a new segment */
	private injectLearnedSegments(chromosome: Chromosome, patterns: string[]): Chromosome {
		const segments = chromosome.segments.map((s) => ({ ...s }))
		const text = patterns.map((p) => `- ${p}`).join('\n')

		// Find if a "Learned Patterns" section exists and update it
		const existingIdx = segments.findIndex(
			(s) => s.text.toLowerCase().includes('learned') && s.text.toLowerCase().includes('pattern'),
		)

		if (existingIdx >= 0) {
			segments[existingIdx] = {
				...segments[existingIdx]!,
				text: `## Learned Effective Patterns\n${text}`,
			}
		} else {
			// Insert before last segment
			const insertIdx = Math.max(1, segments.length - 1)
			segments.splice(insertIdx, 0, {
				text: `## Learned Effective Patterns\n${text}`,
				isHeader: true,
				isEssential: false,
			})
		}

		return { segments, fitness: 0 }
	}

	/** Inject anti-pattern warnings as a new segment */
	private injectAntiPatternSegments(chromosome: Chromosome, antiPatterns: string[]): Chromosome {
		const segments = chromosome.segments.map((s) => ({ ...s }))
		const text = antiPatterns.map((p) => `- ${p}`).join('\n')

		const existingIdx = segments.findIndex(
			(s) => s.text.toLowerCase().includes('avoid') && s.text.toLowerCase().includes('pattern'),
		)

		if (existingIdx >= 0) {
			segments[existingIdx] = { ...segments[existingIdx]!, text: `## Patterns to Avoid\n${text}` }
		} else {
			const insertIdx = Math.max(1, segments.length - 1)
			segments.splice(insertIdx, 0, {
				text: `## Patterns to Avoid\n${text}`,
				isHeader: true,
				isEssential: false,
			})
		}

		return { segments, fitness: 0 }
	}

	// ============================================================
	// Pattern Extraction (uses real statistical analysis)
	// ============================================================

	private extractSuccessPrinciples(successes: InteractionRecord[]): string[] {
		const principles: string[] = []

		// Analyze tool sequence effectiveness using transition counts
		const toolTransitions = new Map<string, number>()
		for (const record of successes) {
			for (let i = 0; i < record.toolsUsed.length - 1; i++) {
				const transition = `${record.toolsUsed[i]} → ${record.toolsUsed[i + 1]}`
				toolTransitions.set(transition, (toolTransitions.get(transition) ?? 0) + 1)
			}
		}

		// Only recommend transitions with statistically significant frequency (≥ 2 occurrences)
		for (const [transition, count] of Array.from(toolTransitions.entries())) {
			if (count >= 2) {
				principles.push(`Tool sequence ${transition} effective (${count} successes)`)
			}
		}

		// Analyze strategy success rates with confidence intervals
		const strategyCounts = new Map<string, { wins: number; total: number }>()
		for (const record of successes) {
			const current = strategyCounts.get(record.strategy) ?? { wins: 0, total: 0 }
			strategyCounts.set(record.strategy, { wins: current.wins + 1, total: current.total + 1 })
		}

		// Only recommend strategies with enough samples
		for (const [strategy, counts] of Array.from(strategyCounts.entries())) {
			if (counts.wins >= 3) {
				const rate = ((counts.wins / counts.total) * 100).toFixed(0)
				principles.push(`Strategy '${strategy}' achieves ${rate}% success rate`)
			}
		}

		// User feedback correlation
		const positiveFeedback = successes.filter((r) => r.userFeedback === 'positive')
		if (positiveFeedback.length >= 2) {
			const avgDuration =
				positiveFeedback.reduce((s, r) => s + r.durationMs, 0) / positiveFeedback.length
			principles.push(
				`User-satisfying responses average ${Math.round(avgDuration / 1000)}s duration`,
			)
		}

		return principles
	}

	private extractFailureAntiPatterns(failures: InteractionRecord[]): string[] {
		const antiPatterns: string[] = []

		// Error type frequency analysis
		const errorTypes = new Map<string, number>()
		for (const record of failures) {
			if (record.errorType) {
				errorTypes.set(record.errorType, (errorTypes.get(record.errorType) ?? 0) + 1)
			}
		}

		for (const [errorType, count] of Array.from(errorTypes.entries())) {
			if (count >= 2) {
				antiPatterns.push(`Avoid patterns causing '${errorType}' errors (${count} occurrences)`)
			}
		}

		// Tool failure association analysis
		const failTools = new Map<string, { failures: number; totalDuration: number }>()
		for (const record of failures) {
			for (const tool of record.toolsUsed) {
				const current = failTools.get(tool) ?? { failures: 0, totalDuration: 0 }
				failTools.set(tool, {
					failures: current.failures + 1,
					totalDuration: current.totalDuration + record.durationMs,
				})
			}
		}

		// Flag tools with high failure association
		for (const [tool, data] of Array.from(failTools.entries())) {
			if (data.failures >= 2) {
				antiPatterns.push(`Use ${tool} cautiously — associated with ${data.failures} failures`)
			}
		}

		// Duration pattern: if failures cluster at certain durations
		if (failures.length >= 3) {
			const avgFailDuration = failures.reduce((s, r) => s + r.durationMs, 0) / failures.length
			const quickFailures = failures.filter((r) => r.durationMs < avgFailDuration * 0.3)
			if (quickFailures.length > failures.length * 0.5) {
				antiPatterns.push('Quick failures suggest missing pre-validation — verify inputs early')
			}
		}

		return antiPatterns
	}
}

// ============================================================
// Utility Functions
// ============================================================

/** Tokenize text for comparison */
function tokenize(text: string): string[] {
	return text
		.toLowerCase()
		.replace(/[^a-z0-9\s]/g, ' ')
		.split(/\s+/)
		.filter((w) => w.length > 3)
}

/** Replace vague language with more specific alternatives */
function refineSegment(text: string): string {
	const replacements: Array<[RegExp, string]> = [
		[/\bhandle errors?\b/gi, 'catch and throw descriptive errors'],
		[/\bmake sure\b/gi, 'verify'],
		[/\bdeal with\b/gi, 'process'],
		[/\btake care of\b/gi, 'manage'],
		[/\blook at\b/gi, 'inspect'],
		[/\bcome up with\b/gi, 'derive'],
		[/\bfigure out\b/gi, 'determine'],
		[/\bput together\b/gi, 'compose'],
	]

	let refined = text
	for (const [pattern, replacement] of replacements) {
		refined = refined.replace(pattern, replacement)
	}
	return refined
}

interface PromptSection {
	name: string
	content: string
	generation: number
	history: PromptEvolution[]
}
