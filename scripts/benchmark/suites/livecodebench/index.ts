/**
 * LiveCodeBench suite registration.
 *
 * Registers the adapter with the unified benchmark framework's suite registry.
 */

import { registerSuite } from '../../core/config'
import { liveCodeBenchAdapter } from './adapter'

registerSuite({
	key: 'livecodebench',
	adapter: liveCodeBenchAdapter,
	defaultDataset: liveCodeBenchAdapter.datasets.default ?? '',
})
