/**
 * Local device introspection — delegates to systemProfiler.
 */
import { collectLocalDeviceSnapshot } from '../nativeCore/systemProfiler.js'
import type { LocalDeviceSnapshot } from './types.js'

let _cachedSnapshot: LocalDeviceSnapshot | null = null
let _snapshotTime: number = 0
const CACHE_TTL = 15000 // 15s

/** Collect a full snapshot of the local machine hardware and software state. */
export async function getLocalDeviceSnapshot(): Promise<LocalDeviceSnapshot> {
  const now = Date.now()
  if (_cachedSnapshot && now - _snapshotTime < CACHE_TTL) {
    return _cachedSnapshot
  }
  _cachedSnapshot = await collectLocalDeviceSnapshot()
  _snapshotTime = now
  return _cachedSnapshot
}

/** Force a fresh snapshot on next call. */
export function invalidateLocalDeviceSnapshot(): void {
  _cachedSnapshot = null
  _snapshotTime = 0
}
