/**
 * SWE-bench suite registration.
 *
 * Registers the SWE-bench adapter with the suite registry,
 * making it available to the universal benchmark runner.
 */

import { registerSuite } from '../../core/config'
import type { BenchmarkAdapter, BenchmarkTask } from '../../core/types'
import { sweBenchAdapter } from './adapter'
import { SWE_DATASETS } from './datasets'

registerSuite({
	key: 'swe-bench',
	adapter: sweBenchAdapter as BenchmarkAdapter<BenchmarkTask>,
	defaultDataset: SWE_DATASETS.verified,
})
