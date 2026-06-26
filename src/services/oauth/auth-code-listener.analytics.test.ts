import { afterEach, expect, test, vi } from 'vitest'

afterEach(() => {
	vi.restoreAllMocks()
})

test('custom error responses log the error redirect analytics event', async () => {
	const events: Array<{
		name: string
		metadata: Record<string, boolean | number | undefined>
	}> = []

	vi.doMock('src/services/analytics/index.js', () => ({
		logEvent: (name: string, metadata: Record<string, boolean | number | undefined>) => {
			events.push({ name, metadata })
		},
	}))

	vi.resetModules()
	const { AuthCodeListener } = (await vi.importActual('./auth-code-listener.js')) as any
	const listener = new AuthCodeListener('/callback')
	const response = {
		writeHead: () => {},
		end: () => {},
	}

	;(listener as any).pendingResponse = response

	listener.handleErrorRedirect((res) => {
		res.writeHead(400, {
			'Content-Type': 'text/plain; charset=utf-8',
		})
		res.end('cancelled')
	})

	expect(events).toEqual([
		{
			name: 'tengu_oauth_automatic_redirect_error',
			metadata: { custom_handler: true },
		},
	])
})

test('custom handlers that do not end the response are closed automatically and still log analytics', async () => {
	const events: Array<{
		name: string
		metadata: Record<string, boolean | number | undefined>
	}> = []
	const response = {
		destroyed: false,
		headersSent: false,
		writableEnded: false,
		writeHead: () => {
			response.headersSent = true
		},
		end: () => {
			response.writableEnded = true
		},
	}

	vi.doMock('src/services/analytics/index.js', () => ({
		logEvent: (name: string, metadata: Record<string, boolean | number | undefined>) => {
			events.push({ name, metadata })
		},
	}))

	vi.doMock('../../utils/log.js', () => ({
		logError: () => {},
	}))

	vi.resetModules()
	const { AuthCodeListener } = (await vi.importActual('./auth-code-listener.js')) as any
	const listener = new AuthCodeListener('/callback')

	;(listener as any).pendingResponse = response

	listener.handleErrorRedirect((res) => {
		res.writeHead(400, {
			'Content-Type': 'text/plain; charset=utf-8',
		})
	})

	expect(response.writableEnded).toBe(true)
	expect((listener as any).pendingResponse).toBeNull()
	expect(events).toEqual([
		{
			name: 'tengu_oauth_automatic_redirect_error',
			metadata: { custom_handler: true },
		},
	])
})

test('custom handlers that throw are logged, converted to a fallback response, and do not log analytics', async () => {
	const events: Array<{
		name: string
		metadata: Record<string, boolean | number | undefined>
	}> = []
	const loggedErrors: unknown[] = []
	const response = {
		destroyed: false,
		headersSent: false,
		writableEnded: false,
		statusCode: 0,
		body: '',
		writeHead: (statusCode: number) => {
			response.headersSent = true
			response.statusCode = statusCode
		},
		end: (body = '') => {
			response.writableEnded = true
			response.body = body
		},
	}

	vi.doMock('src/services/analytics/index.js', () => ({
		logEvent: (name: string, metadata: Record<string, boolean | number | undefined>) => {
			events.push({ name, metadata })
		},
	}))

	vi.doMock('../../utils/log.js', () => ({
		logError: (error: unknown) => {
			loggedErrors.push(error)
		},
	}))

	vi.resetModules()
	const { AuthCodeListener } = (await vi.importActual('./auth-code-listener.js')) as any
	const listener = new AuthCodeListener('/callback')

	;(listener as any).pendingResponse = response

	listener.handleErrorRedirect(() => {
		throw new Error('handler exploded')
	})

	expect(response.statusCode).toBe(500)
	expect(response.body).toBe('Authentication redirect failed')
	expect(response.writableEnded).toBe(true)
	expect((listener as any).pendingResponse).toBeNull()
	expect(loggedErrors).toHaveLength(1)
	expect(events).toEqual([])
})
