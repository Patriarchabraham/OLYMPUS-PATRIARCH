/**
 * Olympuz Marketing — Email adapter (nodemailer SMTP + imapflow IMAP, no-op-when-unconfigured).
 *
 * Sends and reads mail through the user's own SMTP/IMAP credentials (env-supplied).
 * When credentials are absent, every operation returns a clear "not configured"
 * result rather than throwing — so the Marketing department is structurally
 * complete and the deterministic core stays testable without creds or network.
 * Mirrors the browserAdapter availability pattern.
 *
 * Permission + audit live at the TOOL layer: `sendMail` is always approval-gated
 * and recorded to the published log; this adapter only performs the mechanical send.
 *
 * NOT executed in tests: the suite never sets SMTP_* / IMAP_*, so only the
 * no-op-when-unconfigured path is exercised. Live mail needs creds + network.
 */

export interface EmailSendInput {
	to: string
	subject: string
	body: string
	/** Optional reply-to / from override; defaults to SMTP_USER. */
	from?: string
}

export interface EmailResult {
	ok: boolean
	output?: string
	error?: string
}

export interface InboxMessage {
	id: string
	from?: string
	subject?: string
	preview?: string
	date?: string
}

/** True when SMTP send credentials are present. */
export function isEmailAvailable(): boolean {
	return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS)
}

/** True when IMAP read credentials are present. */
export function isInboxAvailable(): boolean {
	return Boolean(process.env.IMAP_HOST && process.env.IMAP_USER && process.env.IMAP_PASS)
}

function smtpNotConfigured(): EmailResult {
	return {
		ok: false,
		error:
			'Email send is not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS (and optionally SMTP_PORT, SMTP_FROM) to enable.',
	}
}

function imapNotConfigured(): EmailResult {
	return {
		ok: false,
		error:
			'Inbox read is not configured. Set IMAP_HOST, IMAP_USER, IMAP_PASS (and optionally IMAP_PORT) to enable.',
	}
}

interface Transport {
	sendMail(opts: {
		to: string
		from: string
		subject: string
		text: string
	}): Promise<{ messageId?: string; response?: string }>
	close(): Promise<void>
}

interface ImapClient {
	connect(): Promise<void>
	box?: { messagesTotal?: number }
	mailboxOpen(path: string): Promise<unknown>
	search(range: string, criteria: unknown[]): Promise<number[]>
	fetch(
		range: string | number[],
		options: unknown,
	): AsyncIterable<{
		uid: number
		envelope?: { from?: { value: { address: string }[] }; subject?: string; date?: Date }
		bodyParts?: unknown
	}>
	end(): Promise<void>
}

/** Send a single message. Real SMTP when configured; never throws. */
export async function sendMail(input: EmailSendInput): Promise<EmailResult> {
	if (!isEmailAvailable()) return smtpNotConfigured()
	try {
		// @ts-expect-error optional dependency — loaded lazily; absent → isEmailAvailable() is false.
		const nodemailer = (await import('nodemailer')).default ?? (await import('nodemailer'))
		const transport: Transport = nodemailer.createTransport({
			host: process.env.SMTP_HOST,
			port: Number(process.env.SMTP_PORT ?? 587),
			secure: process.env.SMTP_SECURE === 'true',
			auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
		})
		try {
			const info = await transport.sendMail({
				to: input.to,
				from: input.from ?? process.env.SMTP_FROM ?? process.env.SMTP_USER ?? '',
				subject: input.subject,
				text: input.body,
			})
			return { ok: true, output: info.messageId ?? 'sent' }
		} finally {
			await transport.close()
		}
	} catch (e) {
		return { ok: false, error: `sendMail failed: ${e instanceof Error ? e.message : String(e)}` }
	}
}

/** List the most recent inbox messages (preview only). */
export async function listInbox(
	limit = 10,
): Promise<{ ok: boolean; messages?: InboxMessage[]; error?: string }> {
	if (!isInboxAvailable()) return { ok: false, error: imapNotConfigured().error }
	try {
		// @ts-expect-error optional dependency — loaded lazily; absent → isInboxAvailable() is false.
		const { ImapFlow }: { ImapFlow: new (opts: unknown) => ImapClient } = await import('imapflow')
		const client = new ImapFlow({
			host: process.env.IMAP_HOST,
			port: Number(process.env.IMAP_PORT ?? 993),
			secure: process.env.IMAP_SECURE !== 'false',
			auth: { user: process.env.IMAP_USER, pass: process.env.IMAP_PASS },
			logger: false,
		})
		await client.connect()
		try {
			await client.mailboxOpen('INBOX')
			const uids = (await client.search('all', [])).slice(-limit).reverse()
			const messages: InboxMessage[] = []
			for await (const msg of client.fetch(uids, { envelope: true })) {
				const env = msg.envelope
				messages.push({
					id: String(msg.uid),
					from: env?.from?.value?.[0]?.address,
					subject: env?.subject,
					date: env?.date?.toISOString(),
				})
			}
			return { ok: true, messages }
		} finally {
			await client.end()
		}
	} catch (e) {
		return { ok: false, error: `listInbox failed: ${e instanceof Error ? e.message : String(e)}` }
	}
}
