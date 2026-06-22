import { expect, test } from 'vitest'

import { generateCodeChallenge, generateCodeVerifier, generateState } from './crypto.ts'

test('generateCodeChallenge returns the RFC 7636 S256 challenge', async () => {
	const challenge = await generateCodeChallenge('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')
	expect(challenge).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM')
})

test('generateCodeVerifier returns a URL-safe random string', () => {
	const verifier = generateCodeVerifier()
	expect(verifier).toMatch(/^[A-Za-z0-9_-]+$/)
	expect(verifier.length >= 43).toBe(true)
})

test('generateState returns a URL-safe random string', () => {
	const state = generateState()
	expect(state).toMatch(/^[A-Za-z0-9_-]+$/)
	expect(state.length >= 43).toBe(true)
})
