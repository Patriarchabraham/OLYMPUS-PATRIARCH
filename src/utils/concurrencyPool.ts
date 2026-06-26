/**
 * ConcurrencyPool — Bounded async concurrency with backpressure.
 *
 * Limits the number of concurrently running Promises. Excess tasks queue
 * and execute as slots free up. Ensures resources (memory, CPU, API rate
 * limits) are not exhausted by unbounded Promise.all over large arrays.
 *
 * Usage:
 *   const pool = new ConcurrencyPool(5) // max 5 simultaneous
 *   const results = await pool.map(items, async item => process(item))
 */

export class ConcurrencyPool {
	private concurrency: number
	private running = 0
	private queue: Array<() => void> = []

	constructor(concurrency: number) {
		if (concurrency < 1) throw new Error('ConcurrencyPool: concurrency must be >= 1')
		this.concurrency = concurrency
	}

	/**
	 * Run a task, respecting the concurrency limit.
	 * Returns the task's result when it completes.
	 */
	run<T>(task: () => Promise<T>): Promise<T> {
		return new Promise<T>((resolve, reject) => {
			const execute = () => {
				this.running++
				task()
					.then(resolve, reject)
					.finally(() => {
						this.running--
						this.dequeue()
					})
			}

			if (this.running < this.concurrency) {
				execute()
			} else {
				this.queue.push(execute)
			}
		})
	}

	/**
	 * Map an array through an async function with bounded concurrency.
	 * Results are returned in the same order as the input, regardless of
	 * completion order.
	 */
	async map<T, R>(items: readonly T[], fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
		return Promise.all(items.map((item, i) => this.run(() => fn(item, i))))
	}

	/**
	 * Map an array and collect only successful results, silently dropping failures.
	 * Useful when partial failure is acceptable (e.g., embedding generation).
	 */
	async mapSettled<T, R>(
		items: readonly T[],
		fn: (item: T, index: number) => Promise<R>,
	): Promise<Array<R | null>> {
		const results = await Promise.allSettled(items.map((item, i) => this.run(() => fn(item, i))))
		return results.map((r) => (r.status === 'fulfilled' ? r.value : null))
	}

	/**
	 * Iterate over a source async iterable, processing each item with the pool.
	 * Collects all results.
	 */
	async fromIterable<T, R>(source: AsyncIterable<T>, fn: (item: T) => Promise<R>): Promise<R[]> {
		const tasks: Promise<R>[] = []
		for await (const item of source) {
			tasks.push(this.run(() => fn(item)))
		}
		return Promise.all(tasks)
	}

	/** Current number of running tasks. */
	get activeCount(): number {
		return this.running
	}

	/** Current number of queued (waiting) tasks. */
	get queuedCount(): number {
		return this.queue.length
	}

	private dequeue(): void {
		const next = this.queue.shift()
		if (next) next()
	}
}

/**
 * Convenience factory — create a pool and run a map in one call.
 * Equivalent to `new ConcurrencyPool(concurrency).map(items, fn)`.
 */
export function poolMap<T, R>(
	items: readonly T[],
	fn: (item: T, index: number) => Promise<R>,
	concurrency = 5,
): Promise<R[]> {
	return new ConcurrencyPool(concurrency).map(items, fn)
}
