/**
 * Public API for the Olympuz instruction harness.
 *
 * The corpus lives under src/harness/corpus/ and is the single source of truth
 * for the doctrine that drives multi-agent behavior. See loader.ts for the
 * hydration model (filesystem or compressed bundle) and graceful degradation.
 */

export {
	getDoctrineSection,
	getFullCorpus,
	getRoleAddendum,
	listCorpus,
	loadFromBundle,
} from './loader.js'
export type { HarnessEntry, HarnessManifest, HarnessManifestFile } from './types.js'
