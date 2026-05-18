import assert from 'node:assert/strict'
import test from 'node:test'

import { extractGitHubRepoSlug } from './repoSlug.ts'

test('keeps owner/repo input as-is', () => {
  assert.equal(extractGitHubRepoSlug('Gitlawb/Mythos Patriarch'), 'Gitlawb/Mythos Patriarch')
})

test('extracts slug from https GitHub URLs', () => {
  assert.equal(
    extractGitHubRepoSlug('https://github.com/Gitlawb/Mythos Patriarch'),
    'Gitlawb/Mythos Patriarch',
  )
  assert.equal(
    extractGitHubRepoSlug('https://www.github.com/Gitlawb/Mythos Patriarch.git'),
    'Gitlawb/Mythos Patriarch',
  )
})

test('extracts slug from ssh GitHub URLs', () => {
  assert.equal(
    extractGitHubRepoSlug('git@github.com:Gitlawb/Mythos Patriarch.git'),
    'Gitlawb/Mythos Patriarch',
  )
  assert.equal(
    extractGitHubRepoSlug('ssh://git@github.com/Gitlawb/Mythos Patriarch'),
    'Gitlawb/Mythos Patriarch',
  )
})

test('rejects malformed or non-GitHub URLs', () => {
  assert.equal(extractGitHubRepoSlug('https://gitlab.com/Gitlawb/Mythos Patriarch'), null)
  assert.equal(extractGitHubRepoSlug('https://github.com/Gitlawb'), null)
  assert.equal(extractGitHubRepoSlug('not actually github.com/Gitlawb/Mythos Patriarch'), null)
  assert.equal(
    extractGitHubRepoSlug('https://evil.example/?next=github.com/Gitlawb/Mythos Patriarch'),
    null,
  )
  assert.equal(
    extractGitHubRepoSlug('https://github.com.evil.example/Gitlawb/Mythos Patriarch'),
    null,
  )
  assert.equal(
    extractGitHubRepoSlug('https://example.com/github.com/Gitlawb/Mythos Patriarch'),
    null,
  )
})
