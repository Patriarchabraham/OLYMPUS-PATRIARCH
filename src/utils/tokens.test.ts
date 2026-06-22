import { describe, expect, it } from 'vitest'
import { IncrementalTokenCounter } from './incrementalTokenCounter.js'

describe('IncrementalTokenCounter', () => {
	it('uses cached count for same message length', () => {
		const counter = new IncrementalTokenCounter()

		counter.getCount([{ type: 'user', message: { content: 'hello' } } as any])

		expect(counter.cachedCount).toBeGreaterThan(0)
	})

	it('increments for new messages', () => {
		const counter = new IncrementalTokenCounter()

		const count1 = counter.getCount([{ type: 'user', message: { content: 'hello' } } as any])

		const count2 = counter.getCount([
			{ type: 'user', message: { content: 'hello' } } as any,
			{ type: 'user', message: { content: 'world' } } as any,
		])

		expect(count2).toBeGreaterThan(count1)
	})

	it('resets correctly', () => {
		const counter = new IncrementalTokenCounter()

		counter.getCount([{ type: 'user', message: { content: 'hello' } } as any])
		counter.reset()

		expect(counter.cachedCount).toBe(0)
		expect(counter.messageCount).toBe(0)
	})
})
