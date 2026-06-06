/**
 * Terminal-Bench suite registration.
 *
 * Registers the Terminal-Bench 2.0 adapter in the global suite registry.
 */

import { registerSuite } from '../../core/config'
import { terminalBenchAdapter } from './adapter'

registerSuite({
	key: terminalBenchAdapter.key,
	adapter: terminalBenchAdapter as import('../../core/types').BenchmarkAdapter<
		import('../../core/types').BenchmarkTask
	>,
	defaultDataset: terminalBenchAdapter.datasets.default ?? '',
})
