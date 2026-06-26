/**
 * HumanEval suite registration.
 */

import { registerSuite } from '../../core/config'
import { humanevalAdapter } from './adapter'

registerSuite({
	key: humanevalAdapter.key,
	adapter: humanevalAdapter,
	defaultDataset: humanevalAdapter.datasets.humaneval!,
})
