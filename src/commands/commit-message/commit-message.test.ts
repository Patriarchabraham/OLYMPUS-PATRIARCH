import { describe, expect, it } from 'vitest'
import {
	formatCoAuthorTrailer,
	parseCoAuthor,
	stripMatchingQuotes,
	USAGE,
} from './commit-message.js'

describe('commit-message command helpers', () => {
	it('parses quoted co-author names with a plain email', () => {
		expect(parseCoAuthor('"GPT 5.5" noreply@olympuz.dev')).toEqual({
			name: 'GPT 5.5',
			email: 'noreply@olympuz.dev',
		})
	})

	it('parses co-author trailers with angle-bracket emails', () => {
		expect(parseCoAuthor('Olympuz Coder (gpt-5.5) <noreply@olympuz.dev>')).toEqual({
			name: 'Olympuz Coder (gpt-5.5)',
			email: 'noreply@olympuz.dev',
		})
	})

	it('rejects co-author trailers with empty sanitized names', () => {
		expect(parseCoAuthor('"  " noreply@olympuz.dev')).toBeNull()
		expect(parseCoAuthor('"  " <noreply@olympuz.dev>')).toBeNull()
	})

	it('strips one pair of matching quotes from custom attribution text', () => {
		expect(stripMatchingQuotes('"Generated with Olympuz Coder"')).toBe(
			'Generated with Olympuz Coder',
		)
		expect(stripMatchingQuotes("'Generated with Olympuz Coder'")).toBe(
			'Generated with Olympuz Coder',
		)
		expect(stripMatchingQuotes('"Generated with Olympuz Coder')).toBe(
			'"Generated with Olympuz Coder',
		)
	})

	it('formats a sanitized co-author trailer', () => {
		expect(formatCoAuthorTrailer('Olympuz Coder <gpt>\n', '<noreply@Olympuz Coder.dev>')).toBe(
			'Co-Authored-By: Olympuz Coder gpt <noreply@Olympuz Coder.dev>',
		)
	})

	it('makes set scope explicit with example text', () => {
		expect(USAGE).toContain('Controls only the attribution text appended after /commit messages.')
		expect(USAGE).toContain('/commit-message set "Generated with Olympuz Coder using GPT-5.5"')
		expect(USAGE).not.toContain('/commit-message set-attribution')
	})
})
