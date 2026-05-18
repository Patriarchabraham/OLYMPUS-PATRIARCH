/**
 * Plugin & Skill Initialization
 *
 * Extracted from main.tsx to keep startup logic modular.
 * Registers bundled plugins, skills, and initializes versioned plugins.
 */

import { initBuiltinPlugins } from '../../plugins/bundled/index.js';
import { initBundledSkills } from '../../skills/bundled/index.js';
import { cleanupOrphanedPluginVersionsInBackground } from '../plugins/cacheUtils.js';
import { getGlobExclusionsForPluginCache } from '../plugins/orphanedPluginFilter.js';
import { initializeVersionedPlugins } from '../plugins/installedPluginsManager.js';
import { isBareMode } from '../envUtils.js';
import { profileCheckpoint } from '../startupProfiler.js';

/**
 * Register bundled skills/plugins before kicking getCommands() -- they're
 * pure in-memory array pushes (<1ms, zero I/O) that getBundledSkills()
 * reads synchronously.
 */
export function initPluginsAndSkills(): void {
  initBuiltinPlugins();
  initBundledSkills();
}

/**
 * Initialize versioned plugins system (triggers V1->V2 migration if needed),
 * then run orphan GC, then warm the Grep/Glob exclusion cache.
 *
 * Sequencing matters: the warmup scans disk for .orphaned_at markers,
 * so it must see the GC's Pass 1 (remove markers from reinstalled
 * versions) and Pass 2 (stamp unmarked orphans) already applied.
 *
 * @param isNonInteractiveSession - Whether we're in headless (-p) mode.
 */
export async function initVersionedPlugins(isNonInteractiveSession: boolean): Promise<void> {
  // --bare / SIMPLE: skip plugin version sync + orphan cleanup.
  if (isBareMode()) {
    return;
  }

  if (isNonInteractiveSession) {
    // In headless mode, await to ensure plugin sync completes before CLI exits
    await initializeVersionedPlugins();
    profileCheckpoint('action_after_plugins_init');
    void cleanupOrphanedPluginVersionsInBackground().then(() => getGlobExclusionsForPluginCache());
  } else {
    // In interactive mode, fire-and-forget -- this is purely bookkeeping
    // that doesn't affect runtime behavior of the current session
    void initializeVersionedPlugins().then(async () => {
      profileCheckpoint('action_after_plugins_init');
      await cleanupOrphanedPluginVersionsInBackground();
      void getGlobExclusionsForPluginCache();
    });
  }
}
