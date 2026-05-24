import { describe, expect, it } from 'vitest'
import {
	computeIDF,
	cosineSimilarity,
	countSyllables,
	jaccardSimilarity,
	STOP_WORDS,
	shannonEntropy,
	splitSentences,
	termFrequencies,
	tfidfVector,
	tokenize,
} from './nlp.js'

describe('tokenize', () => {
	it('handles empty string', () => {
		expect(tokenize('')).toEqual([])
	})

	it('tokenizes normal text', () => {
		const result = tokenize('Hello World Test')
		expect(result).toEqual(['hello', 'world', 'test'])
	})

	it('removes special chars', () => {
		const result = tokenize('foo@bar!baz?qux')
		expect(result).toEqual(['foo', 'bar', 'baz', 'qux'])
	})

	it('handles hyphens', () => {
		const result = tokenize('well-known pattern')
		expect(result).toContain('well-known')
	})
})

describe('splitSentences', () => {
	it('handles empty string', () => {
		expect(splitSentences('')).toEqual([])
	})

	it('splits on periods', () => {
		expect(splitSentences('Hello. World')).toEqual(['Hello', 'World'])
	})

	it('splits on multiple delimiters', () => {
		const result = splitSentences('One. Two! Three?')
		expect(result).toEqual(['One', 'Two', 'Three'])
	})
})

describe('countSyllables', () => {
	it('handles short words', () => {
		expect(countSyllables('a')).toBe(1)
		expect(countSyllables('it')).toBe(1)
	})

	it('handles long words', () => {
		expect(countSyllables('development')).toBeGreaterThanOrEqual(3)
		expect(countSyllables('architecture')).toBeGreaterThanOrEqual(3)
	})

	it('handles silent e', () => {
		expect(countSyllables('name')).toBe(1)
	})
})

describe('shannonEntropy', () => {
	it('returns 0 for empty array', () => {
		expect(shannonEntropy([])).toBe(0)
	})

	it('returns 0 for single repeated word', () => {
		expect(shannonEntropy(['the', 'the', 'the'])).toBe(0)
	})

	it('returns higher entropy for diverse words', () => {
		const diverse = shannonEntropy(['alpha', 'beta', 'gamma', 'delta'])
		expect(diverse).toBeGreaterThan(1)
	})
})

describe('termFrequencies', () => {
	it('handles empty array', () => {
		expect(termFrequencies([]).size).toBe(0)
	})

	it('normalizes frequencies', () => {
		const tf = termFrequencies(['hello', 'hello', 'world'])
		expect(tf.get('hello')).toBeCloseTo(2 / 3)
		expect(tf.get('world')).toBeCloseTo(1 / 3)
	})
})

describe('cosineSimilarity', () => {
	it('returns 1 for identical maps', () => {
		const m = new Map([
			['a', 1],
			['b', 2],
		])
		expect(cosineSimilarity(m, m)).toBeCloseTo(1)
	})

	it('returns 0 for disjoint maps', () => {
		const a = new Map([['a', 1]])
		const b = new Map([['b', 1]])
		expect(cosineSimilarity(a, b)).toBe(0)
	})

	it('returns partial for overlapping', () => {
		const a = new Map([
			['a', 1],
			['b', 1],
		])
		const b = new Map([
			['b', 1],
			['c', 1],
		])
		const sim = cosineSimilarity(a, b)
		expect(sim).toBeGreaterThan(0)
		expect(sim).toBeLessThan(1)
	})
})

describe('computeIDF', () => {
	it('handles single doc', () => {
		const idf = computeIDF({ doc1: ['hello', 'world'] })
		expect(idf.size).toBe(2)
	})

	it('gives higher IDF to rare terms', () => {
		const idf = computeIDF({
			doc1: ['common', 'rare'],
			doc2: ['common', 'other'],
		})
		expect(idf.get('rare')!).toBeGreaterThan(idf.get('common')!)
	})
})

describe('tfidfVector', () => {
	it('computes vector', () => {
		const idf = computeIDF({ doc1: ['hello', 'world'] })
		const vec = tfidfVector(['hello', 'hello'], idf)
		expect(vec.has('hello')).toBe(true)
	})
})

describe('jaccardSimilarity', () => {
	it('returns 1 for identical sets', () => {
		expect(jaccardSimilarity(new Set(['a', 'b']), new Set(['a', 'b']))).toBe(1)
	})

	it('returns 0 for disjoint sets', () => {
		expect(jaccardSimilarity(new Set(['a']), new Set(['b']))).toBe(0)
	})

	it('returns partial for overlapping', () => {
		const sim = jaccardSimilarity(new Set(['a', 'b']), new Set(['b', 'c']))
		expect(sim).toBeCloseTo(1 / 3)
	})
})

describe('STOP_WORDS', () => {
	it('contains common stop words', () => {
		expect(STOP_WORDS.has('the')).toBe(true)
		expect(STOP_WORDS.has('and')).toBe(true)
		expect(STOP_WORDS.has('is')).toBe(true)
	})

	it('does not contain meaningful words', () => {
		expect(STOP_WORDS.has('function')).toBe(false)
		expect(STOP_WORDS.has('module')).toBe(false)
	})
})
