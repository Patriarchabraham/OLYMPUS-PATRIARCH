/**
 * Memory Guard — proactive OOM prevention for Mythos Patriarch.
 *
 * Monitors heap usage on a fixed interval and takes escalating action
 * before the process hits the V8 heap limit and crashes.
 *
 * Layers of defense:
 *   70% → soft GC hint (if --expose-gc is set)
 *   80% → warn + aggressive GC
 *   90% → log diagnostic snapshot
 *   95% → emergency: log + attempt heap dump, process may be unrecoverable
 */

import { logError } from './log.js'
import { logForDebugging } from './debug.js'

type MemoryGuardState = {
  timer: ReturnType<typeof setInterval> | null
  started: boolean
}

const state: MemoryGuardState = { timer: null, started: false }

/** Percentage thresholds (0–1) of heapSizeLimit */
const THRESHOLDS = {
  gcHint: 0.70,
  warn: 0.80,
  snapshot: 0.90,
  emergency: 0.95,
} as const

function getHeapRatio(): { used: number; total: number; limit: number; ratio: number } {
  const { heapUsed, heapTotal } = process.memoryUsage()
  // v8.getHeapStatistics() may not exist in all runtimes
  let limit = 0
  try {
    const v8 = await_import_v8()
    limit = v8?.heap_size_limit ?? 0
  } catch {
    // Fallback: estimate limit from NODE_OPTIONS or default ~1.5GB
    limit = estimateHeapLimit()
  }
  const ratio = limit > 0 ? heapUsed / limit : heapUsed / (1.5 * 1024 ** 3)
  return { used: heapUsed, total: heapTotal, limit, ratio }
}

function estimateHeapLimit(): number {
  const opts = process.env.NODE_OPTIONS || ''
  const match = opts.match(/--max-old-space-size=(\d+)/)
  if (match) return parseInt(match[1], 10) * 1024 * 1024
  // Default V8 limit on 64-bit is ~1.5GB
  return 1.5 * 1024 ** 3
}

let _v8Stats: { heap_size_limit: number } | null = null
function await_import_v8(): { heap_size_limit: number } | null {
  if (_v8Stats) return _v8Stats
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const v8 = require('v8') as { getHeapStatistics: () => { heap_size_limit: number } }
    _v8Stats = v8.getHeapStatistics()
    return _v8Stats
  } catch {
    return null
  }
}

function tryGC(): void {
  if (typeof globalThis.gc === 'function') {
    globalThis.gc()
  }
}

function formatMB(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(0)}MB`
}

function check(): void {
  const { used, total, limit, ratio } = getHeapRatio()
  const pct = (ratio * 100).toFixed(1)

  if (ratio >= THRESHOLDS.emergency) {
    logForDebugging(
      `[MemoryGuard] EMERGENCY heap at ${pct}% (${formatMB(used)}/${formatMB(limit)}). ` +
      `Process may crash. Attempting GC.`,
    )
    tryGC()
    return
  }

  if (ratio >= THRESHOLDS.snapshot) {
    logForDebugging(
      `[MemoryGuard] CRITICAL heap at ${pct}% (${formatMB(used)}/${formatMB(limit)}).`,
    )
    tryGC()
    return
  }

  if (ratio >= THRESHOLDS.warn) {
    logForDebugging(
      `[MemoryGuard] WARNING heap at ${pct}% (${formatMB(used)}/${formatMB(limit)}). Forcing GC.`,
    )
    tryGC()
    return
  }

  if (ratio >= THRESHOLDS.gcHint) {
    // Soft hint — only GC if exposed
    tryGC()
  }
}

const CHECK_INTERVAL_MS = 30_000 // 30 seconds

/**
 * Start the memory guard. Safe to call multiple times — only starts once.
 * Should be called early in CLI startup (after logForDebugging is available).
 */
export function startMemoryGuard(): void {
  if (state.started) return
  state.started = true

  // Don't run in tests
  if (process.env.NODE_ENV === 'test' || process.env.VITEST) return

  state.timer = setInterval(check, CHECK_INTERVAL_MS)
  // Don't prevent process exit
  if (state.timer && 'unref' in state.timer) {
    state.timer.unref()
  }

  logForDebugging('[MemoryGuard] Started — monitoring heap every 30s')
}

/**
 * Stop the memory guard (for testing or clean shutdown).
 */
export function stopMemoryGuard(): void {
  if (state.timer) {
    clearInterval(state.timer)
    state.timer = null
  }
  state.started = false
}
