/**
 * BigCodeBench suite registration.
 *
 * Registers the BigCodeBench adapter in the global suite registry.
 */

import { registerSuite } from '../../core/config'
import type { BenchmarkTask } from '../../core/types'
import { bigCodeBenchAdapter } from './adapter'

registerSuite({
	key: bigCodeBenchAdapter.key,
	adapter: bigCodeBenchAdapter as import('../../core/types').BenchmarkAdapter<BenchmarkTask>,
	defaultDataset: bigCodeBenchAdapter.datasets.default ?? '',
})
