import { describe, expect, it } from 'bun:test'
import {
  formatCoAuthorTrailer,
  parseCoAuthor,
  stripMatchingQuotes,
  USAGE,
} from './commit-message.js'

describe('commit-message command helpers', () => {
  it('parses quoted co-author names with a plain email', () => {
    expect(parseCoAuthor('"GPT 5.5" noreply@Mythos Patriarch.dev')).toEqual({
      name: 'GPT 5.5',
      email: 'noreply@Mythos Patriarch.dev',
    })
  })

  it('parses co-author trailers with angle-bracket emails', () => {
    expect(parseCoAuthor('Mythos Patriarch (gpt-5.5) <noreply@Mythos Patriarch.dev>')).toEqual(
      {
        name: 'Mythos Patriarch (gpt-5.5)',
        email: 'noreply@Mythos Patriarch.dev',
      },
    )
  })

  it('rejects co-author trailers with empty sanitized names', () => {
    expect(parseCoAuthor('"  " noreply@Mythos Patriarch.dev')).toBeNull()
    expect(parseCoAuthor('"  " <noreply@Mythos Patriarch.dev>')).toBeNull()
  })

  it('strips one pair of matching quotes from custom attribution text', () => {
    expect(stripMatchingQuotes('"Generated with Mythos Patriarch"')).toBe(
      'Generated with Mythos Patriarch',
    )
    expect(stripMatchingQuotes("'Generated with Mythos Patriarch'")).toBe(
      'Generated with Mythos Patriarch',
    )
    expect(stripMatchingQuotes('"Generated with Mythos Patriarch')).toBe(
      '"Generated with Mythos Patriarch',
    )
  })

  it('formats a sanitized co-author trailer', () => {
    expect(
      formatCoAuthorTrailer('Mythos Patriarch <gpt>\n', '<noreply@Mythos Patriarch.dev>'),
    ).toBe('Co-Authored-By: Mythos Patriarch gpt <noreply@Mythos Patriarch.dev>')
  })

  it('makes set scope explicit with example text', () => {
    expect(USAGE).toContain(
      'Controls only the attribution text appended after /commit messages.',
    )
    expect(USAGE).toContain(
      '/commit-message set "Generated with Mythos Patriarch using GPT-5.5"',
    )
    expect(USAGE).not.toContain('/commit-message set-attribution')
  })
})
