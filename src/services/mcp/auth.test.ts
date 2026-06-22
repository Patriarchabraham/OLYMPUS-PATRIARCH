import { expect, test } from 'vitest'

import { validateOAuthCallbackParams } from './auth.js'

test('OAuth callback rejects error parameters before state validation can be bypassed', () => {
	const result = validateOAuthCallbackParams(
		{
			error: 'access_denied',
			error_description: 'denied by provider',
		},
		'expected-state',
	)

	expect(result).toEqual({ type: 'state_mismatch' })
})

test('OAuth callback accepts provider errors only when state matches', () => {
	const result = validateOAuthCallbackParams(
		{
			state: 'expected-state',
			error: 'access_denied',
			error_description: 'denied by provider',
			error_uri: 'https://example.test/error',
		},
		'expected-state',
	)

	expect(result).toEqual({
		type: 'error',
		error: 'access_denied',
		errorDescription: 'denied by provider',
		errorUri: 'https://example.test/error',
		message: 'OAuth error: access_denied - denied by provider (See: https://example.test/error)',
	})
})

test('OAuth callback accepts authorization codes only when state matches', () => {
	expect(
		validateOAuthCallbackParams(
			{
				state: 'expected-state',
				code: 'auth-code',
			},
			'expected-state',
		),
	).toEqual({ type: 'code', code: 'auth-code' })

	expect(
		validateOAuthCallbackParams(
			{
				state: 'wrong-state',
				code: 'auth-code',
			},
			'expected-state',
		),
	).toEqual({ type: 'state_mismatch' })
})
