import { expect, test } from 'vitest'

import { extractGitHubRepoSlug } from './repoSlug.ts'

test('keeps owner/repo input as-is', () => {
	expect(extractGitHubRepoSlug('Gitlawb/Olympuz Coder')).toBe('Gitlawb/Olympuz Coder')
})

test('extracts slug from https GitHub URLs', () => {
	expect(extractGitHubRepoSlug('https://github.com/Gitlawb/Olympuz Coder')).toBe(
		'Gitlawb/Olympuz Coder',
	)
	expect(extractGitHubRepoSlug('https://www.github.com/Gitlawb/Olympuz Coder.git')).toBe(
		'Gitlawb/Olympuz Coder',
	)
})

test('extracts slug from ssh GitHub URLs', () => {
	expect(extractGitHubRepoSlug('git@github.com:Gitlawb/Olympuz Coder.git')).toBe(
		'Gitlawb/Olympuz Coder',
	)
	expect(extractGitHubRepoSlug('ssh://git@github.com/Gitlawb/Olympuz Coder')).toBe(
		'Gitlawb/Olympuz Coder',
	)
})

test('rejects malformed or non-GitHub URLs', () => {
	expect(extractGitHubRepoSlug('https://gitlab.com/Gitlawb/Olympuz Coder')).toBe(null)
	expect(extractGitHubRepoSlug('https://github.com/Gitlawb')).toBe(null)
	expect(extractGitHubRepoSlug('not actually github.com/Gitlawb/Olympuz Coder')).toBe(null)
	expect(extractGitHubRepoSlug('https://evil.example/?next=github.com/Gitlawb/Olympuz Coder')).toBe(
		null,
	)
	expect(extractGitHubRepoSlug('https://github.com.evil.example/Gitlawb/Olympuz Coder')).toBe(null)
	expect(extractGitHubRepoSlug('https://example.com/github.com/Gitlawb/Olympuz Coder')).toBe(null)
})
