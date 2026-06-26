/**
 * LRUCache — Generic Least-Recently-Used cache with O(1) get and set.
 *
 * Uses a doubly-linked list (for O(1) eviction) backed by a Map (for O(1) lookup).
 * Thread-safe for single-threaded JS environments.
 */

interface LRUNode<K, V> {
	key: K
	value: V
	prev: LRUNode<K, V> | null
	next: LRUNode<K, V> | null
}

export class LRUCache<K, V> {
	private capacity: number
	private map: Map<K, LRUNode<K, V>>
	private head: LRUNode<K, V> // sentinel head (most-recent end)
	private tail: LRUNode<K, V> // sentinel tail (least-recent end)
	private _size = 0

	/** Number of TTL-expired entries evicted (for monitoring). */
	private ttlEvictions = 0
	private ttlMs?: number

	constructor(capacity: number, ttlMs?: number) {
		if (capacity < 1) throw new Error('LRUCache capacity must be >= 1')
		this.capacity = capacity
		this.ttlMs = ttlMs
		this.map = new Map()

		// Sentinel nodes — never hold real data
		this.head = { key: null as unknown as K, value: null as unknown as V, prev: null, next: null }
		this.tail = { key: null as unknown as K, value: null as unknown as V, prev: null, next: null }
		this.head.next = this.tail
		this.tail.prev = this.head
	}

	get size(): number {
		return this._size
	}

	get capacity_(): number {
		return this.capacity
	}

	/**
	 * Retrieve a cached value. Returns undefined on miss or expiry.
	 */
	get(key: K): V | undefined {
		const node = this.map.get(key)
		if (!node) return undefined

		// Check TTL
		if (this.ttlMs !== undefined) {
			const meta = this.getMeta(node)
			if (meta && Date.now() - meta > this.ttlMs) {
				this.delete(key)
				this.ttlEvictions++
				return undefined
			}
		}

		// Move to front (most-recently used)
		this.detach(node)
		this.insertAfterHead(node)
		return node.value
	}

	/**
	 * Insert or update a key-value pair. Evicts LRU entry if at capacity.
	 */
	set(key: K, value: V): void {
		const existing = this.map.get(key)
		if (existing) {
			existing.value = value
			this.setMeta(existing)
			this.detach(existing)
			this.insertAfterHead(existing)
			return
		}

		if (this._size >= this.capacity) {
			// Evict least-recently used (tail.prev)
			const lru = this.tail.prev!
			if (lru !== this.head) {
				this.detach(lru)
				this.map.delete(lru.key)
				this.clearMeta(lru)
				this._size--
			}
		}

		const node: LRUNode<K, V> = { key, value, prev: null, next: null }
		this.map.set(key, node)
		this.setMeta(node)
		this.insertAfterHead(node)
		this._size++
	}

	/**
	 * Check whether a key exists and is not expired.
	 */
	has(key: K): boolean {
		return this.get(key) !== undefined
	}

	/**
	 * Delete a key. Returns true if deleted.
	 */
	delete(key: K): boolean {
		const node = this.map.get(key)
		if (!node) return false
		this.detach(node)
		this.map.delete(key)
		this.clearMeta(node)
		this._size--
		return true
	}

	/**
	 * Clear all entries.
	 */
	clear(): void {
		this.map.clear()
		this.metaMap.clear()
		this.head.next = this.tail
		this.tail.prev = this.head
		this._size = 0
	}

	/**
	 * Statistics for monitoring.
	 */
	stats(): { size: number; capacity: number; ttlEvictions: number } {
		return { size: this._size, capacity: this.capacity, ttlEvictions: this.ttlEvictions }
	}

	// ─── Timestamp tracking (TTL support) ──────────────────────────────────────

	private metaMap = new Map<K, number>() // key → insert/update timestamp

	private getMeta(node: LRUNode<K, V>): number | undefined {
		return this.metaMap.get(node.key)
	}

	private setMeta(node: LRUNode<K, V>): void {
		if (this.ttlMs !== undefined) {
			this.metaMap.set(node.key, Date.now())
		}
	}

	private clearMeta(node: LRUNode<K, V>): void {
		this.metaMap.delete(node.key)
	}

	// ─── Linked-list helpers ────────────────────────────────────────────────────

	private detach(node: LRUNode<K, V>): void {
		node.prev!.next = node.next
		node.next!.prev = node.prev
		node.prev = null
		node.next = null
	}

	private insertAfterHead(node: LRUNode<K, V>): void {
		node.next = this.head.next
		node.prev = this.head
		this.head.next!.prev = node
		this.head.next = node
	}
}

/**
 * Create a hash key from any serializable value.
 * Uses JSON.stringify — suitable for small objects and primitives.
 */
export function hashKey(value: unknown): string {
	return JSON.stringify(value)
}
