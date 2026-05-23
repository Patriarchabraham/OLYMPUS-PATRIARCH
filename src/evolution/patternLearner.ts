import { randomUUID } from 'node:crypto'
import type { InteractionRecord, Pattern } from './types.js'

/** Half-life for pattern freshness decay (7 days in ms) */
const PATTERN_DECAY_HALF_LIFE_MS = 7 * 24 * 60 * 60 * 1000

interface KeywordFreq {
	word: string
	count: number
	successCount: number
}

export class PatternLearner {
	private patterns: Pattern[] = []

	constructor(existing?: Pattern[]) {
		if (existing) {
			this.patterns = existing
		}
	}

	getPatterns(): Pattern[] {
		return this.patterns
	}

	analyzePatterns(interactions: InteractionRecord[]): Pattern[] {
		if (interactions.length < 3) return []

		const newPatterns: Pattern[] = []

		// Group by strategy + tool combination
		const groups = new Map<string, InteractionRecord[]>()
		for (const interaction of interactions) {
			const key = `${interaction.strategy}|${interaction.toolsUsed.sort().join(',')}`
			const group = groups.get(key) ?? []
			group.push(interaction)
			groups.set(key, group)
		}

		for (const [key, group] of groups) {
			if (group.length < 2) continue

			const successRate = group.filter((r) => r.success).length / group.length
			if (successRate < 0.5) continue

			const keywords = this.extractKeywords(group.map((r) => r.query))
			if (keywords.length === 0) continue

			const [strategy, toolsStr] = key.split('|')
			const tools = toolsStr ? toolsStr.split(',') : []

			const pattern: Pattern = {
				id: randomUUID(),
				name: this.generatePatternName(keywords, strategy),
				description: `When query contains [${keywords.slice(0, 3).join(', ')}], use ${strategy} with ${tools.join(', ')}. Success rate: ${(successRate * 100).toFixed(0)}%`,
				triggerConditions: keywords.slice(0, 5),
				recommendedStrategy: strategy,
				recommendedTools: tools,
				successRate,
				sampleSize: group.length,
				lastUpdated: Date.now(),
			}

			newPatterns.push(pattern)
		}

		return newPatterns.sort((a, b) => b.successRate * b.sampleSize - a.successRate * a.sampleSize)
	}

	detectRecurringPatterns(): Pattern[] {
		// Return patterns ordered by reliability (successRate * sqrt(sampleSize))
		return [...this.patterns].sort((a, b) => {
			const scoreA = a.successRate * Math.sqrt(a.sampleSize)
			const scoreB = b.successRate * Math.sqrt(b.sampleSize)
			return scoreB - scoreA
		})
	}

	matchPattern(query: string): Pattern | null {
		const lower = query.toLowerCase()
		const words = lower.split(/\s+/)

		let bestMatch: Pattern | null = null
		let bestScore = 0

		for (const pattern of this.patterns) {
			let score = 0
			let matchedConditions = 0

			for (const condition of pattern.triggerConditions) {
				const condLower = condition.toLowerCase()
				if (lower.includes(condLower) || words.some((w) => w.includes(condLower))) {
					score += 2
					matchedConditions++
				}
			}

			// Bonus for partial word matches
			for (const word of words) {
				for (const condition of pattern.triggerConditions) {
					if (condition.toLowerCase().includes(word) || word.includes(condition.toLowerCase())) {
						score += 1
						break
					}
				}
			}

			// Weight by reliability with time decay
			const ageMs = Date.now() - pattern.lastUpdated
			const freshness = 0.5 ** (ageMs / PATTERN_DECAY_HALF_LIFE_MS)
			const reliability = pattern.successRate * Math.log(pattern.sampleSize + 1) * freshness
			score *= reliability

			// Require at least one condition match
			if (matchedConditions > 0 && score > bestScore) {
				bestScore = score
				bestMatch = pattern
			}
		}

		return bestMatch
	}

	updatePatterns(newInteractions: InteractionRecord[]): Pattern[] {
		const freshPatterns = this.analyzePatterns(newInteractions)

		for (const fresh of freshPatterns) {
			const existing = this.findSimilarPattern(fresh)
			if (existing) {
				// Merge: update stats with weighted average
				const totalSample = existing.sampleSize + fresh.sampleSize
				existing.successRate =
					(existing.successRate * existing.sampleSize + fresh.successRate * fresh.sampleSize) /
					totalSample
				existing.sampleSize = Math.min(totalSample, 1000) // cap
				existing.lastUpdated = Date.now()

				// Merge trigger conditions
				const allConditions = new Set([...existing.triggerConditions, ...fresh.triggerConditions])
				existing.triggerConditions = [...allConditions].slice(0, 8)
			} else {
				this.patterns.push(fresh)
			}
		}

		// Prune low-value patterns
		this.patterns = this.patterns
			.filter((p) => p.sampleSize >= 2 && p.successRate >= 0.4)
			.sort((a, b) => b.successRate * b.sampleSize - a.successRate * a.sampleSize)
			.slice(0, 50) // Keep top 50

		return this.patterns
	}

	private findSimilarPattern(pattern: Pattern): Pattern | undefined {
		return this.patterns.find((existing) => {
			if (existing.recommendedStrategy !== pattern.recommendedStrategy) return false
			const overlap = pattern.triggerConditions.filter((c) =>
				existing.triggerConditions.some(
					(ec) =>
						c.toLowerCase().includes(ec.toLowerCase()) ||
						ec.toLowerCase().includes(c.toLowerCase()),
				),
			)
			return overlap.length >= 1
		})
	}

	private extractKeywords(queries: string[]): string[] {
		// Stop words to ignore
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
			'being',
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
			'may',
			'might',
			'can',
			'shall',
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
			'during',
			'before',
			'after',
			'above',
			'below',
			'between',
			'and',
			'but',
			'or',
			'not',
			'no',
			'nor',
			'so',
			'yet',
			'both',
			'either',
			'neither',
			'each',
			'every',
			'all',
			'any',
			'few',
			'more',
			'most',
			'other',
			'some',
			'such',
			'than',
			'too',
			'very',
			'just',
			'because',
			'if',
			'when',
			'where',
			'how',
			'what',
			'which',
			'who',
			'whom',
			'this',
			'that',
			'these',
			'those',
			'it',
			'its',
			'my',
			'your',
			'his',
			'her',
			'our',
			'their',
			'me',
			'him',
			'us',
			'them',
			'i',
			'you',
			'he',
			'she',
			'we',
			'they',
			'please',
			'want',
			'need',
		])

		const freq = new Map<string, KeywordFreq>()

		for (const query of queries) {
			const words = query
				.toLowerCase()
				.replace(/[^a-z0-9\s]/g, ' ')
				.split(/\s+/)
				.filter((w) => w.length > 2 && !stopWords.has(w))

			const seen = new Set<string>()
			for (const word of words) {
				if (!seen.has(word)) {
					seen.add(word)
					const existing = freq.get(word) ?? { word, count: 0, successCount: 0 }
					existing.count++
					freq.set(word, existing)
				}
			}
		}

		return [...freq.values()]
			.filter((f) => f.count >= 2)
			.sort((a, b) => b.count - a.count)
			.slice(0, 10)
			.map((f) => f.word)
	}

	private generatePatternName(keywords: string[], strategy: string): string {
		const mainKeyword = keywords[0] ?? 'general'
		return `${strategy}-${mainKeyword}-pattern`
	}
}
