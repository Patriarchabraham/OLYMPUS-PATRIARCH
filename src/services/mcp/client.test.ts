import { expect, test } from 'vitest'

import { cleanupFailedConnection } from './client.js'

test('cleanupFailedConnection awaits transport close before resolving', async () => {
	let closed = false
	let resolveClose: (() => void) | undefined

	const transport = {
		close: async () =>
			await new Promise<void>((resolve) => {
				resolveClose = () => {
					closed = true
					resolve()
				}
			}),
	}

	const cleanupPromise = cleanupFailedConnection(transport)

	expect(closed).toBe(false)
	resolveClose?.()
	await cleanupPromise
	expect(closed).toBe(true)
})

test('cleanupFailedConnection closes in-process server and transport', async () => {
	let inProcessClosed = false
	let transportClosed = false

	const inProcessServer = {
		close: async () => {
			inProcessClosed = true
		},
	}

	const transport = {
		close: async () => {
			transportClosed = true
		},
	}

	await cleanupFailedConnection(transport, inProcessServer)

	expect(inProcessClosed).toBe(true)
	expect(transportClosed).toBe(true)
})
