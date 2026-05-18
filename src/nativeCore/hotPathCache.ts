/**
 * HotPathCache — LRU cache with TTL for native call results.
 * Eliminates redundant PowerShell/subprocess calls by caching frequently-used data.
 */

import type { CachedNativeResult } from './types.js'

export class HotPathCache {
  private cache: Map<string, CachedNativeResult> = new Map()
  private maxSize: number
  private defaultTtlMs: number

  constructor(options?: { maxSize?: number; defaultTtlMs?: number }) {
    this.maxSize = options?.maxSize ?? 500
    this.defaultTtlMs = options?.defaultTtlMs ?? 30000 // 30s default
  }

  get(key: string): CachedNativeResult | null {
    const entry = this.cache.get(key)
    if (!entry) return null

    const now = Date.now()
    if (now - entry.timestamp > entry.ttlMs) {
      this.cache.delete(key)
      return null
    }

    entry.hitCount++
    return entry
  }

  set(key: string, value: unknown, ttlMs?: number): void {
    // Evict oldest if at capacity
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey)
      }
    }

    this.cache.set(key, {
      key,
      value,
      timestamp: Date.now(),
      ttlMs: ttlMs ?? this.defaultTtlMs,
      hitCount: 0,
    })
  }

  has(key: string): boolean {
    return this.get(key) !== null
  }

  invalidate(key: string): boolean {
    return this.cache.delete(key)
  }

  invalidatePattern(pattern: string): number {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'))
    let count = 0
    for (const key of this.cache.keys()) {
      if (regex.test(key)) {
        this.cache.delete(key)
        count++
      }
    }
    return count
  }

  invalidateAll(): void {
    this.cache.clear()
  }

  get hitRate(): number {
    if (this.cache.size === 0) return 0
    let totalHits = 0
    let totalRequests = 0
    for (const entry of this.cache.values()) {
      totalHits += entry.hitCount
      totalRequests += entry.hitCount + 1 // +1 for the initial set
    }
    return totalRequests > 0 ? totalHits / totalRequests : 0
  }

  get size(): number {
    return this.cache.size
  }

  getStats(): { size: number; hitRate: number; oldestEntry: number } {
    let oldest = Infinity
    for (const entry of this.cache.values()) {
      if (entry.timestamp < oldest) oldest = entry.timestamp
    }
    return {
      size: this.cache.size,
      hitRate: this.hitRate,
      oldestEntry: oldest === Infinity ? 0 : oldest,
    }
  }
}

// Singleton cache instance
let _instance: HotPathCache | null = null

export function getHotPathCache(): HotPathCache {
  if (!_instance) {
    _instance = new HotPathCache()
  }
  return _instance
}
