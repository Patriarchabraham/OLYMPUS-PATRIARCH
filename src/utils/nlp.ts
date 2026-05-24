/**
 * Shared NLP utilities — extracted from cortex/metaCognition for reuse
 * across governance, reasoning, and cortex modules.
 *
 * All functions are pure and side-effect-free.
 */

/** Tokenize text into lowercase words */
export function tokenize(text: string): string[] {
	return text
		.toLowerCase()
		.replace(/[^a-z0-9\s-]/g, ' ')
		.split(/\s+/)
		.filter((w) => w.length > 0)
}

/** Split text into sentences */
export function splitSentences(text: string): string[] {
	return text
		.split(/[.!?]+/)
		.map((s) => s.trim())
		.filter((s) => s.length > 0)
}

/** Count syllables in an English word using vowel-group heuristic */
export function countSyllables(word: string): number {
	const w = word.toLowerCase().replace(/[^a-z]/g, '')
	if (w.length <= 2) return 1
	let count = 0
	let prevVowel = false
	for (const ch of w) {
		const isVowel = 'aeiou'.includes(ch)
		if (isVowel && !prevVowel) count++
		prevVowel = isVowel
	}
	if (w.endsWith('e') && !w.endsWith('le') && count > 1) count--
	return Math.max(1, count)
}

/** Compute Shannon entropy of a word frequency distribution */
export function shannonEntropy(words: string[]): number {
	if (words.length === 0) return 0
	const freq = new Map<string, number>()
	for (const w of words) {
		freq.set(w, (freq.get(w) ?? 0) + 1)
	}
	let entropy = 0
	for (const count of Array.from(freq.values())) {
		const p = count / words.length
		if (p > 0) entropy -= p * Math.log2(p)
	}
	return entropy
}

/** Compute TF (term frequency) vector for a text */
export function termFrequencies(tokens: string[]): Map<string, number> {
	const tf = new Map<string, number>()
	for (const t of tokens) {
		tf.set(t, (tf.get(t) ?? 0) + 1)
	}
	const len = tokens.length || 1
	for (const [k, v] of Array.from(tf.entries())) {
		tf.set(k, v / len)
	}
	return tf
}

/** Compute cosine similarity between two TF maps */
export function cosineSimilarity(a: Map<string, number>, b: Map<string, number>): number {
	const allKeysArr = Array.from(a.keys()).concat(Array.from(b.keys()))
	let dotProduct = 0
	let normA = 0
	let normB = 0
	for (const key of allKeysArr) {
		const va = a.get(key) ?? 0
		const vb = b.get(key) ?? 0
		dotProduct += va * vb
		normA += va * va
		normB += vb * vb
	}
	const denom = Math.sqrt(normA) * Math.sqrt(normB)
	return denom > 0 ? dotProduct / denom : 0
}

/** Precompute IDF from a corpus of documents (label -> token array) */
export function computeIDF(corpus: Record<string, string[]>): Map<string, number> {
	const docCount = Object.keys(corpus).length
	const docFreq = new Map<string, number>()
	for (const tokens of Object.values(corpus)) {
		const unique = new Set(tokens)
		for (const t of Array.from(unique)) {
			docFreq.set(t, (docFreq.get(t) ?? 0) + 1)
		}
	}
	const idf = new Map<string, number>()
	for (const [term, freq] of Array.from(docFreq.entries())) {
		idf.set(term, Math.log((docCount + 1) / (freq + 1)) + 1)
	}
	return idf
}

/** Compute TF-IDF vector for a token list given precomputed IDF */
export function tfidfVector(tokens: string[], idf: Map<string, number>): Map<string, number> {
	const tf = termFrequencies(tokens)
	const vec = new Map<string, number>()
	for (const [term, freq] of Array.from(tf.entries())) {
		vec.set(term, freq * (idf.get(term) ?? 1))
	}
	return vec
}

/** Compute Jaccard similarity between two sets of strings */
export function jaccardSimilarity(a: Set<string>, b: Set<string>): number {
	if (a.size === 0 && b.size === 0) return 1
	const intersection = new Set(Array.from(a).filter((x) => b.has(x)))
	const union = new Set([...Array.from(a), ...Array.from(b)])
	return union.size > 0 ? intersection.size / union.size : 0
}

/** English stop words for keyword extraction */
export const STOP_WORDS = new Set([
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
	'shall',
	'should',
	'may',
	'might',
	'must',
	'can',
	'could',
	'of',
	'in',
	'to',
	'for',
	'with',
	'on',
	'at',
	'from',
	'by',
	'about',
	'as',
	'into',
	'through',
	'during',
	'before',
	'after',
	'above',
	'below',
	'between',
	'out',
	'off',
	'over',
	'under',
	'again',
	'further',
	'then',
	'once',
	'and',
	'but',
	'or',
	'nor',
	'not',
	'so',
	'very',
	'too',
	'just',
	'that',
	'this',
	'these',
	'those',
	'it',
	'its',
	'they',
	'them',
	'their',
	'we',
	'our',
	'you',
	'your',
	'he',
	'she',
	'him',
	'her',
	'his',
	'i',
	'me',
	'my',
	'what',
	'which',
	'who',
	'whom',
	'there',
	'here',
	'all',
	'each',
	'every',
	'both',
	'few',
	'more',
	'most',
	'other',
	'some',
	'such',
	'no',
	'only',
	'same',
	'than',
	'also',
	'if',
	'when',
	'while',
	'how',
	'up',
	'down',
	'because',
	'until',
	'since',
	'where',
	'why',
	'am',
])
