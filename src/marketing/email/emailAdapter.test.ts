import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { isEmailAvailable, isInboxAvailable, listInbox, sendMail } from './emailAdapter.js'

const KEYS = [
	'SMTP_HOST',
	'SMTP_USER',
	'SMTP_PASS',
	'SMTP_PORT',
	'SMTP_SECURE',
	'SMTP_FROM',
	'IMAP_HOST',
	'IMAP_USER',
	'IMAP_PASS',
	'IMAP_PORT',
	'IMAP_SECURE',
]
const original: Record<string, string | undefined> = {}

describe('marketing emailAdapter — no-op when unconfigured', () => {
	beforeEach(() => {
		for (const k of KEYS) {
			original[k] = process.env[k]
			delete process.env[k]
		}
	})
	afterEach(() => {
		for (const k of KEYS) {
			if (original[k] === undefined) delete process.env[k]
			else process.env[k] = original[k]
		}
	})

	it('isEmailAvailable / isInboxAvailable are false without creds', () => {
		expect(isEmailAvailable()).toBe(false)
		expect(isInboxAvailable()).toBe(false)
	})

	it('sendMail returns a not-configured result naming SMTP_HOST', async () => {
		const r = await sendMail({ to: 'a@b.com', subject: 's', body: 'b' })
		expect(r.ok).toBe(false)
		expect(r.error).toContain('SMTP_HOST')
	})

	it('listInbox returns a not-configured result naming IMAP_HOST', async () => {
		const r = await listInbox()
		expect(r.ok).toBe(false)
		expect(r.error).toContain('IMAP_HOST')
	})
})
